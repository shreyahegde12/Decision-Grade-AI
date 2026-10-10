'use strict';
const fs=require('node:fs');const path=require('node:path');const {randomBytes}=require('node:crypto');
const root=path.resolve(__dirname,'..');const env=path.join(root,'.env');
if(fs.existsSync(env)){console.log('.env already exists; left it unchanged.');}
else{fs.writeFileSync(env,[
  'HOST=127.0.0.1','PORT=4318','NODE_ENV=development',
  `TRUSTGATE_TOKEN=${randomBytes(32).toString('hex')}`,
  `TRUSTGATE_REVIEWER_TOKEN=${randomBytes(32).toString('hex')}`,
  'TRUSTGATE_REVIEWER_ID=local-security-reviewer','TRUSTGATE_DB=./data/trustgate.sqlite',
  'HR_API_KEY=','HR_HARNESS_ID=','HR_BASE_URL=https://api.harnessrouter.ai','HR_MODE=cloud','TRUSTGATE_ALLOW_DEMO=true',''
].join('\n'),{flag:'wx',mode:0o600});console.log('Created private .env with distinct random developer and reviewer credentials. No secrets printed.');}
console.log('Next: configure HarnessRouter in .env, run npm start, and install dist/trustgate-0.2.0.vsix in your preferred VS Code-compatible editor.');
