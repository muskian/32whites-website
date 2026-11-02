import test from 'node:test';
import assert from 'node:assert/strict';
import {runtimeSupported} from '../scripts/lib/runtime-policy.mjs';
test('release runtime excludes old security patches, EOL majors and malformed versions', () => {
  for (const v of ['v24.22.1','24.22.2','24.23.0']) assert.equal(runtimeSupported(v), true);
  for (const v of ['24.22.0','24.21.9','25.9.0','26.12.1','24.22.1-rc.1','','24.22.1junk']) assert.equal(runtimeSupported(v), false);
});
