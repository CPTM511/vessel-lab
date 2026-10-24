// Geometric local ablation of sampled triangles. No target mask is consulted here.
const sub=(a,b)=>a.map((v,i)=>v-b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const mul=(a,s)=>a.map(v=>v*s);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>Math.hypot(...a);
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=x=>Math.max(0,Math.min(1,x));
function segmentDistance(p1,q1,p2,q2){
 const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);let s=0,t=0;
 if(a<1e-14&&e<1e-14)return norm(r);
 if(a<1e-14)t=clamp(f/e);
 else{const c=dot(d1,r);if(e<1e-14)s=clamp(-c/a);else{const b=dot(d1,d2),den=a*e-b*b;s=den>1e-14?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 return norm(sub(add(p1,mul(d1,s)),add(p2,mul(d2,t))));
}
function inTriangle(p,a,b,c){
 const v0=sub(b,a),v1=sub(c,a),v2=sub(p,a),aa=dot(v0,v0),ab=dot(v0,v1),bb=dot(v1,v1),ap=dot(v0,v2),bp=dot(v1,v2),den=aa*bb-ab*ab;
 if(den<1e-16)return false;const u=(bb*ap-ab*bp)/den,v=(aa*bp-ab*ap)/den;
 return u>=-1e-9&&v>=-1e-9&&u+v<=1+1e-9;
}
export function segmentTriangleDistance(p,q,a,b,c){
 const n=cross(sub(b,a),sub(c,a)),nn=dot(n,n);let best=Infinity;
 if(nn>1e-16){
  const dp=dot(sub(p,a),n),dq=dot(sub(q,a),n),den=dp-dq;
  if(Math.abs(den)>1e-14){const t=dp/den;if(t>=0&&t<=1&&inTriangle(add(p,mul(sub(q,p),t)),a,b,c))return 0;}
  for(const [v,d] of [[p,dp],[q,dq]]){const projected=sub(v,mul(n,d/nn));if(inTriangle(projected,a,b,c))best=Math.min(best,Math.abs(d)/Math.sqrt(nn));}
 }
 for(const [u,v] of [[a,b],[b,c],[c,a]])best=Math.min(best,segmentDistance(p,q,u,v));
 return best;
}
export const CUT_RADIUS_MM=.35;
export function sweptFaces(nodes,faces,p,q,radius=CUT_RADIUS_MM){
 const lo=p.map((v,i)=>Math.min(v,q[i])-radius),hi=p.map((v,i)=>Math.max(v,q[i])+radius),hits=[];
 for(let id=0;id<faces.length;id++){
  const f=faces[id];if(!f.active)continue;const v=f.nodes.map(i=>nodes[i].p);
  if([0,1,2].some(axis=>Math.max(...v.map(x=>x[axis]))<lo[axis]||Math.min(...v.map(x=>x[axis]))>hi[axis]))continue;
  if(segmentTriangleDistance(p,q,...v)<=radius)hits.push(id);
 }
 return hits;
}

export function buildSupports(cage,edges){
 const incident=Array.from({length:cage.nodes.length},()=>[]),surfaceEdges=new Map();
 const key=(a,b)=>a<b?a+':'+b:b+':'+a;
 cage.faces.forEach((f,id)=>{
  for(const n of f.nodes)incident[n].push(id);
  for(let i=0;i<3;i++){const k=key(f.nodes[i],f.nodes[(i+1)%3]);if(!surfaceEdges.has(k))surfaceEdges.set(k,[]);surfaceEdges.get(k).push(id);}
 });
 for(const e of edges){
  const a=cage.nodes[e.a],b=cage.nodes[e.b],direct=surfaceEdges.get(key(e.a,e.b));
  if(direct)e.support=[direct];
  else if(e.kind==='bend-distance'){
   const middle=e.a+cage.angular;
   e.support=[surfaceEdges.get(key(e.a,middle)),surfaceEdges.get(key(middle,e.b))];
  }else if(a.layer===b.layer){
   // The opposite diagonal crosses both triangles of its cell.
   const row=Math.min(a.ring,b.ring),j=b.ring>a.ring?b.j:a.j;
   const first=(a.layer*cage.axial*cage.angular+row*cage.angular+j)*2;
   e.support=[[first],[first+1]];
  }else e.support=[incident[e.a],incident[e.b]];
  if(e.support.some(s=>!s?.length))throw Error('Missing mechanical support for '+e.kind);
  e.active=true;
 }
 return incident;
}
export function newWoundEdges(faces){
 const groups=new Map();
 faces.forEach((f,id)=>{for(let i=0;i<3;i++){
  const nodes=[f.nodes[i],f.nodes[(i+1)%3]].sort((a,b)=>a-b),key=nodes.join(':');
  if(!groups.has(key))groups.set(key,{key,nodes,original:0,live:[]});
  const g=groups.get(key);g.original++;if(f.active)g.live.push({face:id,layer:f.layer});
 }});
 return [...groups.values()].filter(g=>g.original===2&&g.live.length===1).map(g=>({key:g.key,nodes:g.nodes,...g.live[0]}));
}
export function updateTopology(nodes,faces,edges,incident){
 for(let i=0;i<nodes.length;i++){
  const alive=incident[i].some(id=>faces[id].active);nodes[i].alive=alive;
  if(!alive)nodes[i].velocity=[0,0,0];
 }
 const woundEdges=newWoundEdges(faces),boundaryNodes=new Set(woundEdges.flatMap(e=>e.nodes));
 for(const e of edges){
  // The exposed interface has no hidden native tie across two cut margins.
  e.releasedInterface=e.kind==='interlayer'&&boundaryNodes.has(e.a)&&boundaryNodes.has(e.b);
  e.active=!e.releasedInterface&&e.support.every(group=>group.some(id=>faces[id].active));
 }
 const parents=nodes.map((_,i)=>i),find=i=>{while(parents[i]!==i){parents[i]=parents[parents[i]];i=parents[i];}return i;};
 const union=(a,b)=>{a=find(a);b=find(b);if(a!==b)parents[b]=a;};
 for(const f of faces)if(f.active){union(f.nodes[0],f.nodes[1]);union(f.nodes[1],f.nodes[2]);}
 for(const e of edges)if(e.active)union(e.a,e.b);
 const groups=new Map(),componentOf=nodes.map(()=>-1),components=[];
 for(let i=0;i<nodes.length;i++)if(nodes[i].alive){
  const root=find(i);if(!groups.has(root)){groups.set(root,components.length);components.push({id:components.length,anchored:false,nodeCount:0,faceCount:0});}
  const id=groups.get(root);componentOf[i]=id;const c=components[id];c.nodeCount++;c.anchored||=nodes[i].fixed;
 }
 for(const f of faces)if(f.active)components[componentOf[f.nodes[0]]].faceCount++;
 return {componentOf,components,woundEdges};
}
