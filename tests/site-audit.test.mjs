import test from 'node:test';
import assert from 'node:assert/strict';
import {auditSite, inspectPage, inspectCss} from '../scripts/lib/site-audit.mjs';
const headers = {'content-type':'text/html', 'content-security-policy':"default-src 'self'", 'x-content-type-options':'nosniff', 'referrer-policy':'strict-origin', 'x-frame-options':'DENY', 'strict-transport-security':'max-age=31536000'};
const html = (missing = false) => `<title>${missing ? 'Missing' : 'Home'}</title><meta name="description" content="Description"><meta name="robots" content="noindex, nofollow">${missing ? '' : '<link rel="canonical" href="https://32whitesdental.com/">'}<h1>Clinic</h1>`;
const fixture = async (url) => {
  const path = new URL(url).pathname;
  if (path === '/index.html') return new Response(null, {status:301, headers:{location:'/'}});
  if (path === '/robots.txt') return new Response('User-agent: *\nDisallow: /');
  if (path === '/sitemap.xml') return new Response('<urlset><url><loc>https://32whitesdental.com/</loc></url></urlset>');
  return new Response(html(path !== '/'), {status:path === '/' ? 200 : 404, headers});
};
test('HTTP audit accepts a protected preview with correct migration and true 404', async () => {
  const result = await auditSite({base:'http://localhost:4322', paths:['/'], redirects:[['/index.html','/']], fetcher:fixture});
  assert.equal(result.pass, true);
});
test('HTTP audit rejects soft 404, redirect chain and missing deployed pages', async () => {
  const result = await auditSite({base:'http://localhost:4322', paths:['/', '/missing/'], redirects:[['/index.html','/']], fetcher:async url => {
    if (url.endsWith('/index.html')) return new Response(null,{status:302,headers:{location:'/another/'}});
    if (url.includes('__32whites')) return new Response(html(true),{headers});
    return fixture(url);
  }});
  for (const path of ['/missing/', '/index.html', '/__32whites_audit_missing_page__/']) assert.equal(result.checks.find(c => c.path === path).pass, false);
});
test('production checks detect accidental noindex and missing security headers', () => {
  const result = inspectPage(html(), new Headers({'content-type':'text/html'}), '/', {mode:'production',canonicalOrigin:'https://32whitesdental.com'});
  assert.ok(result.errors.includes('Unexpected indexing directives'));
  assert.ok(result.errors.includes('Missing HSTS'));
});
test('production audit refuses a staging origin', async () => {
  await assert.rejects(auditSite({base:'https://staging.example.com',mode:'production',paths:['/']}), /canonical HTTPS/);
});

const resourceFixture = (extra, files, seen = []) => async url => {
  const parsed = new URL(url), key = parsed.pathname + parsed.search;
  seen.push(url);
  if (key === '/') return new Response(html() + extra, {headers});
  if (Object.hasOwn(files, key)) {
    const file = files[key];
    if (file instanceof Error) throw file;
    return new Response(file.body ?? '', {status:file.status ?? 200, headers:{'content-type':file.type, ...file.headers}});
  }
  return fixture(url);
};

test('metadata images resolve on preview origin, preserve queries and reject HTML or wrong MIME', async () => {
  const extra = '<meta property="og:image" content="https://32whitesdental.com/card?size=large&amp;v=2"><meta name="twitter:image" content="/missing.png">';
  const seen = [];
  const result = await auditSite({base:'http://localhost:4322',paths:['/'],fetcher:resourceFixture(extra, {'/card?size=large&v=2':{body:'wrong',type:'text/plain'}}, seen)});
  assert.equal(result.pass, false);
  assert.ok(result.checks.find(c => c.path === '/card?size=large&v=2').errors.some(e => e.includes('Expected image')));
  assert.equal(result.checks.find(c => c.path === '/missing.png').pass, false);
  assert.ok(seen.includes('http://localhost:4322/card?size=large&v=2'));
  assert.equal(seen.some(url => url.startsWith('https://32whitesdental.com')), false);
});

