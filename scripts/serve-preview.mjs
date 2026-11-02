import http from 'node:http';
import {previewResponse} from './lib/preview-response.mjs';

const server = http.createServer(async (req, res) => {
  const response = await previewResponse(req.url, {method:req.method});
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(req.method === 'HEAD' ? undefined : Buffer.from(await response.arrayBuffer()));
});
server.listen(4322, '127.0.0.1', () => console.log('32 Whites preview with security headers: http://127.0.0.1:4322/'));
