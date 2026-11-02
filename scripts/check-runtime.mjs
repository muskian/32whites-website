import {minimumRuntime, runtimeSupported} from './lib/runtime-policy.mjs';
console.log(`Runtime ${process.version}; release requires Node >=${minimumRuntime} <25. Pin is a minimum baseline, not an ongoing vulnerability audit.`);
if (!runtimeSupported(process.version)) process.exitCode = 1;
