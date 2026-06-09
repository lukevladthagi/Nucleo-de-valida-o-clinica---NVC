import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const staticDir = path.join(process.cwd(), 'apps', 'web', '.next', 'static');

async function listCssFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listCssFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.css') ? [fullPath] : [];
    })
  );

  return files.flat();
}

function findMatchingBrace(source, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;

  for (let index = openIndex; index < source.length; index++) {
    const char = source[index];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (char === '{') depth++;
    if (char === '}') {
      depth--;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function unwrapLayerBlocks(source) {
  let output = '';
  let cursor = 0;

  while (cursor < source.length) {
    const layerIndex = source.indexOf('@layer', cursor);

    if (layerIndex === -1) {
      output += source.slice(cursor);
      break;
    }

    const previousChar = layerIndex > 0 ? source[layerIndex - 1] : '';
    if (previousChar && /[-_a-zA-Z0-9]/.test(previousChar)) {
      output += source.slice(cursor, layerIndex + 6);
      cursor = layerIndex + 6;
      continue;
    }

    const openIndex = source.indexOf('{', layerIndex);
    const semicolonIndex = source.indexOf(';', layerIndex);

    if (openIndex === -1 || (semicolonIndex !== -1 && semicolonIndex < openIndex)) {
      output += source.slice(cursor, layerIndex);
      cursor = semicolonIndex === -1 ? source.length : semicolonIndex + 1;
      continue;
    }

    const closeIndex = findMatchingBrace(source, openIndex);
    if (closeIndex === -1) {
      output += source.slice(cursor);
      break;
    }

    output += source.slice(cursor, layerIndex);
    output += source.slice(openIndex + 1, closeIndex);
    cursor = closeIndex + 1;
  }

  return output;
}

try {
  await access(staticDir);
} catch {
  console.log(`Cent Browser CSS patch: ${staticDir} not found.`);
  process.exit(0);
}

const files = await listCssFiles(staticDir);
let patchedFiles = 0;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const patched = unwrapLayerBlocks(source);

  if (patched !== source) {
    await writeFile(file, patched);
    patchedFiles++;
  }
}

console.log(`Cent Browser CSS patch: ${patchedFiles} file(s) updated.`);
