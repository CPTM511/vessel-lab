import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const candidates=[process.env.GODOT_BIN,'/Applications/Godot.app/Contents/MacOS/Godot',path.join(os.homedir(),'Downloads/Godot.app/Contents/MacOS/Godot')].filter(Boolean);
let godot=candidates.find(p=>fs.existsSync(p));
if(!godot)for(const cmd of ['godot','godot4'])if(spawnSync(cmd,['--version'],{stdio:'ignore'}).status===0){godot=cmd;break;}
if(!godot)throw Error('Godot 4 is required. Set GODOT_BIN to the executable.');
const port=Number(process.env.ANATOMY_PORT||8785),base=`http://127.0.0.1:${port}`;
async function ready(){try{const s=await fetch(base+'/api/state',{signal:AbortSignal.timeout(800)}).then(r=>r.json());return ['anatomy-inspection','mechanics-development'].includes(s.stage);}catch{return false;}}
let server;
const alreadyReady=await ready();
if(alreadyReady){
 try{const f=await fetch(base+'/api/frame',{signal:AbortSignal.timeout(800)}).then(r=>r.json());if(f.image&&Date.now()-f.receivedAt<5000){console.log('The Godot preview is already running; reusing the existing window.');process.exit(0);}}catch{}
}
if(!alreadyReady){
 server=spawn(process.execPath,[path.join(root,'inspector.mjs')],{stdio:'inherit',cwd:root});
 for(let i=0;i<50&&!await ready();i++)await new Promise(r=>setTimeout(r,100));
 if(!await ready()){server.kill();throw Error('Inspection service did not start.');}
}
const compatibility=process.argv.includes('--compatibility');
const args=['--path',path.join(root,'godot'),'--rendering-method',compatibility?'gl_compatibility':'forward_plus'];
const app=spawn(godot,args,{cwd:root,stdio:'inherit',env:{...process.env,ANATOMY_URL:base}});
let stopping=false;
function stop(){if(stopping)return;stopping=true;app.kill();server?.kill();}
app.on('exit',stop);app.on('error',e=>{console.error(e.message);stop();process.exitCode=1;});
process.on('SIGINT',stop);process.on('SIGTERM',stop);
