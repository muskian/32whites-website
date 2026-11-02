import type {APIRoute} from 'astro';
import {production, clinic} from '../data/clinic';
export const GET: APIRoute = () => new Response(production ? `User-agent: *\nAllow: /\nSitemap: ${clinic.url}/sitemap.xml\n` : 'User-agent: *\nDisallow: /\n', {headers:{'Content-Type':'text/plain; charset=utf-8'}});
