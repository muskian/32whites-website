import path from 'node:path';
import {readFile, stat} from 'node:fs/promises';

const mime = {'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.jpg':'image/jpeg','.jpeg':'image/jpeg','.avif':'image/avif','.ico':'image/x-icon','.woff':'font/woff','.woff2':'font/woff2','.ttf':'font/ttf'};

// Shared by the localhost preview and artifact checks. No production-host claim.
export async function previewResponse(requestUrl, {root = path.resolve('dist'), method = 'GET'} = {}) {
  root = path.resolve(root);
  const headers = new Headers();
  try {
    const pathname = decodeURIComponent(new URL(requestUrl, 'http://127.0.0.1').pathname);
    let rule = '';
    for (const line of (await readFile(path.join(root, '_headers'), 'utf8')).split('\n')) {
      if (line.startsWith('/')) rule = line.trim();
      else if (line.startsWith('  ') && (rule === '/*' || (rule === '/_astro/*' && pathname.startsWith('/_astro/')))) {
        const value = line.trim(), colon = value.indexOf(':');
        if (colon > 0) headers.set(value.slice(0, colon), value.slice(colon + 1).trim());
      }
    }
    if (!['GET', 'HEAD'].includes(method)) return new Response('Online appointment requests are disabled in this preview.', {status:503, headers});
    if (pathname.includes('\\') || pathname.includes('\0')) return new Response(null, {status:403, headers});
    const redirect = (await readFile(path.join(root, '_redirects'), 'utf8')).split('\n').map(line => line.trim().split(/\s+/)).find(row => row[0] === pathname);
    if (redirect) { headers.set('location', redirect[1]); return new Response(null, {status:301, headers}); }
    let file = path.resolve(root, `.${pathname}`), status = 200;
    if (file !== root && !file.startsWith(root + path.sep)) return new Response(null, {status:403, headers});
    try { if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html'); await stat(file); }
    catch { file = path.join(root, '404.html'); status = 404; }
    const body = await readFile(file);
    headers.set('content-type', mime[path.extname(file).toLowerCase()] || 'application/octet-stream');
    return new Response(method === 'HEAD' ? null : body, {status, headers});
  } catch (error) {
    return new Response(error instanceof URIError ? 'Invalid URL encoding.' : 'Preview unavailable. Rebuild the website.', {status:error instanceof URIError ? 400 : 500, headers});
  }
}
