import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {previewResponse} from '../scripts/lib/preview-response.mjs';

test('artifact handler serves metadata assets, HEAD, redirects and true 404 without accepting forms', async t => {
  const parent = path.resolve(tmpdir()), root = await mkdtemp(path.join(parent, '32-whites-preview-fixture-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), parent);
    assert.ok(path.basename(root).startsWith('32-whites-preview-fixture-'));
    await rm(root, {recursive:true,force:true});
  });
  await mkdir(path.join(root,'images'));
  await mkdir(path.join(root,'fonts'));
  await writeFile(path.join(root,'_headers'),'/*\n  X-Robots-Tag: noindex, nofollow\n');
  await writeFile(path.join(root,'_redirects'),'/contact.html /contact/ 301\n');
  await writeFile(path.join(root,'index.html'),'<h1>Fixture only</h1>');
  await writeFile(path.join(root,'404.html'),'<h1>Missing fixture</h1>');
  await writeFile(path.join(root,'images/social-card.png'),'fixture bytes; not an actual image test');
  await writeFile(path.join(root,'fonts/display.woff2'),'fixture bytes; type contract only');
  const respond = (url, options = {}) => previewResponse(url, {root,...options});
  const image = await respond('/images/social-card.png');
  assert.equal(image.status, 200); assert.equal(image.headers.get('content-type'), 'image/png');
  assert.equal((await respond('/fonts/display.woff2')).headers.get('content-type'), 'font/woff2');
  const head = await respond('/', {method:'HEAD'});
  assert.equal(head.status, 200); assert.equal(await head.text(), '');
  assert.equal(head.headers.get('x-robots-tag'), 'noindex, nofollow');
  const old = await respond('/contact.html');
  assert.equal(old.status, 301); assert.equal(old.headers.get('location'), '/contact/');
  assert.equal((await respond('/missing-preview-fixture/')).status, 404);
  assert.equal((await respond('/', {method:'POST'})).status, 503);
  assert.equal((await respond('/%ZZ')).status, 400);
  assert.equal((await respond('/%5c..%5cprivate.txt')).status, 403);
});
