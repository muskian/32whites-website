import test from 'node:test';
import assert from 'node:assert/strict';
import {searchPages} from '../src/lib/search.mjs';
const records = [
  {title:'Root canal treatment',keywords:'rct tooth pain',href:'/services/root-canal-treatment/',category:'Treatment'},
  {title:'Visit us',keywords:'parking stairs hindi marathi Sunday opening hours',href:'/contact/',category:'Clinic'},
  {title:'Costs',keywords:'price estimate fee',href:'/pricing/',category:'Planning'},
];
test('patients can search by common terminology and practical needs', () => {
  assert.equal(searchPages(records,' RCT! ')[0].href,'/services/root-canal-treatment/');
  assert.equal(searchPages(records,'Sunday HOURS')[0].href,'/contact/');
  assert.equal(searchPages(records,'parking')[0].href,'/contact/');
  assert.equal(searchPages(records,'price')[0].href,'/pricing/');
});
test('unmatched terms do not silently recommend an unrelated treatment', () => {
  assert.deepEqual(searchPages(records,'not-a-procedure'),[]);
  assert.deepEqual(searchPages(records,'tooth parking'),[]);
  assert.equal(searchPages(records,'   ').length,3);
});
