import {mkdtemp, cp, mkdir, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {clinicalContentHash} from '../src/lib/editorial.mjs';

const scratch=await mkdtemp(path.join(tmpdir(),'32-whites-editorial-check-'));
const verifier=path.resolve('scripts/verify-build.mjs');
const records=JSON.parse(await readFile('qa/editorial-review.json','utf8'));
// Reset only the in-memory fixture so rejection checks remain valid after real approvals.
for (const record of records.pages) {
  Object.assign(record,{status:'pending',reviewer:null,reviewedAt:null});
  delete record.contentHash;
}
const checks=[];
try {
  await cp('dist',path.join(scratch,'dist'),{recursive:true});
  await mkdir(path.join(scratch,'qa'));
  await writeFile(path.join(scratch,'qa/editorial-review.json'),JSON.stringify(records));
  let result=spawnSync(process.execPath,[verifier],{cwd:scratch,env:{...process.env,PUBLIC_SITE_INDEXABLE:'true'},encoding:'utf8'});
  if(result.error)throw result.error;
  checks.push({name:'Indexable build refuses all pending clinical pages in the disposable fixture',pass:result.status!==0&&(result.stderr.match(/clinician review is required/g)||[]).length===records.pages.length});
  const record=records.pages[0];
  const file=path.join(scratch,'dist',record.path.slice(1),'index.html');
  const html=await readFile(file,'utf8');
  Object.assign(record,{status:'approved',reviewer:'TEST FIXTURE ONLY',reviewedAt:'2026-09-29',contentHash:clinicalContentHash(html)});
  await writeFile(path.join(scratch,'qa/editorial-review.json'),JSON.stringify(records));
  await writeFile(file,html.replace('</main>','<p>Changed clinical wording in test fixture.</p></main>'));
  result=spawnSync(process.execPath,[verifier],{cwd:scratch,env:{...process.env,PUBLIC_SITE_INDEXABLE:'false'},encoding:'utf8'});
  if(result.error)throw result.error;
  checks.push({name:'Changed wording invalidates a previously matching approval fingerprint',pass:result.status!==0&&result.stderr.includes('approval is invalid or wording changed')});
  const report={checkedAt:new Date().toISOString(),runtime:process.version,environment:'Disposable local copies only; real clinical records remain untouched',checks};
  await writeFile('qa/editorial-gate-report.json',JSON.stringify(report,null,2)+'\n');
  if(checks.some(check=>!check.pass))throw new Error('Editorial gate checks failed');
  console.log('Verified pending-production and changed-content rejection without changing actual approvals.');
} finally {
  // Remove only the exact fresh directory returned by mkdtemp, after validating its parent.
  const parent=path.resolve(tmpdir());
  if(path.dirname(path.resolve(scratch))!==parent||!path.basename(scratch).startsWith('32-whites-editorial-check-'))throw new Error('Unexpected scratch cleanup path');
  await rm(scratch,{recursive:true,force:true});
}
