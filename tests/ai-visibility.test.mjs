import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeAiVisibility as summarize} from '../scripts/lib/ai-visibility.mjs';
const protocol = {status:'confirmed',version:'fixture1',clinicDomain:'clinic.example',repetitions:1,prompts:[{id:'B1',text:'Clinic phone?',kind:'brand_fact'},{id:'L1',text:'Choose a local dentist',kind:'clinic_choice'},{id:'T4',text:'What to do?',kind:'information'}],engines:[{id:'fixture',product:'Fixture only',mode:'search',accountState:'fixture',locationContext:'fixture'}]};
const observation = promptId => ({engineId:'fixture',promptId,repetition:1,status:'completed',observedAt:'2026-10-22T08:00:00+00:00',accountState:'fixture',locationContext:'fixture',sessionContext:'fixture',evidence:'fixture-only',mentioned:true,recommended:false,sources:[],claims:{correct:1,incorrect:0,unconfirmed:2}});
const dataset = observations => ({protocol,rounds:[{id:'fixture',protocolHash:summarize({protocol,rounds:[]}).protocolHash,observations}]});
test('empty/unconfirmed AI data stays unmeasured, not a fake zero', () => {
  assert.equal(summarize({protocol:{status:'pending'},rounds:[]}).status,'not measured');
  assert.throws(() => summarize({protocol:{status:'pending'},rounds:[{}]}), /Confirm/);
  const r=summarize(dataset([])).rounds[0].metrics[0]; assert.equal(r.mentionRate,null);assert.equal(r.unrecorded,3);assert.equal(r.factAccuracy,null);
});
test('recommendation denominator excludes branded/information prompts and unavailable data', () => {
  const branded={...observation('B1'),recommended:true};
  const choice=observation('L1');
  const failed={...observation('T4'),status:'unavailable',mentioned:null,recommended:null,sources:[],claims:null};
  const m=summarize(dataset([branded,choice,failed])).rounds[0].metrics[0];
  assert.equal(m.completed,2);assert.equal(m.choiceRuns,1);assert.equal(m.recommendationRate,0);assert.equal(m.mentionRate,1);assert.equal(m.unavailable,1);assert.equal(m.factAccuracy,1);assert.equal(m.claims.unconfirmed,4);
});
test('first-party citations check hostname and coding QA preserves incorrect claims', () => {
  const o={...observation('L1'),sources:[{url:'https://clinic.example.evil.test/',support:'unclear'}],claims:{correct:1,incorrect:1,unconfirmed:0}};
  let m=summarize(dataset([o])).rounds[0].metrics[0];assert.equal(m.directCitationRate,0);assert.equal(m.thirdPartySourceRate,1);assert.equal(m.unreviewedErrorRuns,1);assert.equal(m.factAccuracy,.5);
  o.sources.push({url:'https://clinic.example/guide',support:'supports'});o.qaReviewed=true;
  m=summarize(dataset([o])).rounds[0].metrics[0];assert.equal(m.directCitationRate,1);assert.equal(m.unreviewedErrorRuns,0);
});
test('duplicate observations, changed protocols and invalid status combinations are rejected', () => {
  assert.throws(()=>summarize(dataset([observation('B1'),observation('B1')])),/Duplicate/);
  const changed=dataset([]);changed.protocol={...protocol,version:'changed'};assert.throws(()=>summarize(changed),/Protocol changed/);
  assert.throws(()=>summarize(dataset([{...observation('L1'),recommended:true,mentioned:false}])),/Recommendation/);
  assert.throws(()=>summarize(dataset([{...observation('B1'),status:'failed'}])),/Missing\/failed/);
  assert.throws(()=>summarize(dataset([{...observation('L1'),sources:[{url:'javascript:alert(1)',support:'supports'}]}])),/protocol/);
});

test('different account or location conditions cannot silently share a baseline', () => {
  assert.throws(()=>summarize(dataset([{...observation('B1'),accountState:'different account'}])),/Mixed account\/location/);
  assert.throws(()=>summarize(dataset([{...observation('L1'),locationContext:'different city'}])),/Mixed account\/location/);
});
