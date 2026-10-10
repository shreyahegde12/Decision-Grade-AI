'use strict';
const crypto = require('node:crypto');
const POLICY_VERSION = '2026-10-10.1';
function requireValue(ok, message) { if (!ok) { const e = new Error(message); e.status = 400; throw e; } }
function text(v, name, max = 10000) { requireValue(typeof v === 'string' && v.trim().length > 0 && v.length <= max, `Invalid ${name}`); return v; }
function datedOfficial(s) { const time=Date.parse(s.date); return s.type==='official' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && Number.isFinite(time) && new Date(time).toISOString().slice(0,10)===s.date && time<=Date.now(); }
function fingerprint(s) { return crypto.createHash('sha256').update(JSON.stringify([s.repo, s.base, s.head, s.scope, s.diff])).digest('hex'); }
function validateSnapshot(s) {
  requireValue(s && typeof s === 'object', 'Missing snapshot');
  requireValue(/^[a-f0-9]{64}$/.test(s.repo), 'Invalid repository identity');
  requireValue(/^[a-f0-9]{40,64}$/.test(s.base) && /^[a-f0-9]{40,64}$/.test(s.head), 'Invalid Git objects');
  requireValue(['preview', 'commit'].includes(s.scope), 'Invalid scope');
  requireValue(typeof s.diff === 'string' && s.diff.length <= 500000, 'Diff exceeds 500 KB limit');
  return {repo:s.repo, base:s.base, head:s.head, scope:s.scope, diff:s.diff};
}
function validateEvidence(e, reportText) {
  requireValue(e && typeof e === 'object', 'Missing evidence');
  requireValue(Array.isArray(e.claims) && e.claims.length > 0 && e.claims.length <= 100, 'Expected 1–100 claims');
  requireValue(Array.isArray(e.findings) && e.findings.length <= 100, 'Invalid findings');
  requireValue(e.scores && ['accuracy','bias','tone','agreement'].every(k => Number.isInteger(e.scores[k]) && e.scores[k] >= 0 && e.scores[k] <= 5), 'Module scores must be integers from 0 to 5');
  requireValue(typeof e.coverageComplete === 'boolean' && Array.isArray(e.limitations) && e.limitations.length <= 30, 'Invalid coverage');
  const ids = new Set();
  const anchor = item => { text(item.id, 'evidence ID', 80); requireValue(!ids.has(item.id), 'Duplicate evidence ID'); ids.add(item.id); text(item.quote, 'evidence quote', 3000); if (reportText) requireValue(reportText.includes(item.quote), 'Evidence quote not found in original report'); };
  for (const c of e.claims) {
    anchor(c); text(c.text, 'claim', 3000);
    requireValue(['supported','contradicted','unverified'].includes(c.verdict), 'Invalid claim verdict');
    requireValue(typeof c.material === 'boolean', 'Claim relevance missing');
    requireValue(Array.isArray(c.sources) && c.sources.length <= 20, 'Invalid source list');
    for (const s of c.sources) { text(s.title,'source title',1000); requireValue(['official','news','other'].includes(s.type), 'Invalid source type'); text(s.date,'source date',100); }
  }
  for (const f of e.findings) { anchor(f); requireValue(['note','critical'].includes(f.severity), 'Invalid finding severity'); text(f.reason,'finding reason',3000); }
  e.limitations.forEach(v => text(v,'limitation',3000));
  return e;
}
function decide(e, {code = false, localFindings = []} = {}) {
  const reasons = []; let blocked = false; let uncertain = false;
  function reason(id, message, action) { reasons.push({evidenceId:id, message}); if (action === 'block') blocked = true; if (action === 'hold') uncertain = true; }
  for (const f of localFindings) reason(f.id, f.reason, f.severity === 'critical' ? 'block' : 'hold');
  if (!e) reason('verification', 'Independent verification is unavailable. A security reviewer must inspect this exact change.', 'hold');
  else {
    for (const c of e.claims.filter(c => c.material)) {
      if (c.verdict === 'contradicted') reason(c.id, `Material claim contradicted: ${c.text}`, 'block');
      else if (c.verdict === 'unverified') reason(c.id, `Evidence missing: ${c.text}`, 'hold');
      else if (!c.sources.some(datedOfficial)) reason(c.id, `Supported claim lacks a valid, non-future dated official source: ${c.text}`, 'hold');
      else reason(c.id, `Supported by a dated official source: ${c.text}`);
    }
    for (const f of e.findings) reason(f.id, f.reason, f.severity === 'critical' ? 'block' : 'hold');
    if (!e.claims.some(c => c.material)) reason('coverage', 'No decision-relevant claims were identified.', 'hold');
    if (!e.coverageComplete || e.limitations.length) reason('coverage', `Coverage gaps: ${e.limitations.join('; ') || 'Report does not cover the whole decision.'}`, 'hold');
    for (const [k,v] of Object.entries(e.scores)) if (v < 3) reason(`score:${k}`, `${k} is ${v}/5.`, 'hold');
  }
  if (code) reason('scope', 'Code review requires independent security verification or explicit reviewer risk acceptance. General reports cannot authorize code.', 'hold');
  const action = blocked ? 'BLOCK' : uncertain ? 'ESCALATE' : 'APPROVE';
  const score = e ? Math.round((e.claims.filter(c=>c.verdict==='supported').length / e.claims.length) * 100) : null;
  return {action, trust:blocked?'low':uncertain?'medium':'high', score, scoreLabel:'Supported claims (%) — not probability of security', reasons, policyVersion:POLICY_VERSION, nextStep:blocked?'Fix the blocking evidence and run a new review.':uncertain?'Ask the accountable reviewer to inspect the evidence and record a decision.':'Approved for this specific decision and scope.'};
}
function scan(diff) {
  const findings = []; let n = 0;
  for (const line of diff.split('\n')) {
    if (!line.startsWith('+') || line.startsWith('+++')) continue;
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bAKIA[0-9A-Z]{16}\b/.test(line)) findings.push({id:`local:${++n}`,severity:'critical',reason:'An added line contains a private-key marker or AWS access-key pattern. Remove it and rotate if exposed.'});
    else if (/\b(?:eval|exec)\s*\(|shell\s*[:=]\s*(?:true|True)|verify\s*=\s*False|rejectUnauthorized\s*:\s*false/.test(line)) findings.push({id:`local:${++n}`,severity:'note',reason:'An added line contains a potentially dangerous execution or TLS setting; contextual review is required.'});
  }
  return findings.slice(0,100);
}
module.exports = {POLICY_VERSION, requireValue, text, fingerprint, validateSnapshot, validateEvidence, decide, scan};
