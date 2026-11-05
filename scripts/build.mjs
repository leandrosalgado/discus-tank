import { build } from 'esbuild';
import { mkdir, copyFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
await mkdir(path.join(root, 'docs', 'assets'), { recursive: true });
await build({
  entryPoints: [path.join(root, 'src', 'viewer.js')],
  bundle: true,
  format: 'esm',
  target: ['es2022'],
  minify: true,
  legalComments: 'linked',
  outfile: path.join(root, 'docs', 'assets', 'viewer.js'),
});
for (const name of ['index.html', 'style.css']) {
  await copyFile(path.join(root, 'src', name), path.join(root, 'docs', name));
}
for (const name of ['aquarium.glb', 'model-info.json']) {
  await copyFile(path.join(root, 'public', name), path.join(root, 'docs', 'assets', name));
}
await copyFile(path.join(root, 'public', 'drawings.pdf'), path.join(root, 'docs', 'drawings.pdf'));
await copyFile(path.join(root, 'node_modules', 'three', 'LICENSE'), path.join(root, 'docs', 'THREE-LICENSE.txt'));
await writeFile(path.join(root, 'docs', '.nojekyll'), '');
console.log('Built static site in docs/');
