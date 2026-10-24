// Synthetic, frictionless shell contact in millimetres. No material calibration.
// Conservative advancement uses a bound on relative projected vertex speed, so it also
// detects edge/edge and coplanar contact between two linearly moving triangles.
// Constraint proposals are filtered before they become simulation state.
const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]];
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
const mix=(a,b,t)=>[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1]),a[2]+t*(b[2]-a[2])];
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const clamp=x=>Math.max(0,Math.min(1,x));
export const CONTACT_GAP_MM=.03;
const TOL=1e-7;

function pointTriangle(p,a,b,c){
 const ab=sub(b,a),ac=sub(c,a),ap=sub(p,a),d1=dot(ab,ap),d2=dot(ac,ap);
 if(d1<=0&&d2<=0)return [1,0,0];
 const bp=sub(p,b),d3=dot(ab,bp),d4=dot(ac,bp);
 if(d3>=0&&d4<=d3)return [0,1,0];
 const vc=d1*d4-d3*d2;
 if(vc<=0&&d1>=0&&d3<=0){const v=d1/(d1-d3);return [1-v,v,0];}
 const cp=sub(p,c),d5=dot(ab,cp),d6=dot(ac,cp);
 if(d6>=0&&d5<=d6)return [0,0,1];
 const vb=d5*d2-d1*d6;
 if(vb<=0&&d2>=0&&d6<=0){const w=d2/(d2-d6);return [1-w,0,w];}
 const va=d3*d6-d5*d4;
 if(va<=0&&(d4-d3)>=0&&(d5-d6)>=0){const w=(d4-d3)/((d4-d3)+(d5-d6));return [0,1-w,w];}
 const den=va+vb+vc;
 if(Math.abs(den)<1e-24)return null;
 const v=vb/den,w=vc/den;return [1-v-w,v,w];
}
function segmentParameters(p1,q1,p2,q2){
 const d1=sub(q1,p1),d2=sub(q2,p2),r=sub(p1,p2),a=dot(d1,d1),e=dot(d2,d2),f=dot(d2,r);let s=0,t=0;
 if(a<1e-24&&e<1e-24)return [0,0];
 if(a<1e-24)t=clamp(f/e);
 else{const c=dot(d1,r);if(e<1e-24)s=clamp(-c/a);else{const b=dot(d1,d2),den=a*e-b*b;s=den>1e-24?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
 return [s,t];
}
const weighted=(p,w)=>[0,1,2].map(i=>p[0][i]*w[0]+p[1][i]*w[1]+p[2][i]*w[2]);
export function triangleSeparation(a,b){
 // Closest features of initially disjoint convex triangles. The continuous
 // query stops at a positive gap before either triangle can intersect.
 let best=Infinity,answer=null;
 const consider=(wa,wb)=>{
  if(!wa||!wb)return;const pa=weighted(a,wa),pb=weighted(b,wb),delta=sub(pa,pb),d2=dot(delta,delta);
  if(d2<best){best=d2;answer={distance:Math.sqrt(d2),a:wa,b:wb,delta};}
 };
 for(let i=0;i<3;i++){
  const w=[0,0,0];w[i]=1;
  consider(w,pointTriangle(a[i],...b));consider(pointTriangle(b[i],...a),w);
 }
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  const [s,t]=segmentParameters(a[i],a[(i+1)%3],b[j],b[(j+1)%3]),wa=[0,0,0],wb=[0,0,0];
  wa[i]=1-s;wa[(i+1)%3]=s;wb[j]=1-t;wb[(j+1)%3]=t;consider(wa,wb);
 }
 return answer;
}

export function sweptTriangleContact(a0,a1,b0,b1,gap=CONTACT_GAP_MM){
 // A fixed plane separating ALL start/end vertices separates their entire
 // linear sweep. This inexpensive certificate avoids iterative distance
 // queries for the many nearby triangles that remain on separate layers.
 for(const tri of [a0,b0]){
  let normal=cross(sub(tri[1],tri[0]),sub(tri[2],tri[0]));const len=Math.hypot(...normal);
  if(len<1e-12)continue;normal=normal.map(v=>v/len);
  const pa=[...a0,...a1].map(p=>dot(p,normal)),pb=[...b0,...b1].map(p=>dot(p,normal));
  if(Math.min(...pa)-Math.max(...pb)>gap+TOL||Math.min(...pb)-Math.max(...pa)>gap+TOL)return null;
 }
 const va=a0.map((p,i)=>sub(a1[i],p)),vb=b0.map((p,i)=>sub(b1[i],p));
 if(va.every(a=>vb.every(b=>a.every((v,i)=>Math.abs(v-b[i])<1e-12))))return null;
 let time=0,last=null;
 for(let iteration=0;iteration<64;iteration++){
  const a=a0.map((p,i)=>mix(p,a1[i],time)),b=b0.map((p,i)=>mix(p,b1[i],time));
  last=triangleSeparation(a,b);
  if(last.distance<1e-12)return {...last,time,conservativeLimit:false};
  const normal=last.delta.map(v=>v/last.distance);
  // Every vertex pair is separated by this supporting plane. Bound each
  // pair's closing time using its OWN projected separation and velocity.
  // Combining the smallest gap with an unrelated fast vertex makes grazing
  // contacts needlessly stall, even when one plane separates the whole sweep.
  let safe=Infinity;
  for(let i=0;i<3;i++)for(let j=0;j<3;j++){
   const closing=dot(sub(vb[j],va[i]),normal);
   if(closing>1e-15)safe=Math.min(safe,(dot(sub(a[i],b[j]),normal)-gap)/closing);
  }
  if(time+safe>1)return null;
  if(last.distance<=gap+TOL)return {...last,time,conservativeLimit:false};
  time+=safe*.9;
 }
 // A difficult grazing trajectory is conservatively limited, never declared
 // collision-free merely because the iteration budget was reached.
 return {...last,time,conservativeLimit:true};
}

function candidates(faces,old,next){
 const cell=4,grid=new Map(),boxes=new Map(),pairs=[],seen=new Set();
 for(let id=0;id<faces.length;id++){
  const f=faces[id];if(!f.active)continue;
  const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];
  for(const n of f.nodes)for(let k=0;k<3;k++){lo[k]=Math.min(lo[k],old[n][k],next[n][k]);hi[k]=Math.max(hi[k],old[n][k],next[n][k]);}
  // A small margin permits reuse during local projection. Every reuse below
  // checks that the entire updated sweep is still inside these bounds.
  for(let k=0;k<3;k++){lo[k]-=CONTACT_GAP_MM+.1;hi[k]+=CONTACT_GAP_MM+.1;}
  boxes.set(id,{lo,hi});
  const a=lo.map(v=>Math.floor(v/cell)),b=hi.map(v=>Math.floor(v/cell));
  for(let x=a[0];x<=b[0];x++)for(let y=a[1];y<=b[1];y++)for(let z=a[2];z<=b[2];z++){
   const key=x+':'+y+':'+z,list=grid.get(key)||[];
   for(const other of list){
    const pair=other*faces.length+id;if(seen.has(pair))continue;seen.add(pair);
    // Shared-node faces are topological neighbours. Interlayer distance
    // constraints are NOT adjacency and never suppress shell contact.
    if(f.nodes.some(n=>faces[other].nodes.includes(n)))continue;
    const box=boxes.get(other);if(lo.some((v,k)=>v>box.hi[k]||hi[k]<box.lo[k]))continue;
    pairs.push([other,id]);
   }
   list.push(id);grid.set(key,list);
  }
 }
 return {pairs,boxes};
}

