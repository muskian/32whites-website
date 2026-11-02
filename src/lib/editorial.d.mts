export interface ReviewRecord {status: string; reviewer?: string | null; reviewedAt?: string | null; contentHash?: string | null}
export function approvedReview(record?: ReviewRecord, today?: string): {reviewer: string; reviewedAt: string} | null;
export function reviewSchema(record: ReviewRecord | undefined, doctor: {name: string}, clinicUrl: string): Record<string, unknown>;
export function clinicalContentHash(html: string): string;
