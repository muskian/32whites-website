import type {APIRoute} from 'astro';
import {clinic} from '../data/clinic';
import {treatments} from '../data/treatments';
import {guides} from '../data/guides';
import {symptoms} from '../data/symptoms';
export const GET: APIRoute = () => {
  const paths = ['/', '/about/', '/contact/', '/pricing/', '/privacy/', '/services/', '/blog/', '/reviews/', '/our-work/', '/concerns/', '/doctors/dr-bhakti-ghanwat-gavade/', ...treatments.map(t=>`/services/${t.slug}/`), ...guides.map(g=>`/blog/${g.slug}/`), ...symptoms.map(s=>`/symptoms/${s.slug}/`)];
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(path => `<url><loc>${clinic.url}${path}</loc></url>`).join('')}</urlset>`, {headers:{'Content-Type':'application/xml; charset=utf-8'}});
};
