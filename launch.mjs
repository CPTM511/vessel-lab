import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const candidates=[process.env.GODOT_BIN,'/Applications/Godot.app/Contents/MacOS/Godot',path.join(os.homedir(),'Downloads/Godot.app/Contents/MacOS/Godot')].filter(Boolean);
let godot=candidates.find(p=>fs.existsSync(p));
if(!godot)for(const command of ['godot','godot4'])if(spawnSync(command,['--version'],{stdio:'ignore'}).status===0){godot=command;break;}
if(!godot){console.error('找不到 Godot。设置 GODOT_BIN 为 Godot 4 的可执行文件路径后重试。');process.exit(1);}
const base='http://127.0.0.1:8765';
async function ready(){try{const s=await fetch(base+'/api/state',{signal:AbortSignal.timeout(800)}).then(r=>r.json());return s.state?.version&&s.session;}catch{return false;}}
let server;
if(!await ready()){
 server=spawn(process.execPath,[path.join(root,'server.mjs')],{cwd:root,stdio:'inherit'});
 for(let i=0;i<50&&!await ready();i++)await new Promise(r=>setTimeout(r,100));
 if(!await ready()){server.kill();throw Error('本地控制器启动失败，请检查 8765 端口。');}
}
console.log('Vessel Lab 已启动。手动操作不调用模型；点击模型按钮才使用现有 ChatGPT 订阅。');
const app=spawn(godot,['--path',path.join(root,'godot')],{cwd:root,stdio:'inherit'});
const stop=()=>{app.kill();server?.kill();};
app.on('error',e=>{console.error(e.message);server?.kill();process.exitCode=1;});
app.on('exit',()=>server?.kill());
process.on('SIGINT',stop);process.on('SIGTERM',stop);
