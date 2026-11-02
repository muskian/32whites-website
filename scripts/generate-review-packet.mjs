import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {clinicalContentHash} from '../src/lib/editorial.mjs';

const root = path.resolve('dist');
const editorial = JSON.parse(await readFile('qa/editorial-review.json', 'utf8'));

const entities = new Map([
  ['&amp;', '&'], ['&lt;', '<'], ['&gt;', '>'], ['&quot;', '"'], ['&#39;', "'"],
  ['&rsquo;', '’'], ['&ldquo;', '“'], ['&rdquo;', '”'], ['&nbsp;', ' '],
]);

function decode(value = '') {
  return value.replace(/&(?:amp|lt|gt|quot|#39|rsquo|ldquo|rdquo|nbsp);/g, match => entities.get(match) ?? match);
}

function text(value = '') {
  return decode(value.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
}

function pageFile(pagePath) {
  return path.join(root, pagePath.replace(/^\//, ''), 'index.html');
}

const sections = [];
const hashes = {};
for (const [index, record] of editorial.pages.entries()) {
  const html = await readFile(pageFile(record.path), 'utf8');
  hashes[record.path] = clinicalContentHash(html);
  const title = text(html.match(/<title>(.*?)<\/title>/i)?.[1]);
  const description = decode(html.match(/<meta name="description" content="([^"]*)"/i)?.[1] ?? '');
  const h1 = text(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]);
  const headings = [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map(match => text(match[1])).filter(Boolean);
  const sources = [...html.matchAll(/<a[^>]+href="(https?:\/\/[^\"]+)"[^>]*>([\s\S]*?)<\/a>/gi)]
    .map(match => ({url: decode(match[1]), label: text(match[2])}))
    .filter(source => !/(?:wa\.me|share\.google|google\.com\/maps)/i.test(source.url))
    .filter((source, sourceIndex, all) => all.findIndex(item => item.url === source.url) === sourceIndex);

  sections.push(`## ${index + 1}. ${h1}\n\n**Path:** \`${record.path}\`  \n**Search title:** ${title}  \n**Search description:** ${description}\n\n**Sections to review**\n\n${headings.map(item => `- ${item}`).join('\n')}\n\n**References visible on the page**\n\n${sources.length ? sources.map(source => `- [${source.label}](${source.url})`).join('\n') : '- No external clinical reference is currently linked; confirm whether one is required.'}\n\n**Clinical decision**\n\n- [ ] The wording is accurate and within the clinic’s actual scope.\n- [ ] Red flags and urgency language are appropriate.\n- [ ] Benefits, limitations, risks and alternatives are balanced where relevant.\n- [ ] The page does not promise a diagnosis or outcome.\n- [ ] The listed service is currently available, or the wording clearly requires confirmation.\n- [ ] The references are suitable and current enough for this page.\n- [ ] Approved as written, or requested edits are attached.\n\nReviewer: ____________________  \nReview date (YYYY-MM-DD): ____________________  \nRequested edits or notes:  \n__________________________________________________________________\n__________________________________________________________________\n`);
}

const output = `# 32 Whites clinical content review packet\n\nGenerated from the current production build. This packet covers ${editorial.pages.length} pages that are prevented from becoming indexable until an actual clinician, reviewer name and review date are recorded. Confirmed credentials alone do not approve the clinical wording.\n\n## How to complete the review\n\n1. Open each path in the preview while reading its checklist below.\n2. Record corrections precisely; do not approve a page whose service, risks, referral arrangements or emergency guidance is inaccurate.\n3. Sign and date only after reviewing the exact published wording.\n4. Return the completed decisions so the approved reviewer and date can be entered into \`qa/editorial-review.json\`.\n5. The indexable build guard will continue to fail until every clinical page is approved.\n\n${sections.join('\n---\n\n')}`;

let packet = output.replace('Generated from the current production build.', 'Generated from the current static build (protected development preview).')
  .replace('## How to complete the review', 'Each path’s SHA-256 content fingerprint is recorded in `qa/clinical-content-hashes.json`. Return the fingerprint with the decision; an approval requires `contentHash` in its record. Any change to patient-facing main HTML or search metadata invalidates the approval. Shared navigation/footer changes are excluded.\n\n## How to complete the review');
for (const record of editorial.pages) packet = packet.replace(`**Path:** \`${record.path}\``, `**Path:** \`${record.path}\`  \n**Content fingerprint:** \`${hashes[record.path]}\``);
await writeFile('qa/clinical-review-packet.md', packet);
await writeFile('qa/clinical-content-hashes.json', JSON.stringify(hashes, null, 2)+'\n');
console.log(`Generated clinical review packet for ${editorial.pages.length} pages.`);
