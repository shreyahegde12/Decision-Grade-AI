'use strict';
// Offline policy demonstration; intentionally synthetic, not an Ezio run.
const fs=require('node:fs');const path=require('node:path');const {validateEvidence,decide}=require('../src/policy');
console.log('TrustGate — SYNTHETIC policy demonstration (no live Ezio or HarnessRouter calls)\n');
for(const file of fs.readdirSync(path.join(__dirname,'../fixtures')).filter(f=>f.endsWith('.json'))){const f=JSON.parse(fs.readFileSync(path.join(__dirname,'../fixtures',file)));const d=decide(validateEvidence(f.evidence));console.log(`${f.name}: ${d.action} / ${d.trust}`);for(const r of d.reasons)console.log(`  [${r.evidenceId}] ${r.message}`);console.log();}
