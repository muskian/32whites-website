import {readdir,readFile,writeFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {approvedReview, clinicalContentHash} from '../src/lib/editorial.mjs';
import {minimumRuntime, runtimeSupported} from './lib/runtime-policy.mjs';
const root=path.resolve('dist');
async function walk(dir){const entries=await readdir(dir,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]))).flat();}
const files=await walk(root), htmlFiles=files.filter(f=>f.endsWith('.html'));
const pages=new Map(htmlFiles.map(file=>[file===path.join(root,'404.html')?'/404.html':`/${path.relative(root,path.dirname(file)).replaceAll('\\','/')}${path.dirname(file)===root?'':'/'}`,file]));
const errors=[];
if(process.env.PUBLIC_SITE_INDEXABLE==='true'&&!runtimeSupported(process.version))errors.push(`Indexable release requires Node >=${minimumRuntime} <25; current runtime ${process.version}`);
const content=new Map(await Promise.all([...pages].map(async([url,file])=>[url,await readFile(file,'utf8')])));
const titles=new Set(),descriptions=new Set(),canonicals=new Set();
const editorial=JSON.parse(await readFile('qa/editorial-review.json','utf8'));
const clinicalPaths=[...content].filter(([,html])=>html.includes('data-clinical-review')).map(([url])=>url);
for(const url of clinicalPaths){
  const review=editorial.pages.find(item=>item.path===url);
  if(!review)errors.push(`${url}: missing editorial review record`);
  else {
    if(review.status==='approved'&&(!approvedReview(review)||review.contentHash!==clinicalContentHash(content.get(url))))errors.push(`${url}: approval is invalid or wording changed; clinician must review the current content hash`);
    if(process.env.PUBLIC_SITE_INDEXABLE==='true'&&!approvedReview(review))errors.push(`${url}: clinician review is required before an indexable production build`);
  }
}
for(const review of editorial.pages)if(!clinicalPaths.includes(review.path))errors.push(`${review.path}: editorial review record does not match a rendered clinical page`);
for(const [url,html] of content){
  if((html.match(/<h1\b/g)||[]).length!==1)errors.push(`${url}: expected one H1`);
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  if(new Set(ids).size!==ids.length)errors.push(`${url}: duplicate element IDs`);
  if((html.match(/<title>/g)||[]).length!==1)errors.push(`${url}: expected one title`);
  if((url!=='/404.html'&&!html.includes('rel="canonical"'))||!html.includes('name="description"'))errors.push(`${url}: missing metadata`);
  const title=html.match(/<title>(.*?)<\/title>/)?.[1],description=html.match(/name="description" content="([^"]*)"/)?.[1],canonical=html.match(/rel="canonical" href="([^"]*)"/)?.[1];
  for(const [value,set,label] of [[title,titles,'title'],[description,descriptions,'description'],[canonical,canonicals,'canonical']]){if(value===undefined)continue;if(set.has(value))errors.push(`${url}: duplicate ${label}`);set.add(value);}
  if(url==='/404.html'&&(canonical||!html.includes('noindex, nofollow')))errors.push(`${url}: error page must stay noindex and omit a canonical tag`);
  if(url!=='/404.html'&&canonical!==`https://32whitesdental.com${url}`)errors.push(`${url}: canonical does not match clean production URL`);
  if(html.includes('GTM-XXXXXXX'))errors.push(`${url}: placeholder analytics`);
  if(html.includes('7385905319')||html.includes('73859 05319'))errors.push(`${url}: legacy phone number is present`);
  for(const phrase of ['600+ verified reviews','7000+ happy patients','zero pain','lifetime implant'])if(html.toLowerCase().includes(phrase))errors.push(`${url}: unsupported legacy claim is present: ${phrase}`);
  if(/<script\b(?![^>]*type="application\/ld\+json")(?![^>]*src=)[^>]*>/.test(html))errors.push(`${url}: executable inline script conflicts with CSP`);
  if(/\bstyle="/.test(html))errors.push(`${url}: inline style conflicts with CSP`);
  if(process.env.PUBLIC_SITE_INDEXABLE!=='true'&&!html.includes('noindex, nofollow'))errors.push(`${url}: preview indexing allowed`);
  for(const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)){
    const attrs=m[1], label=m[2].replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim(), href=attrs.match(/\bhref="([^"]+)"/)?.[1]??'';
    if(/^book\b/i.test(label)&&!href.startsWith('https://wa.me/919890889241'))errors.push(`${url}: booking link does not open the approved WhatsApp number: ${label}`);
    if(href.startsWith('https://wa.me/')&&(!href.startsWith('https://wa.me/919890889241?text=')||!href.includes('Source%3A%2032%20Whites%20website')||!href.includes('https%3A%2F%2F32whitesdental.com')))errors.push(`${url}: WhatsApp link lacks the approved number or full website attribution`);
    if(/\btarget="_blank"/.test(attrs)&&!(/\brel="[^"]*noopener/.test(attrs)&&/\brel="[^"]*noreferrer/.test(attrs)))errors.push(`${url}: external new-tab link lacks noopener and noreferrer: ${label}`);
    const track=attrs.match(/\bdata-track="([^"]+)"/)?.[1];
    if(track&&!['call_click','whatsapp_click','whatsapp_booking_click','directions_click'].includes(track))errors.push(`${url}: unsupported tracking event ${track}`);
  }
  for(const m of html.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)){try{
    const data=JSON.parse(m[1]),graph=data['@graph']??[];
    const entityIds=graph.filter(item=>item['@id']).map(item=>item['@id']);
    if(new Set(entityIds).size!==entityIds.length)errors.push(`${url}: duplicate schema entity IDs`);
    if(/"(?:AggregateRating|Review)"/.test(m[1]))errors.push(`${url}: self-serving clinic review schema is not permitted`);
    const clinic=graph.find(item=>item['@type']==='Dentist'),doctor=graph.find(item=>item['@type']==='Person');
    if(clinic?.telephone!=='+919890889241')errors.push(`${url}: clinic schema phone is inconsistent`);
    if(!doctor?.hasCredential?.some(item=>item.identifier==='A-33908'))errors.push(`${url}: missing confirmed doctor credential`);
    if(clinic?.logo!=='https://32whitesdental.com/images/logo.png'||!clinic?.sameAs?.includes('https://share.google/NA6TsX8eHiOCI6SmB'))errors.push(`${url}: missing approved logo or Google identity reference`);
    const page=graph.find(item=>item['@id']===`https://32whitesdental.com${url}#page`);
    const review=approvedReview(editorial.pages.find(item=>item.path===url));
    if(review){
      const reviewer=page?.reviewedBy;
      const expected=review.reviewer==='Dr. Bhakti Ghanwat Gavade'?reviewer?.['@id']==='https://32whitesdental.com/#doctor':reviewer?.name===review.reviewer;
      if(page?.lastReviewed!==review.reviewedAt||!expected||!html.includes('data-review-status="approved"'))errors.push(`${url}: review schema and visible approval are inconsistent`);
    }else if(page?.reviewedBy||page?.lastReviewed)errors.push(`${url}: unapproved content must not claim a clinical review`);
  }catch{errors.push(`${url}: invalid JSON-LD`);}}
  for(const m of html.matchAll(/<img\b[^>]*>/g)){for(const attr of ['alt','width','height'])if(!new RegExp(`\\b${attr}=`).test(m[0]))errors.push(`${url}: image missing ${attr}`);}
  for(const m of html.matchAll(/\b(?:href|src)="([^"\s]+)"/g)){
    const ref=m[1];if(!ref.startsWith('/')&&!ref.startsWith('#'))continue;
    const target=new URL(ref,`https://32whitesdental.com${url}`);const pathname=decodeURIComponent(target.pathname);
    if(pathname==='/'||pathname.endsWith('/')){if(!pages.has(pathname))errors.push(`${url}: missing page ${pathname}`);}
    else if(!files.includes(path.join(root,pathname.slice(1))))errors.push(`${url}: missing asset ${pathname}`);
    if(target.hash&&content.has(pathname)&&!content.get(pathname).includes(`id="${target.hash.slice(1)}"`))errors.push(`${url}: missing fragment ${ref}`);
  }
}
const reachable=new Set(['/']);let pending=['/'];while(pending.length){const current=pending.pop();for(const m of (content.get(current)||'').matchAll(/href="(\/[^"#?]*)/g)){if(content.has(m[1])&&!reachable.has(m[1])){reachable.add(m[1]);pending.push(m[1]);}}}
for(const url of content.keys())if(url!=='/404.html'&&!reachable.has(url))errors.push(`Orphan page: ${url}`);
const sitemap=await readFile(path.join(root,'sitemap.xml'),'utf8');
for(const m of sitemap.matchAll(/<loc>(.*?)<\/loc>/g)){const url=new URL(m[1]).pathname;if(!pages.has(url))errors.push(`Sitemap missing page ${url}`);}
for(const url of content.keys())if(url!=='/404.html'&&!sitemap.includes(`<loc>https://32whitesdental.com${url}</loc>`))errors.push(`Content page absent from sitemap: ${url}`);
const security = `/*\n  Cache-Control: public, max-age=0, must-revalidate\n  Strict-Transport-Security: max-age=31536000\n  X-Content-Type-Options: nosniff\n  X-Frame-Options: DENY\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n  Cross-Origin-Opener-Policy: same-origin-allow-popups\n  Cross-Origin-Resource-Policy: same-site\n  Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'\n${process.env.PUBLIC_SITE_INDEXABLE!=='true'?'  X-Robots-Tag: noindex, nofollow\n':''}\n/_astro/*\n  Cache-Control: public, max-age=31536000, immutable\n`;
await writeFile(path.join(root,'_headers'),security);
// Force redirects for actual index files; Netlify otherwise serves the matching file.
const redirects=['/index.html / 301!','/about.html /about/ 301','/contact.html /contact/ 301','/pricing.html /pricing/ 301','/blog/index.html /blog/ 301!'];
for(const url of content.keys())if(url.startsWith('/services/')||url.startsWith('/symptoms/'))if(url.split('/').length===4)redirects.push(`${url.slice(0,-1)}.html ${url} 301`);
await writeFile(path.join(root,'_redirects'),redirects.join('\n')+'\n');
const fileSizes=new Map(await Promise.all(files.map(async file=>[file,(await stat(file)).size])));
const sizeSummary={
  largestHtmlBytes:Math.max(...htmlFiles.map(file=>fileSizes.get(file))),
  totalCssBytes:files.filter(file=>file.endsWith('.css')).reduce((sum,file)=>sum+fileSizes.get(file),0),
  totalJsBytes:files.filter(file=>file.endsWith('.js')).reduce((sum,file)=>sum+fileSizes.get(file),0),
  largestImageBytes:Math.max(...files.filter(file=>/\.(?:avif|gif|jpe?g|png|svg|webp)$/i.test(file)).map(file=>fileSizes.get(file))),
};
const budgets={largestHtmlBytes:90*1024,totalCssBytes:60*1024,totalJsBytes:25*1024,largestImageBytes:150*1024};
for(const [metric,limit] of Object.entries(budgets))if(sizeSummary[metric]>limit)errors.push(`Performance budget exceeded: ${metric} is ${sizeSummary[metric]} bytes (limit ${limit})`);
const images=await Promise.all(files.filter(f=>/clinic-.*webp$/.test(f)).map(async file=>({file:path.basename(file),bytes:(await stat(file)).size})));
const result={pages:htmlFiles.length,reachable:reachable.size,previewNoindex:process.env.PUBLIC_SITE_INDEXABLE!=='true',clinicalPages:clinicalPaths.length,clinicalReviewPending:editorial.pages.filter(item=>item.status!=='approved').length,checks:['unique titles, descriptions and canonicals','one H1 and unique DOM IDs','schema syntax and entity consistency','no self-serving review markup','image dimensions and alternative text','internal links and fragment targets','complete sitemap and page reachability','preview indexing exclusions','CSP compatibility','clinical review records match rendered clinical pages','clinical approval guard for indexable builds','all booking links use approved WhatsApp number and website attribution','new-tab links include opener protections','legacy contact details and unsupported claims are absent','tracking event names are allow-listed','production security headers and immutable asset caching','HTML, CSS, JavaScript and image performance budgets'],budgets,sizeSummary,images,errors};
result.checkedAt = new Date().toISOString();
result.checks.push('404 has no canonical and stays noindex','approved review metadata matches actual reviewer and date','approved clinical content fingerprint matches rendered wording');
await writeFile('qa/build-report.json',JSON.stringify(result,null,2));
if(errors.length){console.error(errors.join('\n'));process.exit(1);}
console.log(`Verified ${htmlFiles.length} HTML pages: metadata, schema syntax, images, internal links, fragments and reachability. Generated security headers and migration redirects.`);
