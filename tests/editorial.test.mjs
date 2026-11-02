import test from 'node:test';
import assert from 'node:assert/strict';
import {approvedReview, reviewSchema, clinicalContentHash} from '../src/lib/editorial.mjs';
const record = {status:'approved', reviewer:'Dr. Bhakti Ghanwat Gavade', reviewedAt:'2026-09-29'};
test('clinical approvals reject impossible dates, future dates and incomplete decisions', () => {
  for (const value of [{...record,status:'pending'},{...record,reviewer:' '},{...record,reviewedAt:'2026-02-30'},{...record,reviewedAt:'2026-13-01'},{...record,reviewedAt:'2027-01-01'}]) assert.equal(approvedReview(value,'2026-10-07'),null);
  assert.equal(approvedReview(record,'2026-10-07').reviewedAt,'2026-09-29');
});
test('review schema attributes the actual reviewer and excludes pending decisions', () => {
  const doctor={name:record.reviewer};
  assert.equal(reviewSchema(record,doctor,'https://32whitesdental.com').reviewedBy['@id'],'https://32whitesdental.com/#doctor');
  assert.deepEqual(reviewSchema({...record,reviewer:'Another clinician'},doctor,'https://32whitesdental.com').reviewedBy,{'@type':'Person',name:'Another clinician'});
  assert.deepEqual(reviewSchema({...record,status:'pending'},doctor,'https://32whitesdental.com'),{});
});
test('clinical fingerprints invalidate changed patient content or search metadata, excluding review status', () => {
  const html='<title>Dental care</title><meta name="description" content="Visit"><main><p>Discuss options.</p><aside data-clinical-review>Pending</aside></main>';
  assert.equal(clinicalContentHash(html),clinicalContentHash(html.replace('Pending','Approved')));
  assert.notEqual(clinicalContentHash(html),clinicalContentHash(html.replace('Discuss options.','Guaranteed cure.')));
  assert.notEqual(clinicalContentHash(html),clinicalContentHash(html.replace('content="Visit"','content="New advice"')));
});
