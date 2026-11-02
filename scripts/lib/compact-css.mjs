import {minify, syntax} from 'csso';

// Internal CSS-only tokens. Runtime --story-* properties keep their public names.
const tokens = ('ink ink-2 navy navy-600 navy-800 navy-900 paper blue-50 blue-100 blue-200 blue-300 pink-50 pink-100 pink-200 pink-400 pink-700 line line-strong radius-sm radius radius-lg radius-xl radius-feature shadow-sm shadow-md shadow-lg container header-h muted subtle soft surface on-dark on-dark-muted gold danger danger-bg danger-line success success-bg focus text-xs text-sm text-md text-base text-lg text-xl text-2xl text-3xl h1 h1-display h2 s1 s2 s3 s4 s5 s6 s8 s10 s12 s16 s20 s24 ease fast measure').split(' ');
const shortNames = new Map(tokens.map((name, index) => [`--${name}`, `--c${index.toString(36)}`]));

export function compactCss(css) {
  // Vite emits Media Queries Level 4 ranges; CSSO 5 expects min/max syntax.
  // Normalize equivalent inclusive size ranges before structural optimization.
  const compatible = css.replace(/\((width|height)\s*(<=|>=)\s*([\d.]+(?:px|em|rem))\)/g,
    (_match, dimension, operator, value) => `(${operator === '<=' ? 'max' : 'min'}-${dimension}:${value})`);
  const output = minify(compatible).css;
  const compact = value => value.replace(/\s/g, '');
  const expected = [...compatible.matchAll(/@media\s*(\([^{}]+\))\s*\{/g)].map(match => compact(match[1]));
  for (const query of new Set(expected)) {
    if (!compact(output).includes(query)) throw new Error(`CSS optimizer removed media condition: ${query}`);
  }
  const ast = syntax.parse(output, {parseCustomProperty: true});
  syntax.walk(ast, node => {
    if (node.type === 'Declaration' && shortNames.has(node.property)) node.property = shortNames.get(node.property);
    if (node.type === 'Function' && node.name === 'var') {
      const name = node.children.first;
      if (name?.type === 'Identifier' && shortNames.has(name.name)) name.name = shortNames.get(name.name);
    }
  });
  return syntax.generate(ast);
}
