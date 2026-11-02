export function searchPages(records, query) {
  const words = query.normalize('NFKD').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!words.length) return records.slice(0, 8);
  return records.filter(record => {
    const text = `${record.title} ${record.keywords}`.toLowerCase();
    return words.every(word => text.includes(word));
  }).slice(0, 12);
}
