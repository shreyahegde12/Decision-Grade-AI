'use strict';
const vscode=require('vscode');const {randomBytes}=require('node:crypto');const fs=require('node:fs');const path=require('node:path');const {execFile}=require('node:child_process');const {promisify}=require('node:util');
const {snapshot}=require('./lib/git');const {fingerprint}=require('./lib/policy');const {request}=require('./lib/client');const {html}=require('./view');
function activate(context){
  let view,timer,busy=false,generation=0,lastFingerprint,review,error='',stale=false,disposed=false;
  const config=()=>vscode.workspace.getConfiguration('trustgate');
  const status=vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right,100);status.command='trustgate.open';status.show();
  const output=vscode.window.createOutputChannel('TrustGate');context.subscriptions.push(status,output);
  function render(){status.text='$(shield) '+(busy?'Checking…':stale?'TrustGate: stale':review?.effectiveAction||'TrustGate: not verified');status.tooltip=review?.result?.decision?.reasons.map(x=>x.message).join('\n')||'Open TrustGate security review';view?.webview.postMessage({type:'state',busy,stale,review,error});}
  async function api(route,body){return request(config().get('backendUrl'),await context.secrets.get('trustgate.token'),route,body);}
  async function workspace(){if(!vscode.workspace.isTrusted)throw new Error('Trust this workspace before scanning');const folders=vscode.workspace.workspaceFolders;if(!folders?.length)throw new Error('Open a Git workspace first');if(folders.length>1)throw new Error('Open one repository folder for TrustGate v1');return folders[0].uri.fsPath;}
  async function poll(id,gen){for(let i=0;i<120&&!disposed;i++){const r=await api('/v1/reviews/'+id);review=r;stale=generation!==gen;render();if(['completed','failed'].includes(r.status))return;await new Promise(r=>setTimeout(r,1000));}throw new Error('Review is still running or editor closed; check again.');}
  async function check(scope='preview',automatic=false){
    if(busy)return;const cwd=await workspace();if(vscode.workspace.textDocuments.some(d=>d.isDirty && d.uri.scheme==='file'))throw new Error('Save open files first. Unsaved buffers are not included.');
    const s=snapshot(cwd,{scope});const fp=fingerprint(s);if(automatic && fp===lastFingerprint && review?.expires>Date.now())return;
    busy=true;error='';const gen=generation;render();
    try{const job=await api('/v1/reviews',{kind:'code',context:'Security engineer deciding whether this exact code change is ready to push to origin. Inspect security risks, missing checks and evidence.',snapshot:s});await poll(job.id,gen);if(review?.status==='completed')lastFingerprint=fp;}finally{busy=false;render();}
  }
  async function importReport(){
    const files=await vscode.window.showOpenDialog({canSelectMany:false,filters:{'Ezio report':['pdf','txt','md']}});if(!files)return;
    const decisionContext=await vscode.window.showInputBox({title:'Who relies on this answer, and what decision will they make?',prompt:'Example: A communications lead deciding whether to publish the work-from-home answer.'});if(!decisionContext?.trim())return;
    if(fs.statSync(files[0].fsPath).size>10000000)throw new Error('Report exceeds 10 MB');
    let reportText;
    if(path.extname(files[0].fsPath).toLowerCase()==='.pdf'){
      try{const python=config().get('pythonPath')||(process.platform==='win32'?'python':'python3');const r=await promisify(execFile)(python,[path.join(__dirname,'extract_pdf.py'),files[0].fsPath],{timeout:15000,maxBuffer:1000000});reportText=r.stdout;}catch{throw new Error('PDF extraction needs Python 3 and pypdf. Set trustgate.pythonPath for your interpreter, or import plain text.');}
    }else reportText=fs.readFileSync(files[0].fsPath,'utf8');
    busy=true;error='';stale=false;const gen=generation;render();try{const job=await api('/v1/reviews',{kind:'report',context:decisionContext,reportText});await poll(job.id,gen);}finally{busy=false;render();}
  }
  async function resolve(action){if(!review||stale)return;const reason=await vscode.window.showInputBox({title:action==='APPROVE'?'Document your security risk acceptance':'Explain why this change is rejected',prompt:'Record what evidence you reviewed. This decision is audited.',validateInput:s=>s.trim().length<20?'Use at least 20 characters.':undefined});if(!reason)return;review=await api('/v1/reviews/'+review.id+'/resolve',{action,reason});render();}
  async function demo(){const entries=fs.readdirSync(path.join(__dirname,'fixtures')).filter(f=>f.endsWith('.json')).map(f=>({label:f.replace('.json','')+' (SYNTHETIC)',file:f}));const chosen=await vscode.window.showQuickPick(entries,{title:'Synthetic policy rehearsal — not real Ezio reports'});if(!chosen)return;const fixture=JSON.parse(fs.readFileSync(path.join(__dirname,'fixtures',chosen.file),'utf8'));busy=true;error='';stale=false;render();try{const job=await api('/v1/reviews',{kind:'demo',context:'Synthetic rehearsal: assess whether this report supports publication.',evidence:fixture.evidence});await poll(job.id,generation);}finally{busy=false;render();}}
  async function setToken(){const token=await vscode.window.showInputBox({title:'TrustGate API token',password:true,ignoreFocusOut:true,prompt:'Stored in your editor’s SecretStorage. Provider keys stay on the backend.'});if(token){await context.secrets.store('trustgate.token',token);error='';render();}}
  const actions={check:()=>check(),commit:()=>check('commit'),import:importReport,approve:()=>resolve('APPROVE'),reject:()=>resolve('BLOCK'),token:setToken,ready:async()=>render()};
  async function run(fn){try{await fn();}catch(e){error=e.message;output.appendLine(error);render();vscode.window.showErrorMessage('TrustGate: '+error);}}
  context.subscriptions.push(vscode.window.registerWebviewViewProvider('trustgate.review',{resolveWebviewView(v){view=v;v.webview.options={enableScripts:true,localResourceRoots:[]};v.webview.html=html(randomBytes(16).toString('hex'));v.webview.onDidReceiveMessage(m=>{if(m&&typeof m.command==='string'&&Object.hasOwn(actions,m.command))run(actions[m.command]);},undefined,context.subscriptions);render();}}));
  for(const [id,fn] of Object.entries({open:()=>vscode.commands.executeCommand('workbench.view.extension.trustgate'),check:actions.check,commit:actions.commit,import:actions.import,demo,token:setToken}))context.subscriptions.push(vscode.commands.registerCommand('trustgate.'+id,()=>run(fn)));
  function invalidate(){generation++;if(review?.kind==='code')stale=true;render();}
  context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(invalidate));
  const watcher=vscode.workspace.createFileSystemWatcher('**/*');context.subscriptions.push(watcher,watcher.onDidChange(invalidate),watcher.onDidCreate(invalidate),watcher.onDidDelete(invalidate));
  const expiryTimer=setInterval(()=>{if(review && !stale && Date.now()>review.expires){stale=true;render();}},1000);
  function schedule(){clearInterval(timer);timer=setInterval(()=>{if(config().get('autoCheck') && !busy)run(()=>check('preview',true));},config().get('intervalSeconds',180)*1000);}
  context.subscriptions.push(vscode.workspace.onDidChangeConfiguration(e=>{if(e.affectsConfiguration('trustgate')){lastFingerprint=null;invalidate();schedule();}}),{dispose(){disposed=true;clearInterval(timer);clearInterval(expiryTimer);}});schedule();render();
}
module.exports={activate};
