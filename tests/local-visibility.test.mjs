import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeVisibility} from '../scripts/lib/local-visibility.mjs';
const dataset = () => ({protocol:{status:'confirmed',clinicPin:{lat:18.5,lng:73.9},provider:'Test fixture',device:'mobile',language:'en-IN',timeWindow:'12:00–13:00 Asia/Kolkata',accountState:'signed out',resultDepth:20,
  points:[{id:'a',lat:18.5,lng:73.9},{id:'b',lat:18.6,lng:73.9},{id:'c',lat:18.7,lng:73.9}],queries:[{id:'q',text:'dentist fixture'}],businesses:[{id:'clinic',name:'Fixture only',placeId:'fixture-id'}]},runs:[]});
const row = (pointId, status, rank) => ({pointId,queryId:'q',businessId:'clinic',status,rank,evidence:'fixture only'});
const addRun = (data, observations) => data.runs.push({id:String(data.runs.length),observedAt:'2026-10-01T12:00:00+05:30',protocolHash:summarizeVisibility({...data,runs:[]}).protocolHash,observations});
test('unconfigured tracking stays not measured, never a fabricated zero rank', () => {
  assert.equal(summarizeVisibility({protocol:{status:'pending'},runs:[]}).status,'not measured');
});
test('ranking denominator excludes missing scans but includes observed absence', () => {
  const data=dataset(); addRun(data,[row('a','found',2),row('b','not_found',null)]);
  const metric=summarizeVisibility(data).runs[0].metrics[0];
  assert.equal(metric.top3Share,0.5); assert.equal(metric.observedPoints,2); assert.equal(metric.missingPoints,1);
  assert.equal(metric.meanRankAmongFound,2);
});
test('incomplete grid cannot produce a claimed improvement', () => {
  const data=dataset(); addRun(data,[row('a','found',2)]); addRun(data,[row('a','found',1),row('b','found',2),row('c','found',3)]);
  assert.equal(summarizeVisibility(data).comparisons[0].comparable,false);
  assert.equal(summarizeVisibility(data).comparisons[0].top3PercentagePointChange,null);
});
test('duplicates and changed protocols cannot silently contaminate a baseline', () => {
  const data=dataset(); addRun(data,[row('a','found',2),row('a','found',3)]);
  assert.throws(()=>summarizeVisibility(data),/Duplicate point/);
  data.runs[0].observations.pop(); data.protocol.language='mr-IN';
  assert.throws(()=>summarizeVisibility(data),/hash mismatch/);
});
