export interface SearchRecord {title: string; href: string; keywords: string; category: string}
export function searchPages(records: SearchRecord[], query: string): SearchRecord[];
