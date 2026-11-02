// Minimum Node 24 patch from the vendor's 21 October 2026 security release.
export const minimumRuntime = '24.22.1';
export function runtimeSupported(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)$/.exec(version || '');
  return Boolean(match && Number(match[1]) === 24 && (Number(match[2]) > 22 || (Number(match[2]) === 22 && Number(match[3]) >= 1)));
}
