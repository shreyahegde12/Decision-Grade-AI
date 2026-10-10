'use strict';
function validateUrl(base){const u=new URL(base);if(u.username||u.password||u.search||u.hash)throw new Error('Invalid backend URL');if(u.protocol!=='https:' && !(u.protocol==='http:' && ['localhost','127.0.0.1','[::1]'].includes(u.hostname)))throw new Error('Backend requires HTTPS unless on loopback');return u.toString().replace(/\/$/,'');}
async function request(base,token,path,body){
  if(!token)throw new Error('Configure a TrustGate API token first');
  const r=await fetch(validateUrl(base)+path,{method:body?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(15000),headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});
  const data=await r.json();if(!r.ok)throw new Error(data.error||`Request failed: ${r.status}`);return data;
}
module.exports={request,validateUrl};
