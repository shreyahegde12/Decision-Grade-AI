'use strict';
const {execFileSync} = require('node:child_process');
const {createHash} = require('node:crypto');
function git(cwd,args,input){return execFileSync('git',['--no-pager',...args],{cwd,encoding:'utf8',input,maxBuffer:1000000,timeout:10000,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GIT_OPTIONAL_LOCKS:'0',GIT_NO_REPLACE_OBJECTS:'1'}}).trimEnd();}
function repoId(cwd,remote='origin'){const origin=git(cwd,['remote','get-url',remote]);return createHash('sha256').update(origin).digest('hex');}
function emptyTree(cwd){return git(cwd,['hash-object','-t','tree','--stdin'],'');}
function snapshot(cwd,{scope='commit',base,head,remote='origin'}={}){
  const repo=repoId(cwd,remote);head=head||git(cwd,['rev-parse','--verify','HEAD^{commit}']);
  if(!/^[a-f0-9]{40,64}$/.test(head))throw new Error('Invalid commit ID');
  git(cwd,['cat-file','-e',`${head}^{commit}`]);
  if(!base){try{base=git(cwd,['rev-parse','--verify','@{upstream}^{commit}']);}catch{base=emptyTree(cwd);}}
  if(!/^[a-f0-9]{40,64}$/.test(base))throw new Error('Invalid base ID');
  const args=['-c','diff.external=','diff','--no-ext-diff','--no-textconv','--binary','--no-color',base];
  if(scope==='commit')args.push(head);
  args.push('--');
  const diff=git(cwd,args);if(diff.length>500000)throw new Error('Change exceeds the 500 KB review limit; split it before review.');
  return {repo,base,head,scope,diff};
}
module.exports={git,repoId,emptyTree,snapshot};