test('CSS imports, escaped font paths and shared assets are discovered once with correct types', async () => {
  const extra = '<link rel="stylesheet" href="/css/main.css"><link rel="apple-touch-icon" href="/icon.png"><meta property="og:image" content="/icon.png">';
  const files = {
    '/css/main.css':{body:'@import "nested.css"; @font-face {src:url("../fonts/clinic\\20 regular.woff2?v=2")} .hero{background:url(../icon.png)}',type:'text/css'},
    '/css/nested.css':{body:'.x{background:url(data:image/png;base64,AA==)}',type:'text/css'},
    '/fonts/clinic%20regular.woff2?v=2':{body:'font',type:'font/woff2'},
    '/icon.png':{body:'image',type:'image/png'},
  };
  const seen = [];
  const result = await auditSite({base:'http://localhost:4322',paths:['/'],fetcher:resourceFixture(extra, files, seen)});
  assert.equal(result.pass, true, JSON.stringify(result.checks.filter(c => !c.pass)));
  assert.equal(result.assetsChecked, 4);
  assert.equal(seen.filter(url => url.endsWith('/icon.png')).length, 1);
  assert.ok(result.resources.find(r => r.path === '/fonts/clinic%20regular.woff2?v=2').kinds.includes('font'));
  assert.ok(inspectCss('@import url("a.css"); /*url(fake.png)*/').some(r => r.ref === 'a.css' && r.kind === 'style'));
});

test('resource errors include bad font/script MIME, redirects and network failures', async () => {
  const extra = '<link rel="preload" as="font" href="/font.woff2"><script src="/app.js"></script><img alt="" width="1" height="1" src="/redirect.png"><meta property="og:image" content="/failed.png">';
  const result = await auditSite({base:'http://localhost:4322',paths:['/'],fetcher:resourceFixture(extra, {
    '/font.woff2':{type:'text/plain'}, '/app.js':{type:'image/png'},
    '/redirect.png':{type:'image/png',status:301,headers:{location:'/icon.png'}}, '/failed.png':new Error('fixture network failure'),
  })});
  assert.equal(result.pass, false);
  for (const path of ['/font.woff2','/app.js','/redirect.png','/failed.png']) assert.equal(result.checks.find(c => c.path === path).pass, false);
});

test('external resources are not requested and bounded CSS/resource coverage fails explicitly', async () => {
  const extra = '<link rel="stylesheet" href="/main.css"><meta property="og:image" content="https://other.example/image.png">';
  const files = {'/main.css':{body:'@import "nested.css";',type:'text/css'},'/nested.css':{body:'',type:'text/css'}};
  const seen = [];
  const depth = await auditSite({base:'http://localhost:4322',paths:['/'],maxCssDepth:0,fetcher:resourceFixture(extra, files, seen)});
  assert.equal(depth.pass, false);
  assert.ok(depth.checks.some(c => c.errors.some(e => e.includes('depth'))));
  assert.equal(seen.some(url => url.startsWith('https://other.example')), false);
  assert.ok(depth.coverage.skippedResourceCount > 0);
  const cap = await auditSite({base:'http://localhost:4322',paths:['/'],maxResources:1,fetcher:resourceFixture(extra, files)});
  assert.equal(cap.coverage.resourceLimitHit, true);
  assert.equal(cap.pass, false);
});

test('oversized text and unsafe inventories fail without leaving a false passing report', async () => {
  const result = await auditSite({base:'http://localhost:4322',paths:['/'],maxTextBytes:256,fetcher:resourceFixture('<link rel="stylesheet" href="/big.css">', {'/big.css':{body:'x'.repeat(300),type:'text/css'}})});
  assert.equal(result.pass, false);
  assert.ok(result.checks.some(c => c.errors.some(e => e.includes('inspection limit'))));
  for (const paths of [['//outside.example/'], ['/safe\\../'], ['/path?private=value']]) await assert.rejects(auditSite({base:'http://localhost:4322',paths,fetcher:fixture}), /inventory/);
});
