#!/usr/bin/env node
'use strict';
const fs=require('node:fs');const path=require('node:path');
const {snapshot,emptyTree,git}=require('./git');const {fingerprint}=require('./policy');const {request}=require('./client');
async function gate(lines,{cwd,remote,baseUrl,token,send=request}){
  const updates=lines.trim().split('\n').filter(Boolean);if(!updates.length)throw new Error('No ref updates supplied');
  for(const line of updates){const parts=line.trim().split(/\s+/);if(parts.length!==4)throw new Error('Malformed pre-push input');const [localRef,localSha,remoteRef,remoteSha]=parts;
    if(!localRef.startsWith('refs/heads/')||!remoteRef.startsWith('refs/heads/')||/^0+$/.test(localSha))throw new Error('Branch deletion and non-branch pushes require a separate approved workflow');
    if(!/^[a-f0-9]{40,64}$/.test(remoteSha))throw new Error('Invalid remote object ID');
    const s=snapshot(cwd,{head:localSha,base:/^0+$/.test(remoteSha)?emptyTree(cwd):remoteSha,remote});
    const result=await send(baseUrl,token,'/v1/gate',{fingerprint:fingerprint(s)});
    if(result.allowed!==true || !Number.isFinite(result.expires) || result.expires<=Date.now())throw new Error(result.reason||'Push not approved');
  }
  return true;
}
async function main(){
  const [command,...args]=process.argv.slice(2);const cwd=process.cwd();const baseUrl=process.env.TRUSTGATE_URL||'http://127.0.0.1:4318';const token=process.env.TRUSTGATE_TOKEN;
  if(command==='gate'){await gate(fs.readFileSync(0,'utf8'),{cwd,remote:args[0]||'origin',baseUrl,token});console.log('TrustGate: approved exact push contents');}
  else if(command==='review'){const s=snapshot(cwd,{base:args[0],head:args[1]});console.log(JSON.stringify(await request(baseUrl,token,'/v1/reviews',{kind:'code',context:'Security engineer deciding whether this exact commit range may be pushed.',snapshot:s}),null,2));}
  else if(command==='check'){const s=snapshot(cwd,{base:args[0],head:args[1]});const result=await request(baseUrl,token,'/v1/gate',{fingerprint:fingerprint(s)});if(result.allowed!==true)throw new Error(result.reason);console.log('Approved');}
  else if(command==='install-hook'){
    let custom='';try{custom=git(cwd,['config','--get','core.hooksPath']);}catch{}if(custom)throw new Error('Existing core.hooksPath detected. Integrate the gate manually.');
    const dir=git(cwd,['rev-parse','--git-path','hooks']);const file=path.resolve(cwd,dir,'pre-push');fs.mkdirSync(path.dirname(file),{recursive:true});
    const quote=s=>"'"+s.replace(/'/g,"'\\''")+"'";
    fs.writeFileSync(file,`#!/bin/sh\nexec ${quote(process.execPath)} ${quote(__filename)} gate "$1"\n`,{flag:'wx',mode:0o755});console.log(`Installed ${file}. TRUSTGATE_TOKEN must be available in the Git process environment.`);
  }else throw new Error('Usage: cli.js review [base head] | gate [remote] | check [base head] | install-hook');
}
if(require.main===module)main().catch(e=>{console.error(`TrustGate: ${e.message}`);process.exitCode=1;});
module.exports={gate};
