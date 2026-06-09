import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import postcss from 'postcss';

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

function unwrapAllLayerBlocks(source) {
  const root = postcss.parse(source);

  root.walkAtRules('layer', (rule) => {
    if (rule.nodes?.length) {
      rule.replaceWith(...rule.nodes);
    } else {
      rule.remove();
    }
  });

  return root
    .toString()
    .replace(/\s+in oklab/g, '')
    .replace(/var\(--[\w-]+,\)\s*/g, '');
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
  const patched = unwrapAllLayerBlocks(source);

  if (patched !== source) {
    await writeFile(file, patched);
    patchedFiles++;
  }
}

console.log(`Cent Browser CSS patch: ${patchedFiles} file(s) updated.`);
