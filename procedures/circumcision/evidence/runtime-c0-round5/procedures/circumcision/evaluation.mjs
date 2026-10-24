// C0 terminal checks. No model assertion, attachment count or displayed metric is trusted.
import {areaAccounting} from './task-definition.mjs';
import {segmentTriangleDistance} from './cutting.mjs';
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const norm=a=>Math.hypot(...a);
const distance=(a,b)=>norm(sub(a,b));
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
export const C0=Object.freeze({target:.95,offTarget:.01,edgeGapMm:1,releaseSeconds:5,clearanceMm:3});
const box=v=>({lo:[0,1,2].map(i=>Math.min(...v.map(p=>p[i]))),hi:[0,1,2].map(i=>Math.max(...v.map(p=>p[i])))});
const near=(a,b,r)=>[0,1,2].every(i=>a.lo[i]<=b.hi[i]+r&&b.lo[i]<=a.hi[i]+r);
export const faceNormal=p=>cross(sub(p[1],p[0]),sub(p[2],p[0]));
export function recordIntegrity(sim,before){
 sim.faces.forEach((f,id)=>{
  if(!f.active)return;
  const old=faceNormal(f.nodes.map(n=>before[n])),now=faceNormal(f.nodes.map(n=>sim.nodes[n].p));
  if(norm(now)<Math.max(1e-10,sim.task.areas[id]*2e-6)||dot(old,now)<=0)sim.invalidFaces.add(id);
 });
}
export function retainedWoundEdges(sim){return sim.topology.woundEdges.filter(e=>sim.topology.components[sim.topology.componentOf[e.nodes[0]]]?.anchored);}
export function closureSamples(sim){
 const edgeNodes=new Set(retainedWoundEdges(sim).flatMap(e=>e.nodes));
 return sim.task.pairNodes.map((ids,index)=>{
  const valid=ids.every(id=>edgeNodes.has(id)&&sim.nodes[id].alive&&sim.topology.components[sim.topology.componentOf[id]]?.anchored);
  const nativeBridge=sim.edges.some(e=>e.active&&e.kind==='interlayer'&&ids.includes(e.a)&&ids.includes(e.b));
  const gap=distance(sim.nodes[ids[0]].p,sim.nodes[ids[1]].p);
  return {index,nodes:ids,valid:valid&&!nativeBridge,gapMm:gap,withinTolerance:valid&&!nativeBridge&&gap<=C0.edgeGapMm};
 });
}
function protectedNear(p,scale){return p[0]>-77*scale&&p[0]<28*scale&&Math.abs(p[1])<19*scale&&Math.abs(p[2])<19*scale;}
export function releasedCondition(sim,queryProtected){
 for(const a of Object.values(sim.arms))if(a.jaw<.95||a.grasp||a.cutting)return false;
 const live=sim.faces.filter(f=>f.active).map(f=>f.nodes.map(id=>sim.nodes[id].p));
 for(const a of Object.values(sim.arms)){
  const points=sim.instrumentSamples(a),bounds=box(points),clear=C0.clearanceMm+.5;
  for(const p of points)if(protectedNear(p,sim.scale)&&queryProtected(p,sim.scale).some(q=>q.distance<clear))return false;
  for(const tri of live){
   const b=box(tri);if(!near(bounds,b,clear))continue;
   for(const p of points){if([0,1,2].some(i=>p[i]<b.lo[i]-clear||p[i]>b.hi[i]+clear))continue;
    if(segmentTriangleDistance(p,p,...tri)<clear)return false;
   }
  }
 }
 return true;
}
function trianglesClose(a,b,r){
 if(!near(box(a),box(b),r))return false;
 for(let i=0;i<3;i++)if(segmentTriangleDistance(a[i],a[(i+1)%3],...b)<r||segmentTriangleDistance(b[i],b[(i+1)%3],...a)<r)return true;
 return false;
}
export function unresolvedComponents(sim,queryProtected){
 const detached=sim.topology.components.filter(c=>!c.anchored),unresolved=[];
 if(!detached.length)return unresolved;
 const retained=sim.faces.filter(f=>f.active&&sim.topology.components[sim.topology.componentOf[f.nodes[0]]]?.anchored).map(f=>f.nodes.map(id=>sim.nodes[id].p));
 const retainedBounds=retained.length?box(retained.flat()):null;
 for(const c of detached){
  const faces=sim.faces.filter(f=>f.active&&sim.topology.componentOf[f.nodes[0]]===c.id);
  if(!faces.some(f=>sim.task.target[sim.faces.indexOf(f)]))continue;
  const triangles=faces.map(f=>f.nodes.map(id=>sim.nodes[id].p));
  let reason=null;
  if(Object.values(sim.arms).some(a=>a.grasp&&sim.topology.componentOf[a.grasp.nodes[0]]===c.id))reason='Component is still grasped';
  if(!reason)for(const p of triangles.flat())if(protectedNear(p,sim.scale)&&queryProtected(p,sim.scale).some(q=>q.distance<C0.clearanceMm)){reason='Component is within 3 mm of protected anatomy';break;}
  if(!reason&&retainedBounds&&near(box(triangles.flat()),retainedBounds,C0.clearanceMm)){
   outer:for(const a of triangles)for(const b of retained)if(trianglesClose(a,b,C0.clearanceMm)){reason='Component is within 3 mm of retained tissue';break outer;}
  }
  if(reason)unresolved.push({component:c.id,reason});
 }
 return unresolved;
}
export function evaluate(sim,queryProtected){
 const area=areaAccounting(sim.task,sim.faces,sim.topology.componentOf,sim.topology.components),samples=closureSamples(sim);
 const invalid=[];
 sim.faces.forEach((f,i)=>{
  if(f.active&&sim.topology.components[sim.topology.componentOf[f.nodes[0]]]?.anchored&&(sim.invalidFaces.has(i)||norm(faceNormal(f.nodes.map(n=>sim.nodes[n].p)))<Math.max(1e-10,sim.task.areas[i]*2e-6)))invalid.push(i);
 });
 const unresolved=unresolvedComponents(sim,queryProtected),currentRelease=releasedCondition(sim,queryProtected),covered=samples.filter(p=>p.withinTolerance).length;
 const gates={targetDetached:area.targetDetachedFraction>=C0.target,offTargetPreserved:area.offTargetRemovedFraction<=C0.offTarget,
  protectedVolumes:sim.protectedContacts.length===0,retainedEdgeApproximation:covered/samples.length>=.95,
  releasedHold:currentRelease&&sim.releaseSeconds+1e-9>=C0.releaseSeconds,retainedIntegrity:invalid.length===0,resolvedTargetComponents:unresolved.length===0};
 return {protocol:'C0',passed:Object.values(gates).every(Boolean),gates,failedGates:Object.keys(gates).filter(k=>!gates[k]),area,
  closure:{totalSamples:samples.length,validSamples:samples.filter(s=>s.valid).length,coveredSamples:covered,coverage:covered/samples.length,samples},
  release:{seconds:sim.releaseSeconds,currentCondition:currentRelease,requiredSeconds:C0.releaseSeconds},invalidRetainedFaces:invalid,unresolvedComponents:unresolved,
  scope:'Independent synthetic geometry checks; no clinical validation'};
}
