import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'docs');
const types = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.glb': 'model/gltf-binary', '.pdf': 'application/pdf', '.txt': 'text/plain' };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://localhost');
    let relative = decodeURIComponent(url.pathname);
    if (relative.startsWith('/discus-tank/')) relative = relative.slice('/discus-tank'.length);
    const target = path.resolve(root, '.' + relative);
    if (target !== root && !target.startsWith(root + path.sep)) {
      res.writeHead(403).end('Forbidden');
      return;
    }
    const file = (await stat(target)).isDirectory() ? path.join(target, 'index.html') : target;
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] ?? 'application/octet-stream', 'Content-Length': data.length });
    res.end(data);
  } catch (error) {
    const missing = error.code === 'ENOENT' || error.code === 'ENOTDIR';
    if (!missing) console.error(error);
    res.writeHead(missing ? 404 : 500).end(missing ? 'Not found' : 'Server error');
  }
});
server.listen(5180, '127.0.0.1', () => console.log('Viewer: http://127.0.0.1:5180/discus-tank/'));
