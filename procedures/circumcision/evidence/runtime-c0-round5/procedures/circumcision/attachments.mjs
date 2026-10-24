// A local compliant edge tie. This is not a simulated stitch, knot or surgical device.
import {retainedWoundEdges} from './evaluation.mjs';
const sub=(a,b)=>a.map((v,i)=>v-b[i]),add=(a,b)=>a.map((v,i)=>v+b[i]),mul=(a,s)=>a.map(v=>v*s),dot=(a,b)=>a.reduce((n,v,i)=>n+v*b[i],0),length=p=>Math.hypot(...p);
export function attachmentPoint(nodes,anchor){return anchor.nodes.reduce((p,id,k)=>add(p,mul(nodes[id].p,anchor.weights[k])),[0,0,0]);}
function nearestEdge(sim,p){
 let best=null;
 for(const e of retainedWoundEdges(sim)){
  const a=sim.nodes[e.nodes[0]].p,b=sim.nodes[e.nodes[1]].p,d=sub(b,a),t=Math.min(1,Math.max(0,dot(sub(p,a),d)/Math.max(1e-12,dot(d,d))));
  const point=add(a,mul(d,t)),distance=length(sub(p,point));
  if(!best||distance<best.distance)best={edgeKey:e.key,nodes:e.nodes,weights:[1-t,t],layer:e.layer,point,distance};
 }
 return best;
}
export function planAttachment(sim){
 const anchors=[];
 for(const name of ['left','right']){
  const arm=sim.arms[name];if(!arm.grasp||arm.jaw>.25)throw Error('Synthetic attachment requires both instruments holding tissue');
  const a=nearestEdge(sim,sim.graspPoint(arm.grasp));
  if(!a||a.distance>1||length(sub(a.point,arm.position))>1.5)throw Error('Both held points must be within 1 mm of a retained cut edge');
  anchors.push(a);
 }
 if(anchors[0].layer===anchors[1].layer)throw Error('Synthetic attachment requires edges from different tissue layers');
 if(length(sub(anchors[0].point,anchors[1].point))>3)throw Error('Local edge attachment span exceeds 3 mm');
 const key=anchors.map(a=>a.edgeKey).sort().join('|');
 if(sim.attachments.some(a=>a.active&&a.key===key))throw Error('These local edges already have an attachment');
 return {id:sim.attachments.length+1,key,anchors,restMm:.4,compliance:.00002,lambda:0,active:true,createdRevision:sim.revision+1};
}
export function solveAttachment(sim,tie,dt){
 const [a,b]=tie.anchors,p=attachmentPoint(sim.nodes,a),q=attachmentPoint(sim.nodes,b),d=sub(q,p),l=length(d);if(l<1e-9)return;
 const sum=[a,b].reduce((s,v)=>s+v.nodes.reduce((n,id,k)=>n+sim.nodes[id].inv*v.weights[k]**2,0),0),alpha=tie.compliance/(dt*dt);
 const dl=(-(l-tie.restMm)-alpha*tie.lambda)/(sum+alpha);tie.lambda+=dl;
 for(const [anchor,sign] of [[a,-1],[b,1]])for(let k=0;k<2;k++){
  const node=sim.nodes[anchor.nodes[k]];node.p=add(node.p,mul(d,sign*node.inv*anchor.weights[k]*dl/l));
 }
}
export function invalidateAttachments(sim){
 const valid=new Set(retainedWoundEdges(sim).map(e=>e.key));
 for(const tie of sim.attachments)if(tie.active&&tie.anchors.some(a=>!valid.has(a.edgeKey))){tie.active=false;sim.event('attachment_invalidated_by_cut',{id:tie.id});}
}
