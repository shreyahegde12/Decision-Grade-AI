'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {createApp} = require('../src/server');
const {transport} = require('./transport');

async function setup(t, extra = {}) {
  const app = await createApp({db:':memory:',port:4318,token:'d'.repeat(40),reviewerToken:'r'.repeat(40),reviewerId:'Reviewer',demo:true,...extra});
  t.after(() => app.close());
  return {app, send:await transport(app.server)};
}
const headers = {authorization:'Bearer ' + 'd'.repeat(40),origin:'http://127.0.0.1:4318','content-type':'application/json'};

test('dashboard and allowlisted assets are served without exposing credentials', async t => {
  const {send} = await setup(t);
  const page = await send('/');
  assert.equal(page.status,200);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  const html = await page.text();
  assert.match(html,/Decision inspector/);
  assert.ok(!html.includes('d'.repeat(40)));
  assert.equal((await send('/dashboard/app.js')).status,200);
  assert.equal((await send('/dashboard/styles.css')).status,200);
  assert.notEqual((await send('/dashboard/../.env')).status,200);
});

test('same-origin dashboard still needs bearer authentication; foreign origins rejected', async t => {
  const {send} = await setup(t);
  assert.equal((await send('/v1/session',{headers:{origin:headers.origin}})).status,401);
  const response = await send('/v1/session',{headers});
  assert.equal(response.status,200);
  assert.equal((await response.json()).role,'developer');
  assert.equal((await send('/v1/session',{headers:{...headers,origin:'https://attacker.example'}})).status,403);
  assert.equal((await send('/v1/session',{headers:{...headers,origin:'http://localhost:4318'}})).status,200);
  assert.equal((await send('/v1/session',{headers:{...headers,origin:'http://localhost:9999'}})).status,403);
});

test('history returns recent summaries without raw code and retains reviewer authorization', async t => {
  const {app,send} = await setup(t);
  app.store.add({id:'12345678-1234-1234-1234-123456789012',fingerprint:'a'.repeat(64),kind:'code',created:Date.now(),expires:Date.now()+10000,payload:{kind:'code',context:'Review my change',snapshot:{scope:'commit',diff:'+private code'}}});
  const response = await send('/v1/reviews',{headers});
  const data = await response.json();
  assert.equal(data.reviews.length,1);
  assert.equal(data.reviews[0].context,'Review my change');
  assert.equal(data.reviews[0].effectiveAction,'NOT_VERIFIED');
  assert.ok(!JSON.stringify(data).includes('private code'));
  const auth = await send('/v1/session',{headers:{...headers,authorization:'Bearer '+'r'.repeat(40)}});
  assert.equal((await auth.json()).role,'reviewer');
  const resolution = await send('/v1/reviews/12345678-1234-1234-1234-123456789012/resolve',{method:'POST',headers,body:JSON.stringify({action:'APPROVE',reason:'Browser cannot grant itself reviewer authority.'})});
  assert.equal(resolution.status,403);
});

test('demo fixtures are authenticated, labeled, and unavailable with demo disabled', async t => {
  const {send} = await setup(t);
  assert.equal((await send('/v1/demo-fixtures')).status,401);
  const data = await (await send('/v1/demo-fixtures',{headers})).json();
  assert.equal(data.fixtures.length,4);
  assert.ok(data.fixtures.every(f => f.provenance.includes('synthetic')));
  const disabled = await setup(t,{demo:false});
  assert.equal((await disabled.send('/v1/demo-fixtures',{headers})).status,404);
});
