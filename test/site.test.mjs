import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const read = file => readFile(new URL(file, root));

test('GLB contains only the six selected public categories and finite geometry', async () => {
  const file = await read('docs/assets/aquarium.glb');
  assert.equal(file.toString('ascii', 0, 4), 'glTF');
  assert.equal(file.readUInt32LE(4), 2);
  assert.equal(file.readUInt32LE(8), file.length);
  const jsonLength = file.readUInt32LE(12);
  const model = JSON.parse(file.toString('utf8', 20, 20 + jsonLength));
  const info = JSON.parse(await read('docs/assets/model-info.json'));
  const allowed = ['glass', 'cover', 'housing', 'pipes', 'stand', 'filter'].sort();
  assert.deepEqual([...new Set(model.nodes.map(node => node.extras.category))].sort(), allowed);
  assert.equal(model.meshes.length, info.meshCount);
  assert.equal(info.option, 'B');
  const pipes = model.nodes.filter(node => node.extras.category === 'pipes');
  for (const [label, count] of [
    ['glass bulkhead', 4], ['hose connector', 4], ['20 mm PVC pipe', 4],
    ['45 degree PVC elbow', 2], ['90 degree PVC elbow', 2],
  ]) {
    assert.equal(pipes.filter(node => node.name.includes(label)).length, count, label);
  }
  assert.ok(pipes.every(node => !/isolation|union|envelope/.test(node.name)));
  for (const role of ['IN', 'OUT']) {
    assert.equal(model.nodes.filter(node => node.name === `Hypermax LINK ${role} angled adapter`).length, 2);
  }
  assert.deepEqual(info.housingMm, [540, 140, 670]);
  assert.ok(info.triangleCount > 1000 && info.triangleCount < 1_000_000);
  const binaryStart = 20 + jsonLength + 8;
  let triangles = 0;
  for (const mesh of model.meshes) {
    for (const primitive of mesh.primitives) {
      const positions = model.accessors[primitive.attributes.POSITION];
      const indices = model.accessors[primitive.indices];
      const indexView = model.bufferViews[indices.bufferView];
      triangles += indices.count / 3;
      const stride = indices.componentType === 5123 ? 2 : 4;
      for (let i = 0; i < indices.count; i++) {
        const offset = binaryStart + indexView.byteOffset + i * stride;
        const value = stride === 2 ? file.readUInt16LE(offset) : file.readUInt32LE(offset);
        assert.ok(value < positions.count);
      }
      for (const type of ['POSITION', 'NORMAL']) {
        const attribute = model.accessors[primitive.attributes[type]];
        const view = model.bufferViews[attribute.bufferView];
        for (let i = 0; i < attribute.count * 3; i++) {
          assert.ok(Number.isFinite(file.readFloatLE(binaryStart + view.byteOffset + i * 4)));
        }
      }
    }
  }
  assert.equal(triangles, info.triangleCount);
  for (const accessor of model.accessors) {
    assert.ok(accessor.count > 0);
    if (accessor.min) assert.ok([...accessor.min, ...accessor.max].every(Number.isFinite));
  }
  assert.ok(!JSON.stringify(model).includes('/Users/'));
  assert.ok(!JSON.stringify(model).includes('CPA'));
  assert.ok(!JSON.stringify(model).includes('Metod'));
});

test('published PDF is the verified price-free copy', async () => {
  const pdf = await read('docs/drawings.pdf');
  const info = JSON.parse(await read('docs/assets/model-info.json'));
  assert.equal(pdf.toString('ascii', 0, 5), '%PDF-');
  assert.equal(createHash('sha256').update(pdf).digest('hex'), info.pdfSha256);
});

test('site is project-path safe and ships its dependency licence', async () => {
  const html = (await read('docs/index.html')).toString();
  assert.ok(html.includes('href="./drawings.pdf"'));
  assert.ok(html.includes('src="./assets/viewer.js"'));
  assert.ok(!/\b(?:src|href)="\/(?!\/)/.test(html));
  assert.ok((await read('docs/THREE-LICENSE.txt')).toString().includes('MIT'));
  assert.equal((await read('docs/.nojekyll')).length, 0);
});

test('public assets exclude source CAD, backups, quotations and pricing data', async () => {
  const files = await readdir(new URL('docs/', root), { recursive: true });
  assert.ok(files.every(file => !/\.(?:FCStd|FCBak|docx|py)$/i.test(file)));
  assert.ok(files.every(file => !/quotation|quote|builder-plumbing|handoff|backup/i.test(file)));
  const expected = new Set(['.nojekyll', 'THREE-LICENSE.txt', 'assets', 'drawings.pdf', 'index.html', 'style.css',
    'assets/aquarium.glb', 'assets/model-info.json', 'assets/viewer.js', 'assets/viewer.js.LEGAL.txt']);
  for (const file of files) assert.ok(expected.has(file), `Unexpected public file: ${file}`);
});
