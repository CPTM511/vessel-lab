// Deterministic synthetic shell manipulation. This is not calibrated living tissue.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {defineTask,areaAccounting} from './task-definition.mjs';
import {evaluate,recordIntegrity,releasedCondition} from './evaluation.mjs';
import {planAttachment,solveAttachment,invalidateAttachments,attachmentPoint} from './attachments.mjs';
import {CUT_RADIUS_MM,sweptFaces,buildSupports,updateTopology} from './cutting.mjs';
import {CONTACT_GAP_MM,filterShellMotion,projectShellContacts} from './contact.mjs';
export const cage=JSON.parse(fs.readFileSync(new URL('godot/data/tissue-rest.json',import.meta.url)));
export const cageHash=crypto.createHash('sha256').update(fs.readFileSync(new URL('godot/data/tissue-rest.json',import.meta.url))).digest('hex');
if(cage.anatomySourceSha256!==crypto.createHash('sha256').update(fs.readFileSync(new URL('godot/anatomy.gd',import.meta.url))).digest('hex'))throw Error('Shared anatomy export is stale. Run godot/export_physics.gd before mechanics.');
export const add=(a,b)=>a.length===3?[a[0]+b[0],a[1]+b[1],a[2]+b[2]]:a.map((x,i)=>x+b[i]);
export const sub=(a,b)=>a.length===3?[a[0]-b[0],a[1]-b[1],a[2]-b[2]]:a.map((x,i)=>x-b[i]);
export const mul=(a,s)=>a.length===3?[a[0]*s,a[1]*s,a[2]*s]:a.map(x=>x*s);
export const dot=(a,b)=>a.length===3?a[0]*b[0]+a[1]*b[1]+a[2]*b[2]:a.reduce((s,x,i)=>s+x*b[i],0);
export const length=a=>Math.hypot(...a);
export const distance=(a,b)=>length(sub(a,b));
const clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const copy=x=>structuredClone(x);
const mix=(a,b,t)=>add(a,mul(sub(b,a),t));
function closestSegment(p,a,b){const d=sub(b,a),t=clamp(dot(sub(p,a),d)/Math.max(1e-12,dot(d,d)),0,1);return {p:add(a,mul(d,t)),t};}
function cross(a,b){return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];}
function closestTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return {p:a,w:[1,0,0]};
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);if(d3>=0&&d4<=d3)return {p:b,w:[0,1,0]};
 const vc=d1*d4-d3*d2;if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return {p:add(a,mul(ab,v)),w:[1-v,v,0]};}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);if(d6>=0&&d5<=d6)return {p:c,w:[0,0,1]};
 const vb=d5*d2-d1*d6;if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return {p:add(a,mul(ac,w)),w:[1-w,0,w]};}
 const va=d3*d6-d5*d4;if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return {p:mix(b,c,w),w:[0,1-w,w]};}
 const den=1/(va+vb+vc),v=vb*den,w=vc*den;return {p:add(a,add(mul(ab,v),mul(ac,w))),w:[1-v-w,v,w]};
}
export function eulerQuaternion(degrees){
 const [x,y,z]=degrees.map(v=>v*Math.PI/360),cx=Math.cos(x),sx=Math.sin(x),cy=Math.cos(y),sy=Math.sin(y),cz=Math.cos(z),sz=Math.sin(z);
 return [sx*cy*cz-cx*sy*sz,cx*sy*cz+sx*cy*sz,cx*cy*sz-sx*sy*cz,cx*cy*cz+sx*sy*sz];
}
function quatAngle(a,b){return 2*Math.acos(clamp(Math.abs(dot(a,b)),0,1))*180/Math.PI;}
function quatMix(a,b,t){let b1=b;if(dot(a,b)<0)b1=mul(b,-1);const q=mix(a,b1,t);return mul(q,1/length(q));}
export function rotate(q,p){const u=q.slice(0,3),t=mul(cross(u,p),2);return add(p,add(mul(t,q[3]),cross(u,t)));}

