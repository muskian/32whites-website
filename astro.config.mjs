import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import {compactCss} from './scripts/lib/compact-css.mjs';

// Compact final CSS after imports and font URLs have been resolved by Vite.
// Source remains readable, and the existing asset budget stays enforced.
const compactStyles = {
  name: '32-whites-compact-styles',
  apply: 'build',
  enforce: 'post',
  generateBundle(_options, bundle) {
    for (const asset of Object.values(bundle)) {
      if (asset.type === 'asset' && asset.fileName.endsWith('.css')) {
        asset.source = compactCss(String(asset.source));
      }
    }
  },
};

export default defineConfig({
  site: 'https://32whitesdental.com',
  output: 'static',
  trailingSlash: 'always',
  vite: { plugins: [tailwindcss(), compactStyles], build: { assetsInlineLimit: 0 } },
  devToolbar: { enabled: false },
});
