import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const staticDir = path.join(process.cwd(), 'apps', 'web', '.next', 'static');
const staticContextBlockPattern =
  /static\s*\{\s*this\.contextType\s*=\s*([^;{}]+?)\s*\}/g;

async function listJavaScriptFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) return listJavaScriptFiles(fullPath);
      return entry.isFile() && entry.name.endsWith('.js') ? [fullPath] : [];
    })
  );

  return files.flat();
}

try {
  await access(staticDir);
} catch {
  console.log(`Cent Browser compatibility patch: ${staticDir} not found.`);
  process.exit(0);
}

const files = await listJavaScriptFiles(staticDir);
let patchedFiles = 0;

for (const file of files) {
  const source = await readFile(file, 'utf8');
  const patched = source.replace(
    staticContextBlockPattern,
    'static contextType=$1;'
  );

  if (patched !== source) {
    await writeFile(file, patched);
    patchedFiles++;
  }
}

console.log(`Cent Browser compatibility patch: ${patchedFiles} file(s) updated.`);
