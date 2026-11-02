export function verifiedReviewLink(record, today = new Date().toISOString().slice(0, 10)) {
  if (!record?.url) return null;
  if (!record.verifiedBy?.trim() || !/^\d{4}-\d{2}-\d{2}$/.test(record.verifiedAt || '')) throw new Error('Review URL needs actual verifier and date');
  const date = new Date(record.verifiedAt + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== record.verifiedAt || record.verifiedAt > today) throw new Error('Invalid review-link verification date');
  const url = new URL(record.url);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !['search.google.com', 'www.google.com', 'g.page', 'maps.app.goo.gl'].includes(url.hostname)) throw new Error('Use a Google-provided HTTPS review URL');
  return url.href;
}
