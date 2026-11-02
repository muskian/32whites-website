import {test} from 'node:test';
import assert from 'node:assert/strict';
import {compactCss} from '../scripts/lib/compact-css.mjs';

test('CSS optimization retains mobile, desktop, height and reduced-motion branches', () => {
  const css='.nav{display:flex}@media(width<=767px){.nav{display:none}}@media(width>=1024px){.stage{position:sticky}}@media(height<=700px){.stage{position:static}}@media(prefers-reduced-motion:reduce){.stage{animation:none}}';
  const result=compactCss(css);
  for(const query of ['max-width:767px','min-width:1024px','max-height:700px','prefers-reduced-motion:reduce']) assert.ok(result.includes(query),query);
  assert.ok(result.includes('display:none'));
});
test('CSS optimization preserves resolved local asset URLs and dynamic story variables', () => {
  const result=compactCss('.scene{background-image:url(/images/enamel-story.svg);transform:rotate(var(--story-turn))}@font-face{font-family:Manrope;src:url(/_astro/manrope.woff2)}');
  for(const value of ['/images/enamel-story.svg','/_astro/manrope.woff2','var(--story-turn)']) assert.ok(result.includes(value),value);
});
test('internal CSS token declarations and nested references stay consistent', () => {
  const result=compactCss(':root{--ink:#123;--surface:#fff}.card{color:var(--ink);background:var(--surface,var(--ink));transform:rotate(var(--story-turn));background-image:url(/images/--ink.svg)}');
  assert.ok(!result.includes('var(--ink)'));
  assert.ok(result.includes('--c0:#123')&&result.includes('var(--c0)'));
  assert.ok(result.includes('var(--story-turn)'));
  assert.ok(result.includes('/images/--ink.svg'));
});
