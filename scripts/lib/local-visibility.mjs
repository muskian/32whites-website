import {createHash} from 'node:crypto';
const requireValue = (condition, message) => { if (!condition) throw new Error(message); };
export function summarizeVisibility(data) {
  const {protocol, runs} = data;
  requireValue(protocol && Array.isArray(runs), 'Expected protocol and runs');
  if (protocol.status !== 'confirmed') {
    requireValue(runs.length === 0, 'Confirm the protocol before recording observations');
    return {status: 'not measured', reason: 'Confirm clinic pin, business IDs, queries, grid and observation conditions first.', runs: []};
  }
  for (const key of ['provider', 'device', 'language', 'timeWindow', 'accountState']) requireValue(typeof protocol[key] === 'string' && protocol[key].trim(), `Missing ${key}`);
  requireValue(Number.isInteger(protocol.resultDepth) && protocol.resultDepth >= 3, 'Result depth must be at least 3');
  const validCoordinates = p => Number.isFinite(p.lat) && Math.abs(p.lat) <= 90 && Number.isFinite(p.lng) && Math.abs(p.lng) <= 180;
  requireValue(protocol.clinicPin && validCoordinates(protocol.clinicPin), 'Confirmed clinic coordinates required');
  for (const key of ['points', 'queries', 'businesses']) {
    requireValue(Array.isArray(protocol[key]) && protocol[key].length > 0, `Missing ${key}`);
    requireValue(protocol[key].every(x => typeof x.id === 'string' && x.id.trim()) && new Set(protocol[key].map(x => x.id)).size === protocol[key].length, `Invalid/duplicate ${key} IDs`);
  }
  requireValue(protocol.points.every(validCoordinates), 'Invalid grid coordinates');
  requireValue(protocol.queries.every(q => typeof q.text === 'string' && q.text.trim()), 'Exact query text required');
  requireValue(protocol.businesses.every(b => b.name?.trim() && b.placeId?.trim()), 'Business names and verified place IDs required');
  requireValue(new Set(protocol.businesses.map(b => b.placeId)).size === protocol.businesses.length, 'Duplicate business identity');
  const signature = createHash('sha256').update(JSON.stringify({
    clinicPin: protocol.clinicPin, provider: protocol.provider, resultDepth: protocol.resultDepth,
    device: protocol.device, language: protocol.language, timeWindow: protocol.timeWindow, accountState: protocol.accountState,
    points: [...protocol.points].sort((a,b) => a.id.localeCompare(b.id)),
    queries: [...protocol.queries].sort((a,b) => a.id.localeCompare(b.id)),
    businesses: [...protocol.businesses].sort((a,b) => a.id.localeCompare(b.id)),
  })).digest('hex');
  const runIds = new Set();
  const summaries = runs.map(run => {
    requireValue(typeof run.id === 'string' && run.id && !runIds.has(run.id), 'Missing or duplicate run ID'); runIds.add(run.id);
    requireValue(typeof run.observedAt === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(run.observedAt) && Number.isFinite(Date.parse(run.observedAt)), 'Run needs dated timestamp with timezone');
    requireValue(run.protocolHash === signature, 'Run protocol hash mismatch: keep changed protocols in separate datasets');
    requireValue(Array.isArray(run.observations), 'Missing observations');
    const seen = new Set();
    for (const observation of run.observations) {
      const {pointId, queryId, businessId, status, rank, evidence} = observation;
      for (const [key, value] of [['points', pointId], ['queries', queryId], ['businesses', businessId]]) requireValue(protocol[key].some(x => x.id === value), `Unknown ${key} reference`);
      const id = JSON.stringify([pointId, queryId, businessId]); requireValue(!seen.has(id), 'Duplicate point/query/business observation'); seen.add(id);
      requireValue(['found', 'not_found', 'missing'].includes(status), 'Invalid observation status');
      requireValue(status === 'found' ? Number.isInteger(rank) && rank > 0 && rank <= protocol.resultDepth : rank === null, 'Invalid rank/status combination');
      requireValue(status === 'missing' || typeof evidence === 'string' && evidence.trim(), 'Observed results need evidence reference');
    }
    const metrics = protocol.queries.flatMap(q => protocol.businesses.map(b => {
      const rows = run.observations.filter(r => r.queryId === q.id && r.businessId === b.id);
      const observed = rows.filter(r => r.status !== 'missing'), ranked = observed.filter(r => r.status === 'found');
      const top3 = ranked.filter(r => r.rank <= 3).length;
      return {queryId: q.id, businessId: b.id, expectedPoints: protocol.points.length, observedPoints: observed.length,
        missingPoints: protocol.points.length - observed.length, top3Points: top3,
        top3Share: observed.length ? top3 / observed.length : null,
        meanRankAmongFound: ranked.length ? ranked.reduce((sum, r) => sum + r.rank, 0) / ranked.length : null,
        notFoundWithinDepth: observed.filter(r => r.status === 'not_found').length};
    }));
    return {id: run.id, observedAt: run.observedAt, metrics};
  }).sort((a,b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const comparisons = [];
  for (let i = 1; i < summaries.length; i++) for (const current of summaries[i].metrics) {
    const previous = summaries[i-1].metrics.find(m => m.queryId === current.queryId && m.businessId === current.businessId);
    const complete = !current.missingPoints && !previous.missingPoints;
    comparisons.push({from: summaries[i-1].id, to: summaries[i].id, queryId: current.queryId, businessId: current.businessId,
      comparable: complete, top3PercentagePointChange: complete ? (current.top3Share - previous.top3Share) * 100 : null,
      note: complete ? 'Same protocol and complete grid; observational, not causal.' : 'Incomplete grid: no change claimed.'});
  }
  return {status: summaries.length ? 'observations recorded' : 'not measured', protocolHash: signature, runs: summaries, comparisons};
}
