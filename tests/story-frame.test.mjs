import {test} from 'node:test';
import assert from 'node:assert/strict';
import {storyFrame} from '../src/lib/story-frame.mjs';
test('scroll story starts readable and ends with the arrival scene', () => {
  const start=storyFrame(0,1800,900,88), end=storyFrame(988,1800,900,88);
  assert.equal(start.copy,1); assert.equal(start.photo,0);
  assert.equal(end.copy,0); assert.equal(end.photo,1);
  assert.equal(storyFrame(1800,1800,900,88).finished,true);
});
test('restored scroll and short viewports keep story frames bounded', () => {
  for(const y of [-1000,0,400,50000]) for(const height of [0,500,1800]) {
    const frame=storyFrame(y,height,844,70);
    for(const key of ['progress','copy','photo']) assert.ok(frame[key]>=0&&frame[key]<=1);
    assert.ok(Number.isFinite(frame.turn)&&Number.isFinite(frame.scale));
    assert.ok(frame.wash.every(c=>Number.isInteger(c)&&c>=0&&c<=255));
  }
});