// Signed distance to a sampled glans cross-section, with conservative end caps.
// The exact sampled sections originate from the same Godot geometry as the view.
export function glansQuery(p,scale=1){
 const v=mul(p,1/scale),xmin=-9.5,xmax=23,xc=clamp(v[0],xmin,xmax),f=(xc-xmin)/(xmax-xmin)*80,k=Math.min(79,Math.floor(f)),t=f-k;
 // Interpolate the same exported YZ polygon directly, avoiding temporary
 // 3D vectors for each edge of every tissue-node hull query.
 let inside=false,best=Infinity,closestY=0,closestZ=0,closestDy=0,closestDz=1;
 const sections=cage.glansSections,low=sections[k],high=sections[k+1];
 let ay=low[0][1]+(high[0][1]-low[0][1])*t,az=low[0][2]+(high[0][2]-low[0][2])*t;
 for(let j=0;j<cage.angular;j++){
  const next=(j+1)%cage.angular,by=low[next][1]+(high[next][1]-low[next][1])*t,bz=low[next][2]+(high[next][2]-low[next][2])*t;
  if((az>v[2])!==(bz>v[2])&&v[1]<(by-ay)*(v[2]-az)/(bz-az)+ay)inside=!inside;
  const dy=by-ay,dz=bz-az,u=clamp(((v[1]-ay)*dy+(v[2]-az)*dz)/Math.max(1e-12,dy*dy+dz*dz),0,1),cy=ay+dy*u,cz=az+dz*u;
  const d=Math.hypot(v[1]-cy,v[2]-cz);if(d<best){best=d;closestY=cy;closestZ=cz;closestDy=dy;closestDz=dz;}
  ay=by;az=bz;
 }
 const inverse=1/Math.max(best,1e-9);
 let n=[0,(inside?closestY-v[1]:v[1]-closestY)*inverse,(inside?closestZ-v[2]:v[2]-closestZ)*inverse];
 let d=inside?-best:best;
 if(v[0]<xmin||v[0]>xmax){const axial=Math.abs(v[0]-xc);d=inside?axial:Math.hypot(axial,best);n=[Math.sign(v[0]-xc),0,0];}
 else if(inside&&Math.min(v[0]-xmin,xmax-v[0])<best){d=-Math.min(v[0]-xmin,xmax-v[0]);n=[v[0]-xmin<xmax-v[0]?-1:1,0,0];}
 if(best<1e-9){const l=Math.max(1e-12,Math.hypot(closestDy,closestDz));n=v[0]>=xmax?[1,0,0]:v[0]<=xmin?[-1,0,0]:[0,closestDz/l,-closestDy/l];}
 return {distance:d*scale,normal:n,structure:'glans'};
}
function capsuleQuery(p,a,b,r,name){const cp=closestSegment(p,a,b).p,d=sub(p,cp),l=length(d);return {distance:l-r,normal:l>1e-9?mul(d,1/l):[0,1,0],structure:name};}
// Unit support-plane residuals are conservative distance lower bounds outside
// a convex exclusion envelope. They deliberately include some adjacent space.
const protectedPlanes=Object.fromEntries(Object.entries(cage.protectedHulls).map(([name,hull])=>[name,hull.planes.map(p=>{const l=Math.hypot(p[0],p[1],p[2]);return p.map(v=>v/l);})]));
const protectedBoxes=Object.fromEntries(Object.entries(protectedPlanes).map(([name,planes])=>[name,planes.filter(p=>p.slice(0,3).filter(v=>v===0).length===2)]));
function envelopeQuery(p,name,structure){
 let best=-Infinity,normal=null;
 // Outside the enclosing axis box by more than every interaction radius,
 // its lower bound is sufficient; avoid the full envelope in distant queries.
 for(const plane of protectedBoxes[name]){const d=plane[0]*p[0]+plane[1]*p[1]+plane[2]*p[2]-plane[3];if(d>best){best=d;normal=plane;}}
 if(best>4)return {distance:best,normal:normal.slice(0,3),structure};
 for(const plane of protectedPlanes[name]){const d=plane[0]*p[0]+plane[1]*p[1]+plane[2]*p[2]-plane[3];if(d>best){best=d;normal=plane;}}
 return {distance:best,normal:normal.slice(0,3),structure};
}
export function protectedQueries(p,scale=1){
 const v=mul(p,1/scale);
 const urethra=capsuleQuery(v,[-72,-5.7,0],[-1,-5.7,0],1.2,'urethra');
 const distal=capsuleQuery(v,[-1,-5.7,0],[22.6,.3,0],1.2,'urethra');
 const frenulum=capsuleQuery(v,[-10.8,-10.4,0],[9,-10.2,0],1.15,'frenulum');
 // Keep the earlier capsules as well as the newly exported visible-surface
 // envelopes; the anatomical correction never removes an existing exclusion.
 const meatus=envelopeQuery(v,'meatus','urethra'),web=envelopeQuery(v,'frenulum','frenulum');
 const urethral=[urethra,distal,meatus].reduce((a,b)=>a.distance<b.distance?a:b);
 const frenular=web.distance<frenulum.distance?web:frenulum;
 const sampledGlans=glansQuery(p,scale),glansEnvelope=envelopeQuery(v,'glans','glans');
 const glans=glansEnvelope.distance*scale<sampledGlans.distance?{...glansEnvelope,distance:glansEnvelope.distance*scale}:sampledGlans;
 return [glans,...[urethral,frenular].map(q=>({...q,distance:q.distance*scale}))];
}

