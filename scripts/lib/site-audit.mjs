// Checks this project's static HTML contract; does not emulate Google or execute JS.
export const attributes = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*["']([^"']*)["']/g)].map(m => [m[1].toLowerCase(), m[2]]));
const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b[^>]*>`, 'gi'))].map(m => attributes(m[0]));
const decodeHtml = value => value.replace(/&(?:amp|quot|apos|lt|gt);|&#(?:x[\da-f]+|\d+);/gi, entity => {
  const named = {'&amp;':'&', '&quot;':'"', '&apos;':"'", '&lt;':'<', '&gt;':'>'};
  if (named[entity.toLowerCase()]) return named[entity.toLowerCase()];
  const number = entity.slice(2, -1), point = number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number);
  return point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd';
});
const kindFromPath = ref => {
  const pathname = ref.split(/[?#]/)[0];
  if (/\.css$/i.test(pathname)) return 'style';
  if (/\.(?:m?js)$/i.test(pathname)) return 'script';
  if (/\.(?:woff2?|ttf|otf|eot)$/i.test(pathname)) return 'font';
  if (/\.(?:avif|gif|jpe?g|png|svg|webp|ico)$/i.test(pathname)) return 'image';
  if (/\.pdf$/i.test(pathname)) return 'pdf';
  return 'file';
};
const assetTypeMatches = (kind, mime) => {
  if (!mime || /^(?:text\/html|application\/xhtml\+xml)$/.test(mime)) return false;
  if (kind === 'style') return mime === 'text/css';
  if (kind === 'script') return /^(?:text|application)\/(?:javascript|ecmascript|x-javascript)$/.test(mime);
  if (kind === 'image') return mime.startsWith('image/');
  if (kind === 'font') return mime.startsWith('font/') || /^(?:application\/(?:font-woff|font-sfnt|x-font-woff|x-font-ttf|x-font-opentype|vnd.ms-fontobject))$/.test(mime);
  if (kind === 'pdf') return mime === 'application/pdf';
  return true;
};
const decodeCss = value => value.replace(/\\([\da-f]{1,6})(?:\r\n|[\t\n\r\f ])?|\\(?:\r\n|[\n\r\f])|\\(.)/gi, (_, hex, escaped) => {
  const point = hex ? parseInt(hex, 16) : 0;
  return hex ? (point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : '\ufffd') : (escaped ?? '');
});
// Handles static url() and @import references, not a general CSS parser or runtime styles.
export function inspectCss(css) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, ''), references = [];
  const urlPattern = /url\(\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)'|((?:\\.|[^)\\])*))\s*\)/gi;
  for (const match of clean.matchAll(urlPattern)) {
    const ref = decodeCss(match[1] ?? match[2] ?? match[3].trim());
    const before = clean.slice(Math.max(0, match.index - 20), match.index);
    references.push({ref, kind: /@import\s*$/i.test(before) ? 'style' : kindFromPath(ref), source: 'css:url'});
  }
  for (const match of clean.matchAll(/@import\s+(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')/gi)) references.push({ref: decodeCss(match[1] ?? match[2]), kind: 'style', source: 'css:import'});
  return references.filter(item => item.ref);
}
async function boundedText(response, limit) {
  if (Number(response.headers.get('content-length')) > limit) { await response.body?.cancel(); throw new Error(`Response exceeds ${limit}-byte inspection limit`); }
  if (!response.body) return '';
  const reader = response.body.getReader(), decoder = new TextDecoder(); let bytes = 0, text = '';
  try {
    while (true) {
      const {done, value} = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) { await reader.cancel(); throw new Error(`Response exceeds ${limit}-byte inspection limit`); }
      text += decoder.decode(value, {stream:true});
    }
    return text + decoder.decode();
  } finally { reader.releaseLock(); }
}
export function inspectPage(html, headers, pathname, {mode, canonicalOrigin}, is404 = false) {
  const errors = [], meta = tags(html, 'meta'), links = tags(html, 'link');
  const canonical = links.filter(a => a.rel?.toLowerCase() === 'canonical');
  const robots = `${headers.get('x-robots-tag') || ''} ${meta.filter(a => /^(robots|googlebot)$/i.test(a.name || '')).map(a => a.content).join(' ')}`;
  const blocked = /\b(noindex|none)\b/i.test(robots);
  if (is404 ? !blocked : mode === 'preview' ? !blocked : blocked) errors.push('Unexpected indexing directives');
  if (!is404 && mode === 'production' && /\b(nofollow|nosnippet)\b/i.test(robots)) errors.push('Production follow/snippet restriction');
  if (is404 ? canonical.length > 0 : canonical.length !== 1 || canonical[0]?.href !== canonicalOrigin + pathname) errors.push('Canonical mismatch');
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim();
  const description = meta.find(a => a.name?.toLowerCase() === 'description')?.content?.trim();
  if (!title || !description) errors.push('Missing title or description');
  if ((html.match(/<h1\b/gi) || []).length !== 1) errors.push('Expected one H1');
  for (const header of ['content-security-policy', 'x-content-type-options', 'referrer-policy', 'x-frame-options']) if (!headers.get(header)) errors.push(`Missing ${header}`);
  if (mode === 'production' && !headers.get('strict-transport-security')) errors.push('Missing HSTS');
  if (!headers.get('content-type')?.includes('text/html')) errors.push('Expected HTML content type');
  for (const img of tags(html, 'img')) if (!('alt' in img) || !img.width || !img.height) errors.push('Image missing alt/dimensions');
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (attributes(match[1]).type !== 'application/ld+json') continue;
    try { JSON.parse(match[2]); } catch { errors.push('Invalid JSON-LD'); }
  }
  const assetReferences = [
    ...tags(html, 'img').map(a => ({ref:a.src, kind:'image', source:'img:src'})),
    ...[...tags(html, 'img'), ...tags(html, 'source')].flatMap(a => (a.srcset || '').split(',').map(s => ({ref:s.trim().split(/\s+/)[0], kind:'image', source:'srcset'}))),
    ...tags(html, 'script').map(a => ({ref:a.src, kind:'script', source:'script:src'})),
    ...links.flatMap(a => {
      const rel = (a.rel || '').toLowerCase().split(/\s+/);
      if (rel.includes('stylesheet')) return [{ref:a.href, kind:'style', source:'link:stylesheet'}];
      if (rel.some(r => ['icon','apple-touch-icon','apple-touch-icon-precomposed'].includes(r))) return [{ref:a.href, kind:'image', source:'link:icon'}];
      if (rel.includes('modulepreload')) return [{ref:a.href, kind:'script', source:'link:modulepreload'}];
      if (rel.includes('preload')) return [{ref:a.href, kind:['style','script','image','font'].includes(a.as) ? a.as : kindFromPath(a.href || ''), source:'link:preload'}];
      return [];
    }),
    ...meta.filter(a => /^(?:og:image(?::(?:url|secure_url))?|twitter:image(?::src)?)$/i.test(a.property || a.name || '')).map(a => ({ref:a.content, kind:'image', source:`meta:${a.property || a.name}`})),
  ].filter(item => item.ref).map(item => ({...item, ref:decodeHtml(item.ref)}));
  return {errors, title, description, links: tags(html, 'a').map(a => a.href).filter(Boolean), assets: assetReferences.map(item => item.ref), assetReferences, ids: [...html.matchAll(/\bid=["']([^"']+)["']/g)].map(m => m[1])};
}

export async function auditSite({base, canonicalOrigin = 'https://32whitesdental.com', mode = 'preview', paths, redirects = [], fetcher = fetch, maxResources = 500, maxCssDepth = 5, maxTextBytes = 1024 * 1024}) {
  const origin = new URL(base).origin;
  const canonical = new URL(canonicalOrigin);
  if (!/^https?:$/.test(new URL(base).protocol) || canonical.protocol !== 'https:' || canonical.origin !== canonicalOrigin || canonical.username || canonical.password) throw new Error('Invalid audit origin');
  if (!['preview', 'production'].includes(mode)) throw new Error('Mode must be preview or production');
  if (mode === 'production' && origin !== canonicalOrigin) throw new Error('Production audit must target the canonical HTTPS origin');
  const safePath = value => typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.includes('\\') && !/[\r\n]/.test(value) && new URL(value, origin).origin === origin;
  if (!paths?.length || paths.length > 150 || paths.some(p => !safePath(p) || /[?#]/.test(p))) throw new Error('Invalid expected page inventory');
  if (redirects.length > 500 || redirects.some(row => !Array.isArray(row) || row.length !== 2 || row.some(p => !safePath(p)))) throw new Error('Invalid redirect inventory');
  if (!Number.isInteger(maxResources) || maxResources < 1 || maxResources > 1000 || !Number.isInteger(maxCssDepth) || maxCssDepth < 0 || maxCssDepth > 10 || !Number.isInteger(maxTextBytes) || maxTextBytes < 256 || maxTextBytes > 5 * 1024 * 1024) throw new Error('Invalid audit limits');
  const checks = [], pages = new Map(), resources = new Map(), fragments = [], queue = [...new Set(paths)], skippedResources = [];
  let assetsChecked = 0, resourceLimitHit = false, skippedResourceCount = 0;
  const record = (path, errors, extra = {}) => checks.push({path, pass: errors.length === 0, errors, ...extra});
  const request = async pathname => {
    if (!safePath(pathname)) throw new Error('Refusing request outside audit origin');
    const response = await fetcher(origin + pathname, {redirect: 'manual', signal: AbortSignal.timeout(15000)});
    return response;
  };
  const local = (ref, from) => {
    try {
      const url = new URL(ref, origin + from);
      return !url.username && !url.password && [origin, canonicalOrigin].includes(url.origin) ? url : null;
    } catch { return null; }
  };
  const addResource = (item, from, depth = 0) => {
    if (!item.ref) return;
    const url = local(item.ref, from);
    if (!url || item.ref.startsWith('#')) {
      skippedResourceCount++;
      if (skippedResources.length < 100) skippedResources.push({from, source:item.source, ref:item.ref, reason:item.ref.startsWith('#') ? 'same-document fragment' : 'external, embedded, non-HTTP or invalid URL'});
      return;
    }
    const pathname = url.pathname + url.search;
    if (!resources.has(pathname)) {
      if (resources.size >= maxResources) {
        if (!resourceLimitHit) record('resource limit', [`More than ${maxResources} resources discovered; coverage is incomplete`]);
        resourceLimitHit = true; return;
      }
      resources.set(pathname, {path:pathname, kinds:new Set(), sources:[], depth});
    }
    const resource = resources.get(pathname); resource.kinds.add(item.kind || kindFromPath(pathname));
    const source = {from, source:item.source, ref:item.ref};
    if (!resource.sources.some(s => s.from === from && s.source === source.source && s.ref === source.ref)) resource.sources.push(source);
    resource.depth = Math.min(resource.depth, depth);
  };
  const titles = new Set(), descriptions = new Set();
  for (let index = 0; index < queue.length; index++) {
    const pathname = queue[index];
    if (index >= 150) { record('crawl limit', ['More than 150 pages discovered; investigate before expanding']); break; }
    try {
      const response = await request(pathname), html = await boundedText(response, maxTextBytes);
      const result = inspectPage(html, response.headers, pathname, {mode, canonicalOrigin});
      if (response.status !== 200) result.errors.push(`Expected 200; received ${response.status}`);
      if (titles.has(result.title)) result.errors.push('Duplicate title');
      if (descriptions.has(result.description)) result.errors.push('Duplicate description');
      titles.add(result.title); descriptions.add(result.description); pages.set(pathname, result);
      record(pathname, result.errors, {status: response.status});
      for (const ref of result.links) {
        const url = local(decodeHtml(ref), pathname); if (!url) continue;
        if (url.hash) fragments.push({from: pathname, path: url.pathname, id: decodeURIComponent(url.hash.slice(1))});
        if (url.pathname.endsWith('/') || !url.pathname.split('/').pop().includes('.')) {
          if (!queue.includes(url.pathname)) queue.push(url.pathname);
        } else addResource({ref:decodeHtml(ref), kind:kindFromPath(url.pathname), source:'a:href'}, pathname);
      }
      for (const item of result.assetReferences) addResource(item, pathname);
    } catch (error) { record(pathname, [error.message]); }
  }
  for (const fragment of fragments) if (pages.has(fragment.path) && !pages.get(fragment.path).ids.includes(fragment.id)) record(fragment.from + '#' + fragment.id, ['Missing target fragment']);
  for (const [pathname, resource] of resources) {
    assetsChecked++;
    try {
      const response = await request(pathname), mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase(), errors = [];
      if (response.status !== 200) errors.push(`Asset/file expected 200; received ${response.status}`);
      for (const kind of resource.kinds) if (!assetTypeMatches(kind, mime)) errors.push(`Expected ${kind} content type; received ${mime || '(missing)'}`);
      if (!errors.length && resource.kinds.has('style')) {
        const css = await boundedText(response, maxTextBytes), refs = inspectCss(css);
        for (const item of refs) {
          if (item.kind === 'style' && resource.depth >= maxCssDepth && local(item.ref, pathname) && !resources.has(new URL(item.ref, origin + pathname).pathname + new URL(item.ref, origin + pathname).search)) errors.push(`CSS import depth exceeds ${maxCssDepth}; coverage is incomplete`);
          else addResource(item, pathname, item.kind === 'style' ? resource.depth + 1 : resource.depth);
        }
      } else await response.body?.cancel();
      resource.contentType = mime; resource.status = response.status;
      record(pathname, errors, {status:response.status, contentType:mime, resource:true});
    }
    catch (error) { record(pathname, [error.message]); }
  }
  for (const [from, to] of redirects) {
    try {
      const response = await request(from), destination = response.headers.get('location');
      const expected = new URL(to, origin).href;
      record(from, [301, 308].includes(response.status) && destination && new URL(destination, origin).href === expected && checks.some(c => c.path === to && c.status === 200 && c.pass) ? [] : ['Expected one-hop permanent redirect to a passing destination'], {status: response.status, destination});
      await response.body?.cancel();
    } catch (error) { record(from, [error.message]); }
  }
  try {
    const response = await request('/sitemap.xml'), xml = await boundedText(response, maxTextBytes);
    const listed = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => m[1]);
    const expected = new Set(paths.map(p => canonicalOrigin + p));
    record('/sitemap.xml', response.status === 200 && listed.length === expected.size && new Set(listed).size === listed.length && listed.every(u => expected.has(u)) ? [] : ['Deployed sitemap differs from expected canonical inventory']);
  } catch (error) { record('/sitemap.xml', [error.message]); }
  try {
    const response = await request('/robots.txt'), body = (await boundedText(response, maxTextBytes)).replace(/\r/g, '').trim();
    // Deliberately enforce our known policy instead of pretending to parse all robots syntax.
    const expected = mode === 'preview' ? 'User-agent: *\nDisallow: /' : `User-agent: *\nAllow: /\nSitemap: ${canonicalOrigin}/sitemap.xml`;
    record('/robots.txt', response.status === 200 && body === expected ? [] : ['Robots differs from project policy; inspect rules before release']);
  } catch (error) { record('/robots.txt', [error.message]); }
  try {
    const pathname = '/__32whites_audit_missing_page__/', response = await request(pathname);
    const result = inspectPage(await boundedText(response, maxTextBytes), response.headers, pathname, {mode, canonicalOrigin}, true);
    if (response.status !== 404) result.errors.push(`Expected true 404; received ${response.status}`);
    record(pathname, result.errors, {status: response.status});
  } catch (error) { record('404', [error.message]); }
  return {checkedAt: new Date().toISOString(), base: origin, mode, pass: checks.every(c => c.pass), pagesChecked: pages.size, assetsChecked, checks,
    resources: [...resources.values()].map(({kinds, ...item}) => ({...item, kinds:[...kinds]})),
    coverage:{maxPages:150, maxResources, maxCssDepth, maxTextBytes, resourceLimitHit, skippedResourceCount, skippedResources, assetQueriesPreserved:true, canonicalOriginMappedToAuditOrigin:mode === 'preview'},
    limitations: ['Does not execute JavaScript, check external destinations or measure Core Web Vitals.', 'Static HTML/CSS reference extraction is bounded, not a general parser; runtime imports, inline styles, CSS image-set/string URLs, embedded data assets and visual accessibility require browser checks.', 'Content-type validation does not decode image/font bytes or verify dimensions; actual social-card rendering, consent and message receipt require separate checks.', 'Passing does not establish Google indexing, rich-result eligibility or rankings.']};
}
