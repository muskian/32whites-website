import test from 'node:test';
import assert from 'node:assert/strict';
import {verifiedReviewLink} from '../src/lib/review-link.mjs';
test('direct review link stays absent until verified, and rejects unsafe URLs and invented dates', () => {
  assert.equal(verifiedReviewLink({url:null}),null);
  const fixture={url:'https://g.page/r/test-fixture/review',verifiedBy:'Fixture only',verifiedAt:'2026-10-01'};
  assert.equal(verifiedReviewLink(fixture,'2026-10-21'),fixture.url);
  for (const change of [{verifiedBy:''},{verifiedAt:'2026-02-30'},{verifiedAt:'2027-01-01'},{url:'https://www.google.com.evil.example/review'},{url:'javascript:alert(1)'}]) assert.throws(()=>verifiedReviewLink({...fixture,...change},'2026-10-21'));
});