function projectContact(nodes,positions,c,versions){
 const ids=[...c.fa,...c.fb],weights=[...c.a,...c.b.map(v=>-v)];
 let separation=0,den=0;
 for(let k=0;k<ids.length;k++){separation+=weights[k]*dot(positions[ids[k]],c.normal);den+=nodes[ids[k]].inv*weights[k]**2;}
 const deficit=CONTACT_GAP_MM+1e-5-separation;
 if(den<1e-16||deficit<=0)return false;
 let changed=false;
 for(let k=0;k<ids.length;k++){
  const id=ids[k],amount=nodes[id].inv*weights[k]*deficit/den;
  let moved=false;
  for(let d=0;d<3;d++){const previous=positions[id][d];positions[id][d]+=c.normal[d]*amount;moved||=positions[id][d]!==previous;}
  if(moved){changed=true;if(versions)versions[id]++;}
 }
 return changed;
}

export function projectShellContacts(nodes,faces,cache){
 if(!cache.manifold?.size)return;
 const positions=nodes.map(n=>n.p);
 for(const [key,c] of cache.manifold){
  const pa=weighted(c.fa.map(i=>positions[i]),c.a),pb=weighted(c.fb.map(i=>positions[i]),c.b);
  // Drop separated/sliding anchors; the next continuous query regenerates
  // contact features as needed. These constraints carry no friction force.
  if(!faces[c.faceA].active||!faces[c.faceB].active||Math.hypot(...sub(pa,pb))>.3){cache.manifold.delete(key);continue;}
  projectContact(nodes,positions,c);
 }
}

