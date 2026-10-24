import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';

// One local controller process group owns one revocable action lease.
export class ControllerLease{
 constructor(root,base){this.root=root;this.base=base;this.process=null;this.token=null;this.info={running:false,phase:'idle'};}
 get running(){return this.process!==null;}
 snapshot(){return {...this.info,running:this.running};}
 authorized(req){return !!this.token&&req.headers['x-anatomy-controller-token']===this.token;}
 start(task,episode){
  if(this.running)throw Error('Stop the current controller first');
  if(!['loop','procedure'].includes(task))throw Error('Unknown controller task');
  const runId=new Date().toISOString().replaceAll(':','-')+'-'+crypto.randomBytes(4).toString('hex');
  const dir=path.join(this.root,'sessions',runId);fs.mkdirSync(dir,{recursive:false});
  this.token=crypto.randomBytes(32).toString('hex');this.info={running:true,phase:'starting',task,model:'gpt-6-astra',episode,runId};
  const fd=fs.openSync(path.join(dir,'process.log'),'a');
  const child=spawn(process.execPath,[path.join(this.root,'agent.mjs'),task],{cwd:this.root,detached:true,env:{...process.env,ANATOMY_URL:this.base,ANATOMY_CONTROLLER_TOKEN:this.token,ANATOMY_RUN_DIR:dir,ANATOMY_EPISODE:episode},stdio:['ignore',fd,fd]});
  fs.closeSync(fd);this.process=child;
  child.on('error',e=>{if(this.process===child){this.process=null;this.token=null;this.info={...this.info,phase:'error',error:e.message};}});
  child.on('exit',(code,signal)=>{if(this.process===child){this.process=null;this.token=null;this.info={...this.info,phase:this.info.phase==='stopping'?'stopped':this.info.phase==='done'?'done':'error',exitCode:code,signal};}});
  return this.snapshot();
 }
 update(update){
  const allowed=['phase','error','toolCount','moves','images','reasoningEffort'];
  for(const k of allowed)if(update[k]!==undefined)this.info[k]=update[k];
 }
 stop(){
  const child=this.process;this.token=null;
  if(!child){this.info={...this.info,phase:'stopped'};return false;}
  this.info={...this.info,phase:'stopping'};
  try{process.kill(-child.pid,'SIGTERM');}catch{child.kill('SIGTERM');}
  const timer=setTimeout(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}},2000);timer.unref();
  return true;
 }
}
