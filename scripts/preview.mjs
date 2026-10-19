import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png'};
const server = http.createServer((request,response) => {
  let relative;
  try { relative = decodeURIComponent(new URL(request.url,'http://localhost').pathname); }
  catch { response.writeHead(400); response.end(); return; }
  if (relative === '/') relative = '/docs/index.html';
  if (relative.endsWith('/')) relative += 'index.html';
  const filename = path.resolve(root,'.' + relative);
  if (!filename.startsWith(root + path.sep) || relative.split('/').some(part => part.startsWith('.')) || !fs.existsSync(filename) || !fs.statSync(filename).isFile()) {
    response.writeHead(404); response.end('Not found'); return;
  }
  response.writeHead(200, {'Content-Type':types[path.extname(filename)] || 'application/octet-stream','Cache-Control':'no-store'});
  fs.createReadStream(filename).pipe(response);
});
server.listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`Local: http://127.0.0.1:${server.address().port}/docs/`));
