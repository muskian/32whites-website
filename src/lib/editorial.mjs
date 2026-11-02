import {createHash} from 'node:crypto';

/** Validates recorded decisions; never creates a clinical approval. */
export function approvedReview(record, today = new Date().toISOString().slice(0, 10)) {
  if (record?.status !== 'approved' || typeof record.reviewer !== 'string' || !record.reviewer.trim()) return null;
  const date = record.reviewedAt;
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date || date > today) return null;
  return {reviewer: record.reviewer.trim(), reviewedAt: date};
}

export function reviewSchema(record, doctor, clinicUrl) {
  const review = approvedReview(record);
  if (!review) return {};
  return {
    lastReviewed: review.reviewedAt,
    reviewedBy: review.reviewer === doctor.name
      ? {'@id': `${clinicUrl}/#doctor`}
      : {'@type': 'Person', name: review.reviewer},
  };
}

/** Includes metadata and patient-facing main content; excludes only the review panel. */
export function clinicalContentHash(html) {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1];
  if (!main) throw new Error('Clinical page has no main content');
  const body = main.replace(/<aside\b[^>]*data-clinical-review[^>]*>[\s\S]*?<\/aside>/gi, '');
  const title = html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '';
  const description = html.match(/name="description" content="([^"]*)"/i)?.[1] ?? '';
  return createHash('sha256').update(JSON.stringify([title, description, body])).digest('hex');
}
