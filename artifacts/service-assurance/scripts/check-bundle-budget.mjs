import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputRoot = path.join(packageRoot, 'dist', 'public');
const manifest = JSON.parse(
  await readFile(path.join(outputRoot, '.vite', 'manifest.json'), 'utf8'),
);

const maxChunkBytes = 500 * 1024;
const maxInitialBytes = 400 * 1024;
const entryKey = Object.keys(manifest).find((key) => manifest[key].isEntry);

if (!entryKey) throw new Error('Vite manifest does not contain an application entry.');

const javascriptEntries = Object.entries(manifest).filter(([, value]) =>
  value.file?.endsWith('.js'),
);
const oversizedChunks = [];
for (const [key, value] of javascriptEntries) {
  const bytes = (await stat(path.join(outputRoot, value.file))).size;
  if (bytes > maxChunkBytes) oversizedChunks.push(`${key}: ${(bytes / 1024).toFixed(1)} KiB`);
}

if (oversizedChunks.length > 0) {
  throw new Error(
    `JavaScript chunk budget exceeded (${maxChunkBytes / 1024} KiB):\n${oversizedChunks.join('\n')}`,
  );
}

const initialKeys = new Set();
const visitStaticImports = (key) => {
  if (initialKeys.has(key)) return;
  initialKeys.add(key);
  for (const dependency of manifest[key]?.imports ?? []) visitStaticImports(dependency);
};
visitStaticImports(entryKey);

const initialFiles = [];
let initialBytes = 0;
for (const key of initialKeys) {
  const file = manifest[key]?.file;
  if (!file?.endsWith('.js')) continue;
  const bytes = (await stat(path.join(outputRoot, file))).size;
  initialBytes += bytes;
  initialFiles.push(`${file} (${(bytes / 1024).toFixed(1)} KiB)`);
}

if (initialBytes > maxInitialBytes) {
  throw new Error(
    `Initial JavaScript budget exceeded: ${(initialBytes / 1024).toFixed(1)} KiB > ${maxInitialBytes / 1024} KiB\n${initialFiles.join('\n')}`,
  );
}

if ([...initialKeys].some((key) => manifest[key]?.name === 'vendor-map')) {
  throw new Error('Map vendor code is part of the initial dependency graph.');
}

console.log(
  `Bundle budgets passed: initial ${(initialBytes / 1024).toFixed(1)} KiB; largest chunk <= ${maxChunkBytes / 1024} KiB.`,
);
