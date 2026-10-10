'use strict';
const http = require('node:http');
const {randomUUID,timingSafeEqual,createHash} = require('node:crypto');
const {openStore} = require('./store');
const {analyze} = require('./provider');
const {serveDashboard,permittedOrigin} = require('./dashboard');
const {text,requireValue,validateSnapshot,validateEvidence,fingerprint,decide,scan} = require('./policy');
function configuration(env=process.env) {
  const c = {host:env.HOST||'127.0.0.1',port:Number(env.PORT||4318),db:env.TRUSTGATE_DB||'./data/trustgate.sqlite',token:env.TRUSTGATE_TOKEN,reviewerToken:env.TRUSTGATE_REVIEWER_TOKEN,reviewerId:env.TRUSTGATE_REVIEWER_ID||'security-reviewer',hrKey:env.HR_API_KEY,harness:env.HR_HARNESS_ID,hrBase:env.HR_BASE_URL||'https://api.harnessrouter.ai',hrMode:env.HR_MODE||'cloud',demo:env.TRUSTGATE_ALLOW_DEMO==='true',production:env.NODE_ENV==='production'};
  if (!c.token || c.token.length<32 || !c.reviewerToken || c.reviewerToken.length<32 || c.token===c.reviewerToken) throw new Error('Set distinct TRUSTGATE_TOKEN and TRUSTGATE_REVIEWER_TOKEN, each at least 32 characters.');
  const u=new URL(c.hrBase); if(u.protocol!=='https:' && !(u.protocol==='http:' && ['127.0.0.1','localhost'].includes(u.hostname))) throw new Error('Provider requires HTTPS or loopback HTTP');
  if(c.production && (c.demo || !c.hrKey || !c.harness)) throw new Error('Production requires HarnessRouter credentials and demo mode disabled');
  return c;
}
function equal(a,b){ return timingSafeEqual(createHash('sha256').update(a).digest(),createHash('sha256').update(b).digest()); }
function publicReview(r){ const {payload,...rest}=r; return {...rest,context:payload.context,scope:payload.snapshot?.scope,snapshot:payload.snapshot,provenance:payload.kind==='demo'?'synthetic fixture':payload.kind==='report'?'user-imported report':'code snapshot',effectiveAction:r.resolution?.action||r.result?.decision?.action||'NOT_VERIFIED'}; }
async function createApp(config, provider=analyze) {
  const store = openStore(config.db); let active=0; let stopping=false; const workers=new Set(); const rate=new Map();
  async function work(job){
    try {
      let evidence=null; let providerError=null;
      const local=job.kind==='code'?scan(job.payload.snapshot.diff):[];
      if(job.kind==='demo') evidence=validateEvidence(job.payload.evidence);
      else if(local.some(f=>f.severity==='critical')) providerError='Critical local finding: external analysis skipped to avoid forwarding potential secrets.';
      else if(config.hrKey && config.harness) {
        try{evidence=await provider({kind:job.kind,context:job.payload.context,text:job.kind==='code'?job.payload.snapshot.diff:job.payload.reportText},config);}
        catch {providerError='Provider unavailable or returned invalid/ungrounded evidence. No automatic approval.';}
      } else providerError='HarnessRouter is not configured. No automatic approval.';
      if(job.kind==='report' && !evidence) {store.status(job.id,'failed',{error:providerError});return;}
      const decision=decide(evidence,{code:job.kind==='code',localFindings:local});
      store.transaction(()=>{store.status(job.id,'completed',{decision,evidence,localFindings:local,providerError});store.audit('policy','review.completed',job.id,{action:decision.action});});
    } catch {store.status(job.id,'failed',{error:'Review failed validation. No approval was issued.'});}
  }
  function tick(){
    if(stopping)return;
    while(active<2){const job=store.next();if(!job)break;store.status(job.id,'running');active++;const promise=work(job).finally(()=>{active--;workers.delete(promise);});workers.add(promise);}
  }
  const timer=setInterval(tick,100); timer.unref();
  const server=http.createServer(async(req,res)=>{
    const requestId=randomUUID();
    const send=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff','x-request-id':requestId});res.end(JSON.stringify(data));};
    try{
      const url=new URL(req.url,'http://localhost');
      if(serveDashboard(req,res,url.pathname))return;
      if(req.method==='GET' && url.pathname==='/healthz')return send(200,{status:'ok'});
      if(req.method==='GET' && url.pathname==='/readyz')return send(stopping?503:200,{status:stopping?'stopping':'ready',verificationMode:'Ezio report import; automated Ezio API not configured'});
      if(!permittedOrigin(req.headers.origin,config))return send(403,{error:'Browser origin is not permitted'});
      const auth=req.headers.authorization||''; const key=auth.startsWith('Bearer ')?auth.slice(7):'';
      const reviewer=equal(key,config.reviewerToken); if(!reviewer && !equal(key,config.token))return send(401,{error:'Unauthorized'});
      const actor=reviewer?config.reviewerId:'developer';
      const now=Date.now(); const bucket=rate.get(actor)||{at:now,n:0};if(now-bucket.at>60000){bucket.at=now;bucket.n=0;}bucket.n++;rate.set(actor,bucket);if(bucket.n>240)return send(429,{error:'Rate limit exceeded'});
      if(req.method==='GET' && url.pathname==='/v1/session')return send(200,{role:reviewer?'reviewer':'developer',actor,demoEnabled:!!config.demo&&!config.production,harnessConfigured:!!config.hrKey&&!!config.harness,verificationMode:'Ezio report import'});
      if(req.method==='GET' && url.pathname==='/v1/reviews'){
        const rows=store.db.prepare('SELECT id FROM reviews ORDER BY created DESC,rowid DESC LIMIT 50').all();
        return send(200,{reviews:rows.map(({id})=>{const r=publicReview(store.get(id));delete r.snapshot;if(r.result)r.result={decision:r.result.decision,error:r.result.error,providerError:r.result.providerError};return r;}),limit:50});
      }
      if(req.method==='GET' && url.pathname==='/v1/demo-fixtures'){
        if(!config.demo||config.production)return send(404,{error:'Synthetic demo mode disabled'});
        return send(200,{fixtures:['nuclear-energy','work-from-home','ev-market','agi-timelines'].map(name=>require('../fixtures/'+name+'.json'))});
      }
      let body={};
      if(req.method==='POST'){
        if(!String(req.headers['content-type']).startsWith('application/json'))return send(415,{error:'Expected application/json'});
        let bytes=0; const chunks=[];for await(const chunk of req){bytes+=chunk.length;if(bytes>1100000){send(413,{error:'Payload too large'});req.destroy();return;}chunks.push(chunk);}
        try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return send(400,{error:'Invalid JSON'});}
        requireValue(body && typeof body==='object' && !Array.isArray(body),'Expected object');
      }
      if(req.method==='POST' && url.pathname==='/v1/reviews'){
        requireValue(['code','report','demo'].includes(body.kind),'Invalid review kind');
        text(body.context,'decision context',3000);
        if(store.count()>=20)return send(429,{error:'Review queue full'});
        const payload={kind:body.kind,context:body.context};let fp=null;
        if(body.kind==='code'){payload.snapshot=validateSnapshot(body.snapshot);fp=fingerprint(payload.snapshot);}
        if(body.kind==='report')payload.reportText=text(body.reportText,'report text',500000);
        if(body.kind==='demo'){requireValue(config.demo && !config.production,'Synthetic demo mode disabled');payload.evidence=validateEvidence(body.evidence);}
        const id=randomUUID();store.transaction(()=>{store.add({id,fingerprint:fp,kind:body.kind,created:now,expires:now+15*60000,payload});store.audit(actor,'review.created',id,{kind:body.kind,fingerprint:fp});});
        return send(202,{id,status:'queued',fingerprint:fp});
      }
      const match=url.pathname.match(/^\/v1\/reviews\/([a-f0-9-]{36})(\/resolve)?$/);
      if(match){
        const job=store.get(match[1]);if(!job)return send(404,{error:'Review not found'});
        if(req.method==='GET' && !match[2])return send(200,publicReview(job));
        if(req.method==='POST' && match[2]){
          if(!reviewer)return send(403,{error:'Security reviewer role required'});
          requireValue(job.status==='completed' && job.result.decision.action==='ESCALATE' && !job.resolution,'Only unresolved escalations can be resolved');
          requireValue(job.expires>now,'Review expired; run again');
          requireValue(['APPROVE','BLOCK'].includes(body.action),'Invalid reviewer action');text(body.reason,'review reason',3000);requireValue(body.reason.trim().length>=20,'Explain the evidence reviewed in at least 20 characters');
          const resolution={action:body.action,reason:body.reason,actor,at:now};
          store.transaction(()=>{store.resolve(job.id,resolution);store.audit(actor,'review.resolved',job.id,resolution);});
          return send(200,publicReview(store.get(job.id)));
        }
      }
      if(req.method==='POST' && url.pathname==='/v1/gate'){
        requireValue(typeof body.fingerprint==='string' && /^[a-f0-9]{64}$/.test(body.fingerprint),'Invalid fingerprint');
        const job=store.latest(body.fingerprint); const action=job?.resolution?.action||job?.result?.decision?.action;
        const allowed=!!(job && job.status==='completed' && job.expires>now && job.payload.snapshot.scope==='commit' && action==='APPROVE');
        store.audit(actor,'gate.checked',job?.id||null,{fingerprint:body.fingerprint,allowed});
        return send(200,{allowed,reviewId:job?.id||null,expires:job?.expires||null,reason:allowed?'Exact commit range approved.':'No current approval for this exact commit range.'});
      }
      if(req.method==='GET' && url.pathname==='/v1/audit'){
        if(!reviewer)return send(403,{error:'Security reviewer role required'});
        return send(200,{events:store.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 100').all()});
      }
      send(404,{error:'Not found'});
    }catch(e){send(e.status||500,{error:e.status?e.message:'Internal error',requestId});}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;server.keepAliveTimeout=5000;
  return {server,store,async close(){stopping=true;clearInterval(timer);await new Promise(resolve=>server.close(resolve));await Promise.allSettled([...workers]);store.close();}};
}
if(require.main===module){
  (async()=>{const config=configuration();const app=await createApp(config);app.server.once('error',async e=>{console.error(`TrustGate could not listen on ${config.host}:${config.port} (${e.code}). Check port availability and local process permissions.`);await app.close();process.exitCode=1;});app.server.listen(config.port,config.host,()=>console.log(JSON.stringify({event:'listening',host:config.host,port:config.port,mode:config.production?'production':'development'})));const close=()=>app.close().then(()=>process.exit(0));process.once('SIGTERM',close);process.once('SIGINT',close);})().catch(e=>{console.error(e.message);process.exitCode=1;});
}
module.exports={configuration,createApp};
