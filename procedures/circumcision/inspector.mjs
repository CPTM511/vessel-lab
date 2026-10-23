import http from 'node:http';
import crypto from 'node:crypto';

// Geometry inspection only; this service deliberately exposes no autonomous procedure.
const modes=new Set(['covered','retracted','ventral','inner','outer','glans','protected']);
const port=Number(process.env.ANATOMY_PORT||8785);
const state={session:crypto.randomUUID(),revision:0,mode:'covered',retraction:0,stage:'anatomy-inspection',mechanicsEnabled:false};
let frame=null;const commands=new Map();
function respond(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
const server=http.createServer(async(req,res)=>{
 try{
  if(req.headers.host!==`127.0.0.1:${port}`&&req.headers.host!==`localhost:${port}`)return respond(res,403,{error:'Untrusted host'});
  if(req.headers.origin&&!['http://127.0.0.1:'+port,'http://localhost:'+port].includes(req.headers.origin))return respond(res,403,{error:'Untrusted origin'});
  if(req.method==='GET'&&req.url==='/api/state')return respond(res,200,state);
  if(req.method==='GET'&&req.url==='/api/frame')return respond(res,frame?200:503,frame??{error:'No actual Godot frame received'});
  if(req.method!=='POST')return respond(res,404,{error:'Unknown route'});
  let data='';for await(const chunk of req){data+=chunk;if(data.length>8_000_000)return respond(res,413,{error:'Request too large'});}
  let body;try{body=JSON.parse(data);}catch{return respond(res,400,{error:'Invalid JSON'});}
  if(!body||typeof body!=='object'||Array.isArray(body))return respond(res,400,{error:'Object required'});
  if(body.session!==state.session)return respond(res,409,{error:'Stale session'});
  if(req.url==='/api/inspect'){
   const key=body.commandId;
   if(typeof key!=='string'||!key||key.length>128)return respond(res,400,{error:'commandId required'});
   const digest=crypto.createHash('sha256').update(JSON.stringify(body)).digest('hex');
   if(commands.has(key)){const old=commands.get(key);return respond(res,old.digest===digest?200:409,old.digest===digest?old.state:{error:'Conflicting commandId'});}
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale revision'});
   if(body.mode!==undefined&&!modes.has(body.mode))return respond(res,400,{error:'Unknown inspection mode'});
   if(body.retraction!==undefined&&(!Number.isFinite(body.retraction)||body.retraction<0||body.retraction>1))return respond(res,400,{error:'Retraction morph must be in [0,1]'});
   if(body.mode===undefined&&body.retraction===undefined)return respond(res,400,{error:'No inspection change'});
   if(body.source!=='manual-inspection'&&body.source!=='scripted-inspection-test')return respond(res,400,{error:'Inspection source must be explicitly labeled'});
   if(body.mode!==undefined)state.mode=body.mode;
   if(body.retraction!==undefined)state.retraction=body.retraction;
   state.revision++;frame=null;commands.set(key,{digest,state:structuredClone(state)});
   if(commands.size>2000)commands.delete(commands.keys().next().value);
   return respond(res,200,state);
  }
  if(req.url==='/api/frame'){
   if(body.revision!==state.revision)return respond(res,409,{error:'Stale frame revision'});
   if(body.mode!==state.mode||body.retraction!==state.retraction)return respond(res,409,{error:'Frame inspection state mismatch'});
   if(!/^data:image\/jpeg;base64,/.test(body.image)||!/^data:image\/jpeg;base64,/.test(body.uiImage))return respond(res,400,{error:'Actual JPEG frames required'});
   frame={...body,receivedAt:Date.now(),imageHash:crypto.createHash('sha256').update(body.image).digest('hex')};
   return respond(res,200,{accepted:true});
  }
  return respond(res,404,{error:'Unknown route'});
 }catch(e){respond(res,500,{error:e.message});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Adult anatomy inspection service: http://127.0.0.1:${port}`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