export function filterShellMotion(nodes,faces,old,cache={}){
 let proposed=nodes.map(n=>[...n.p]);const stats={contacts:0,passes:0,limited:false,advance:1};
 if(proposed.every((p,i)=>p.every((v,k)=>v===old[i][k])))return stats;
 let broadphase=cache.broadphase;
 const versions=new Uint32Array(nodes.length),queries=new Map(),bounds=new Map();
 const boxFor=id=>{
  const ids=faces[id].nodes,previous=bounds.get(id);
  if(previous&&ids.every((n,k)=>previous.versions[k]===versions[n]))return previous.box;
  const box=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
  for(const n of ids)for(let k=0;k<3;k++){box[k]=Math.min(box[k],old[n][k],proposed[n][k]);box[k+3]=Math.max(box[k+3],old[n][k],proposed[n][k]);}
  bounds.set(id,{versions:ids.map(n=>versions[n]),box});return box;
 };
 const limit=contacts=>{
  // A bounded fallback may constrain motion, but must never silently allow
  // interpenetration. Repeating an unchanged proposal cannot resolve it.
  const time=Math.max(0,Math.min(...contacts.map(c=>c.time))*.9);
  cache.lastLimit=contacts.slice(0,2).map(c=>({...c,oldA:c.fa.map(i=>old[i]),oldB:c.fb.map(i=>old[i]),nextA:c.fa.map(i=>proposed[i]),nextB:c.fb.map(i=>proposed[i])}));
  for(let i=0;i<nodes.length;i++)nodes[i].p=mix(old[i],proposed[i],time);
  stats.limited=true;stats.advance=time;return stats;
 };
 for(let pass=0;pass<12;pass++){
  const contacts=[];stats.passes++;
  if(!broadphase||[...broadphase.boxes].some(([id,box])=>faces[id].active&&faces[id].nodes.some(n=>proposed[n].some((v,k)=>Math.min(v,old[n][k])<box.lo[k]+CONTACT_GAP_MM||Math.max(v,old[n][k])>box.hi[k]-CONTACT_GAP_MM))))cache.broadphase=broadphase=candidates(faces,old,proposed);
  for(const [a,b] of broadphase.pairs){
   if(!faces[a].active||!faces[b].active)continue;
   const fa=faces[a].nodes,fb=faces[b].nodes;
   const key=a*faces.length+b,ids=[...fa,...fb],previous=queries.get(key);
   let hit;
   if(previous&&ids.every((id,k)=>versions[id]===previous.versions[k]))hit=previous.hit;
   else{
    const ba=boxFor(a),bb=boxFor(b);
    const separated=[0,1,2].some(k=>ba[k]>bb[k+3]+CONTACT_GAP_MM+TOL||bb[k]>ba[k+3]+CONTACT_GAP_MM+TOL);
    hit=separated?null:sweptTriangleContact(fa.map(i=>old[i]),fa.map(i=>proposed[i]),fb.map(i=>old[i]),fb.map(i=>proposed[i]));
    queries.set(key,{versions:ids.map(id=>versions[id]),hit});
   }
   if(hit)contacts.push({...hit,fa,fb,faceA:a,faceB:b});
  }
  if(!contacts.length){for(let i=0;i<nodes.length;i++)nodes[i].p=proposed[i];return stats;}
  stats.contacts+=contacts.length;
  if(pass===11)return limit(contacts);
  let changed=false;
  for(const c of contacts){
   if(c.distance<1e-12)throw Error('Shell contact started from an intersecting configuration');
   c.normal=c.delta.map(v=>v/c.distance);
   cache.manifold??=new Map();
   cache.manifold.set(c.faceA*faces.length+c.faceB,{faceA:c.faceA,faceB:c.faceB,fa:c.fa,fb:c.fb,a:c.a,b:c.b,normal:c.normal});
   changed=projectContact(nodes,proposed,c,versions)||changed;
  }
  if(!changed)return limit(contacts);
 }
}
