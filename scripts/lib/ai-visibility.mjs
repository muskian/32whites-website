import {createHash} from 'node:crypto';
const requireValue = (ok, message) => { if (!ok) throw new Error(message); };
const fraction = (n, d) => d ? n / d : null;

export function summarizeAiVisibility({protocol, rounds}) {
  requireValue(protocol && Array.isArray(rounds), 'Expected protocol and rounds');
  if (protocol.status !== 'confirmed') {
    requireValue(rounds.length === 0, 'Confirm protocol before adding observations');
    return {status:'not measured', reason:'Confirm engine modes, prompt version and collection conditions; no observations have been collected.', rounds:[]};
  }
  requireValue(protocol.version?.trim() && protocol.clinicDomain?.trim(), 'Protocol version and clinic domain required');
  requireValue(/^[a-z0-9.-]+$/i.test(protocol.clinicDomain), 'Clinic domain must be a hostname');
  requireValue(Number.isInteger(protocol.repetitions) && protocol.repetitions >= 1 && protocol.repetitions <= 10, 'Invalid repetition count');
  for (const field of ['prompts', 'engines']) requireValue(Array.isArray(protocol[field]) && protocol[field].length && protocol[field].every(x => typeof x.id === 'string' && x.id.trim()) && new Set(protocol[field].map(x => x.id)).size === protocol[field].length, `Missing/duplicate ${field}`);
  requireValue(protocol.prompts.every(p => p.text?.trim() && ['brand_fact','clinic_choice','information'].includes(p.kind)), 'Exact prompts and kind required');
  requireValue(protocol.engines.every(e => ['product','mode','accountState','locationContext'].every(f => typeof e[f] === 'string' && e[f].trim())), 'Engine product, mode and fixed account/location cohort required');
  const stable = {...protocol, prompts:[...protocol.prompts].sort((a,b) => a.id.localeCompare(b.id)), engines:[...protocol.engines].sort((a,b) => a.id.localeCompare(b.id))};
  const protocolHash = createHash('sha256').update(JSON.stringify(stable)).digest('hex');
  const ids = new Set();
  const summaries = rounds.map(round => {
    requireValue(round.id?.trim() && !ids.has(round.id), 'Missing/duplicate round ID'); ids.add(round.id);
    requireValue(round.protocolHash === protocolHash, 'Protocol changed; start a separate baseline');
    requireValue(Array.isArray(round.observations), 'Observations required');
    const seen = new Set();
    for (const o of round.observations) {
      requireValue(protocol.engines.some(e => e.id === o.engineId) && protocol.prompts.some(p => p.id === o.promptId), 'Unknown engine/prompt');
      requireValue(Number.isInteger(o.repetition) && o.repetition >= 1 && o.repetition <= protocol.repetitions, 'Invalid repetition');
      const key = JSON.stringify([o.engineId,o.promptId,o.repetition]); requireValue(!seen.has(key), 'Duplicate engine/prompt/repetition'); seen.add(key);
      requireValue(['completed','unavailable','failed'].includes(o.status), 'Invalid observation status');
      requireValue(typeof o.observedAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(o.observedAt) && Number.isFinite(Date.parse(o.observedAt)), 'Observation needs timestamp with timezone');
      requireValue(['accountState','locationContext','sessionContext','evidence'].every(f => typeof o[f] === 'string' && o[f].trim()), 'Record context and evidence or failure reference');
      const engine = protocol.engines.find(e => e.id === o.engineId);
      requireValue(o.accountState === engine.accountState && o.locationContext === engine.locationContext, 'Mixed account/location cohort; create a separate engine cohort and baseline');
      if (o.status !== 'completed') {
        requireValue(o.mentioned == null && o.recommended == null && o.claims == null && (!o.sources || o.sources.length === 0), 'Missing/failed run must not contain scored results');
        continue;
      }
      requireValue(typeof o.mentioned === 'boolean' && typeof o.recommended === 'boolean' && (!o.recommended || o.mentioned), 'Recommendation needs an actual mention');
      requireValue(Array.isArray(o.sources) && o.claims && ['correct','incorrect','unconfirmed'].every(f => Number.isInteger(o.claims[f]) && o.claims[f] >= 0), 'Sources and nonnegative claim counts required');
      for (const s of o.sources) {
        let u; try { u = new URL(s.url); } catch { throw new Error('Invalid source URL'); }
        requireValue(['http:','https:'].includes(u.protocol) && !u.username && !u.password, 'Invalid source URL protocol/credentials');
        requireValue(['supports','contradicts','unclear'].includes(s.support), 'Source support must be explicitly coded');
      }
    }
    const metrics = protocol.engines.map(engine => {
      const all = round.observations.filter(o => o.engineId === engine.id), completed = all.filter(o => o.status === 'completed');
      const choiceIds = new Set(protocol.prompts.filter(p => p.kind === 'clinic_choice').map(p => p.id));
      const choice = completed.filter(o => choiceIds.has(o.promptId));
      const direct = o => o.sources.some(s => new URL(s.url).hostname.toLowerCase() === protocol.clinicDomain.toLowerCase());
      const third = o => o.sources.some(s => new URL(s.url).hostname.toLowerCase() !== protocol.clinicDomain.toLowerCase());
      const claims = completed.reduce((t,o) => { for (const f of ['correct','incorrect','unconfirmed']) t[f] += o.claims[f]; return t; }, {correct:0,incorrect:0,unconfirmed:0});
      const planned = protocol.prompts.length * protocol.repetitions;
      return {engineId:engine.id, planned, completed:completed.length, unavailable:all.filter(o => o.status === 'unavailable').length, failed:all.filter(o => o.status === 'failed').length, unrecorded:planned - all.length,
        mentionRate:fraction(completed.filter(o => o.mentioned).length, completed.length), choiceRuns:choice.length, recommendationRate:fraction(choice.filter(o => o.recommended).length,choice.length),
        directCitationRate:fraction(completed.filter(direct).length, completed.length), thirdPartySourceRate:fraction(completed.filter(third).length, completed.length),
        claims, factAccuracy:fraction(claims.correct, claims.correct + claims.incorrect), qaReviewed:completed.filter(o => o.qaReviewed === true).length,
        unreviewedErrorRuns:completed.filter(o => o.claims.incorrect > 0 && o.qaReviewed !== true).length};
    });
    return {id:round.id, metrics};
  });
  return {status:rounds.length ? 'observations recorded' : 'not measured', protocolHash, rounds:summaries, limitations:['Manual panel observations, not engine-wide market share or causal results.', 'Information/brand prompts are excluded from clinic-recommendation denominator.', 'Direct citation records a first-party link, not proof it supports the answer; source support is separately coded.', 'Unconfirmed claims and missing runs remain separate; no patient outcome inferred.']};
}
