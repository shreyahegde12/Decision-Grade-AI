'use strict';
// Run through Cursor's --extensionTestsPath with an isolated profile.
const vscode=require('vscode');const fs=require('node:fs');const path=require('node:path');const assert=require('node:assert/strict');
async function run(){
  const extension=vscode.extensions.getExtension('trustgate-local.trustgate');assert.ok(extension,'Extension must be discoverable');await extension.activate();assert.equal(extension.isActive,true);
  const commands=await vscode.commands.getCommands(true);for(const id of ['open','check','commit','import','token','demo'])assert.ok(commands.includes('trustgate.'+id),'Missing command '+id);
  await vscode.commands.executeCommand('trustgate.open');
  fs.writeFileSync(path.join(__dirname,'../data/extension-host-result.json'),JSON.stringify({status:'passed',checks:['Extension activated in Cursor','Six commands registered','Sidebar open command completed'],at:new Date().toISOString()},null,2));
}
module.exports={run};
