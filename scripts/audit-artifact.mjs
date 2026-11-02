import {readFile, writeFile} from 'node:fs/promises';
import {auditSite} from './lib/site-audit.mjs';
import {previewResponse} from './lib/preview-response.mjs';

const sitemap = await readFile('dist/sitemap.xml', 'utf8');
const paths = [...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(m => new URL(m[1]).pathname);
const redirects = (await readFile('dist/_redirects', 'utf8')).trim().split(/\r?\n/).map(line => line.split(/\s+/).slice(0, 2));
const result = await auditSite({base:'http://127.0.0.1:4322', paths, redirects, fetcher:url => previewResponse(url)});
const report = {...result, runtime:process.version, transport:'In-process generated-dist preview handler; no HTTP connection or real browser', productionVerified:false};
await writeFile('qa/artifact-audit-preview.json', JSON.stringify(report, null, 2) + '\n');
console.log(`${report.pass ? 'PASS' : 'FAIL'} artifact contract: ${report.pagesChecked} pages, ${report.assetsChecked} resources; not live HTTP/browser evidence.`);
for (const check of report.checks.filter(c => !c.pass)) console.error(`${check.path}: ${check.errors.join('; ')}`);
if (!report.pass) process.exitCode = 1;