export class TissueSim{
 constructor(seed=11){this.reset(seed);}
 idx(layer,ring,j){return layer*(cage.axial+1)*cage.angular+ring*cage.angular+(j+cage.angular)%cage.angular;}
 reset(seed=11){
  if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Seed must be an unsigned 32-bit integer');
  this.seed=seed;let r=(Math.imul(seed,1664525)+1013904223)>>>0;this.scale=.99+(r/2**32)*.02;
  this.revision=0;this.time=0;this.events=[];this.protectedContacts=[];this.cutHistory=[];this.attachments=[];this.invalidFaces=new Set();this.releaseSeconds=0;this.terminal=null;this.lastEvaluation=null;
  this.contactStats={contacts:0,rigidContacts:0,limitedSubsteps:0,lastAdvance:1};this.contactCache={};
  this.task=defineTask(cage,this.scale);
  this.nodes=cage.nodes.map(n=>({...n,rest:mul(n.rest,this.scale),p:mul(n.rest,this.scale),velocity:[0,0,0],inv:n.fixed?0:1}));
  this.faces=cage.faces.map(f=>({...f,nodes:[...f.nodes],active:true}));
  this.arms={left:{position:[26,16,8],rotationDeg:[0,0,0],quaternion:[0,0,0,1],jaw:1,grasp:null,cutting:false},right:{position:[26,16,-8],rotationDeg:[0,0,0],quaternion:[0,0,0,1],jaw:1,grasp:null,cutting:false}};
  this.edges=[];const edgeKeys=new Set();
  const edge=(a,b,compliance,kind)=>{const key=a<b?a+':'+b:b+':'+a;if(edgeKeys.has(key))return;edgeKeys.add(key);this.edges.push({a,b,rest:distance(this.nodes[a].p,this.nodes[b].p),compliance,kind,lambda:0});};
  for(let layer=0;layer<2;layer++)for(let i=0;i<=cage.axial;i++)for(let j=0;j<cage.angular;j++){
   const a=this.idx(layer,i,j);edge(a,this.idx(layer,i,j+1),.00008,'circumferential');
   if(i<cage.axial){edge(a,this.idx(layer,i+1,j),.00018,'axial');edge(a,this.idx(layer,i+1,j+1),.00035,'shear');edge(this.idx(layer,i,j+1),this.idx(layer,i+1,j),.00035,'shear');}
   if(i<cage.axial-1)edge(a,this.idx(layer,i+2,j),.003,'bend-distance');
   if(i===cage.axial)edge(a,this.idx(1-layer,i,j),.00001,'distal-fold');
  }
  // Couple nearby outer/inner layers by rest-space proximity, not equal UV rows.
  for(let i=0;i<=cage.axial;i++)for(let j=0;j<cage.angular;j++){
   const b=this.idx(1,i,j);let best=Infinity,a=0;
   for(let k=0;k<=cage.axial;k++){const candidate=this.idx(0,k,j),d=distance(this.nodes[candidate].p,this.nodes[b].p);if(d<best){best=d;a=candidate;}}
   edge(a,b,.0005,'interlayer');
  }
  this.incident=buildSupports(cage,this.edges);
  this.topology=updateTopology(this.nodes,this.faces,this.edges,this.incident);
  this.lastMetrics=null;return this.observe();
 }
 event(type,data={}){this.events.push({type,revision:this.revision,time:this.time,...data});this.events=this.events.slice(-60);}
 nearestSurface(p){
  let best=null;
  for(let i=0;i<this.faces.length;i++){
   const f=this.faces[i];if(!f.active||f.nodes.every(id=>!this.nodes[id].inv))continue;
   const v=f.nodes.map(id=>this.nodes[id].p);
   const q=closestTriangle(p,...v),d=distance(p,q.p);
   if(!best||d<best.distance)best={face:i,nodes:[...f.nodes],weights:q.w,point:[...q.p],distance:d};
  }
  return best;
 }
 graspPoint(grasp){return grasp.nodes.reduce((p,id,k)=>add(p,mul(this.nodes[id].p,grasp.weights[k])),[0,0,0]);}
 updateJaw(name,jaw){
  const a=this.arms[name],previous=a.jaw;a.jaw=jaw;
  if(jaw>.65&&a.grasp){a.grasp=null;this.event('grasp_released',{arm:name});}
  if(previous>.25&&jaw<=.25&&!a.grasp){
   const nearest=this.nearestSurface(a.position);
   if(nearest&&nearest.distance<=1.0){
    const occupied=Object.values(this.arms).some(other=>other!==a&&other.grasp&&other.grasp.face===nearest.face);
    if(!occupied){a.grasp={...nearest,offset:rotate(a.quaternion.map((x,i)=>i<3?-x:x),sub(nearest.point,a.position))};this.event('surface_grasp',{arm:name,face:nearest.face,distance:nearest.distance});}
    else this.event('grasp_missed',{arm:name,reason:'Surface already grasped'});
   }else this.event('grasp_missed',{arm:name,reason:'No tissue within 1 mm'});
  }
 }
 solve(dt){
  const old=this.nodes.map(n=>[...n.p]);
  for(const n of this.nodes)if(n.inv&&n.alive)n.p=add(n.p,mul(n.velocity,dt*.65));
  for(const e of this.edges)e.lambda=0;
  for(const a of this.attachments)a.lambda=0;
  for(let iteration=0;iteration<10;iteration++){
   for(const e of this.edges){
    if(!e.active)continue;
    const a=this.nodes[e.a],b=this.nodes[e.b],dx=b.p[0]-a.p[0],dy=b.p[1]-a.p[1],dz=b.p[2]-a.p[2],l=Math.hypot(dx,dy,dz);if(l<1e-9)continue;
    const alpha=e.compliance/(dt*dt),dl=(-(l-e.rest)-alpha*e.lambda)/(a.inv+b.inv+alpha);e.lambda+=dl;
    const ka=a.inv*dl/l,kb=b.inv*dl/l;
    a.p[0]-=ka*dx;a.p[1]-=ka*dy;a.p[2]-=ka*dz;b.p[0]+=kb*dx;b.p[1]+=kb*dy;b.p[2]+=kb*dz;
   }
   for(const tie of this.attachments)if(tie.active)solveAttachment(this,tie,dt);
   for(const a of Object.values(this.arms))if(a.grasp){
    const g=a.grasp,current=this.graspPoint(g),desired=add(a.position,rotate(a.quaternion,g.offset));
    const denominator=g.nodes.reduce((sum,id,k)=>sum+this.nodes[id].inv*g.weights[k]**2,0);
    if(denominator>1e-9)for(let k=0;k<3;k++){const n=this.nodes[g.nodes[k]];n.p=add(n.p,mul(sub(desired,current),n.inv*g.weights[k]/denominator));}
   }
   // Contact projection on the shared protected glans hull. This is a fixture,
   // not a model of glanular tissue forces or full preputial self-contact.
   if(iteration===9)for(const n of this.nodes){
    if(!n.alive)continue;
    if(!n.inv){n.p=[...n.rest];continue;}
    if(n.p[0]>=-9.7*this.scale&&n.p[0]<=23.2*this.scale&&Math.hypot(n.p[1],n.p[2])<15*this.scale){
     const q=glansQuery(n.p,this.scale);if(q.distance<.10)n.p=add(n.p,mul(q.normal,.10-q.distance));
    }
   }
   projectShellContacts(this.nodes,this.faces,this.contactCache);
  }
  const contact=filterShellMotion(this.nodes,this.faces,old,this.contactCache,{margin:.1,query:p=>p[0]>=-9.7*this.scale&&p[0]<=23.2*this.scale&&Math.hypot(p[1],p[2])<15*this.scale?glansQuery(p,this.scale):null});
  this.contactStats.contacts+=contact.contacts;this.contactStats.rigidContacts+=contact.rigidContacts;
  this.contactStats.limitedSubsteps+=Number(contact.limited);
  this.contactStats.lastAdvance=contact.advance;
  for(let i=0;i<this.nodes.length;i++){
   const n=this.nodes[i];if(!n.p.every(Number.isFinite))throw Error('Non-finite mechanical state');
   n.velocity=mul(sub(n.p,old[i]),1/dt);
  }
  recordIntegrity(this,old);
  this.releaseSeconds=releasedCondition(this,protectedQueries)?this.releaseSeconds+dt:0;
  this.time+=dt;
 }
 instrumentSamples(arm){
  const samples=[];
  // Conservative samples cover the complete 12 mm instrument shaft and jaws.
  const localPoints=Array.from({length:25},(_,i)=>[0,i*.5,0]);
  for(const side of [-1,1])for(let i=0;i<=8;i++)localPoints.push([0,i*.5,side*(.22+arm.jaw*.75)*(1-i/8)]);
  for(const local of localPoints)samples.push(add(arm.position,rotate(arm.quaternion,local)));
  return samples;
 }
 sweepProtected(name,before,after,hits){
  const old=this.instrumentSamples(before),next=this.instrumentSamples(after);
  for(let j=0;j<old.length;j++){
   const steps=Math.max(1,Math.ceil(distance(old[j],next[j])/.15));
   for(let i=0;i<=steps;i++){
    const p=mix(old[j],next[j],i/steps);
    for(const q of protectedQueries(p,this.scale))if(q.distance<.5){const key=name+':'+q.structure;if(!hits.has(key)){hits.add(key);this.protectedContacts.push({revision:this.revision,arm:name,structure:q.structure,position:p,time:this.time});this.event('protected_intersection',{arm:name,structure:q.structure});}}
   }
  }
 }
 step(action){
  if(this.terminal)throw Error('Episode is terminal; reset before another action');
  if(!action||typeof action!=='object'||Array.isArray(action))throw Error('Action object required');
  if(Object.keys(action).some(k=>!['revision','duration','left','right','approximate'].includes(k)))throw Error('Unsupported action field');
  if(action.revision!==this.revision)throw Error('Stale mechanical revision');
  const duration=action.duration??.1;
  if(!Number.isFinite(duration)||duration<.02||duration>.5)throw Error('Duration must be 0.02–0.5 simulated seconds');
  const planned={};
  for(const name of ['left','right'])if(action[name]!==undefined){
   const a=action[name];if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['position','rotationDeg','jaw','cut'].includes(k)))throw Error('Unsupported instrument field');
   if(a.position!==undefined){if(!Array.isArray(a.position)||a.position.length!==3||!a.position.every(Number.isFinite)||a.position[0]<-85||a.position[0]>45||Math.abs(a.position[1])>45||Math.abs(a.position[2])>45)throw Error('Position is outside the finite instrument workspace');if(distance(a.position,this.arms[name].position)>4.000001)throw Error('Translation exceeds 4 mm');}
   if(a.rotationDeg!==undefined){if(!Array.isArray(a.rotationDeg)||a.rotationDeg.length!==3||!a.rotationDeg.every(Number.isFinite)||a.rotationDeg.some(x=>Math.abs(x)>360))throw Error('Finite XYZ rotation degrees in [-360,360] required');const q=eulerQuaternion(a.rotationDeg);if(quatAngle(this.arms[name].quaternion,q)>20.000001)throw Error('Rotation exceeds 20 degrees');planned[name]=q;}
   if(a.jaw!==undefined&&(!Number.isFinite(a.jaw)||a.jaw<0||a.jaw>1))throw Error('Jaw must be between zero and one');
   if(a.cut!==undefined&&typeof a.cut!=='boolean')throw Error('Cut must be an explicit boolean pulse');
   if(a.cut&&(this.arms[name].grasp||this.arms[name].jaw<=.65||(a.jaw??1)<=.65))throw Error('Cutting requires an open, unoccupied instrument');
  }
  if(action.approximate!==undefined&&typeof action.approximate!=='boolean')throw Error('Approximate must be an explicit boolean pulse');
  if(action.approximate&&(action.left!==undefined||action.right!==undefined))throw Error('Create a local attachment in a separate stationary command');
  const tie=action.approximate?planAttachment(this):null;
  const before=copy(this),task=this.task;
  try{return this.applyValidatedStep(action,planned,duration,tie);}catch(error){Object.assign(this,before);this.task=task;throw error;}
 }
 cutSweep(name,from,to){
  const ids=sweptFaces(this.nodes,this.faces,from,to);if(!ids.length)return;
  for(const id of ids)this.faces[id].active=false;
  this.cutHistory.push({revision:this.revision,time:this.time,arm:name,faces:ids,from:[...from],to:[...to],radiusMm:CUT_RADIUS_MM});
  this.topology=updateTopology(this.nodes,this.faces,this.edges,this.incident);
  invalidateAttachments(this);
  for(const [arm,a] of Object.entries(this.arms))if(a.grasp&&!this.faces[a.grasp.face].active){a.grasp=null;this.event('grasp_released_by_cut',{arm});}
 }
 applyValidatedStep(action,planned,duration,tie){
  const start=copy(this.arms),cutStart=this.cutHistory.length;this.revision++;
  if(tie){this.attachments.push(tie);this.releaseSeconds=0;this.event('synthetic_edge_attachment',{id:tie.id});}
  for(const name of ['left','right'])this.arms[name].cutting=action[name]?.cut===true;const substeps=Math.ceil(duration*120),dt=duration/substeps,hits=new Set();
  for(let i=1;i<=substeps;i++){
   for(const name of ['left','right']){
    const a=this.arms[name],v=action[name]??{},old=copy(a);
    if(v.position)a.position=mix(start[name].position,v.position,i/substeps);
    if(planned[name])a.quaternion=quatMix(start[name].quaternion,planned[name],i/substeps);
    if(v.jaw!==undefined)this.updateJaw(name,start[name].jaw+(v.jaw-start[name].jaw)*i/substeps);
    this.sweepProtected(name,old,a,hits);
    if(a.cutting)this.cutSweep(name,old.position,a.position);
   }
   this.solve(dt);
   for(const [name,a] of Object.entries(this.arms))if(a.cutting)this.cutSweep(name,a.position,a.position);
  }
  for(const name of ['left','right'])if(action[name]?.rotationDeg)this.arms[name].rotationDeg=[...action[name].rotationDeg];
  if(this.cutHistory.length>cutStart)this.event('local_cut',{faces:this.cutHistory.slice(cutStart).reduce((n,c)=>n+c.faces.length,0)});
  this.lastMetrics=null;this.lastEvaluation=null;return this.observe();
 }
 assessment(){if(!this.lastEvaluation)this.lastEvaluation=evaluate(this,protectedQueries);return copy(this.lastEvaluation);}
 finish(){
  if(this.terminal)throw Error('Episode is already terminal');
  const result=this.assessment();if(!result.passed)throw Error('C0 gates unmet: '+result.failedGates.join(', '));
  this.terminal=result;this.revision++;this.event('episode_complete');return this.observe();
 }
 metrics(){
  if(this.lastMetrics)return copy(this.lastMetrics);
  const displacement=this.nodes.map(n=>distance(n.p,n.rest));let maxStrain=0;
  for(const e of this.edges)if(e.active)maxStrain=Math.max(maxStrain,Math.abs(distance(this.nodes[e.a].p,this.nodes[e.b].p)/e.rest-1));
  const graspErrors=Object.entries(this.arms).filter(([,a])=>a.grasp).map(([name,a])=>({arm:name,error:distance(this.graspPoint(a.grasp),add(a.position,rotate(a.quaternion,a.grasp.offset)))}));
  this.lastMetrics={activeAttachments:this.attachments.filter(a=>a.active).length,releaseSeconds:this.releaseSeconds,cutFaceCount:this.faces.filter(f=>!f.active).length,activeConstraintCount:this.edges.filter(e=>e.active).length,components:copy(this.topology.components),area:areaAccounting(this.task,this.faces,this.topology.componentOf,this.topology.components),activeGrasps:graspErrors.length,graspErrors,maxDisplacementMm:Math.max(...displacement),meanDisplacementMm:displacement.reduce((s,x)=>s+x,0)/displacement.length,maxConstraintStrain:maxStrain,protectedIntersections:this.protectedContacts.length,simulationSeconds:this.time};
  this.lastMetrics.rigidGlansContact={projectionMarginMm:.1,planeConstraints:this.contactStats.rigidContacts,scope:'Sampled node endpoint projection coupled with shell contact; not exact continuous tissue/glans collision'};
  this.lastMetrics.shellContact={gapMm:CONTACT_GAP_MM,contactDetections:this.contactStats.contacts,limitedSubsteps:this.contactStats.limitedSubsteps,lastAdvanceFraction:this.contactStats.lastAdvance};
  return copy(this.lastMetrics);
 }
 observe(){return {revision:this.revision,seed:this.seed,scale:this.scale,units:'mm',arms:copy(this.arms),metrics:this.metrics(),assessment:this.assessment(),terminal:copy(this.terminal),attachments:this.attachments.map(a=>({...copy(a),points:a.anchors.map(p=>attachmentPoint(this.nodes,p))})),events:copy(this.events.slice(-8)),protectedContacts:copy(this.protectedContacts),capabilities:{pose:true,jaw:true,physicalGrasp:true,cutting:true,edgeAttachments:true,terminalScore:true,modelController:false},cage:{angular:cage.angular,axial:cage.axial,hash:cageHash},task:{version:this.task.version,hash:this.task.hash,boundaryRings:this.task.boundaryRings},cutting:{radiusMm:CUT_RADIUS_MM,method:'Swept capsule triangle ablation; whole intersected cage faces removed'},scope:'Synthetic layered shell, compliant constraints, local face ablation, sampled protected volumes; no clinical validation'};}
 snapshot(){return {...this.observe(),positions:this.nodes.map(n=>n.p),faces:this.faces,componentOf:this.topology.componentOf,targetMask:this.task.target,woundPairNodes:this.task.pairNodes};}
}
