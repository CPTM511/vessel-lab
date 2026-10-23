// Vessel Lab's deliberately simplified, deterministic mechanics. Millimetres.
// No model policy or operation trajectory is implemented in this module.
export const VERSION='0.1.1';
export const add=(a,b)=>a.map((v,i)=>v+b[i]);
export const sub=(a,b)=>a.map((v,i)=>v-b[i]);
export const mul=(a,s)=>a.map(v=>v*s);
export const norm=a=>Math.hypot(...a);
export const dist=(a,b)=>norm(sub(a,b));
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const clone=x=>JSON.parse(JSON.stringify(x));
function rng(seed){let s=seed>>>0;return()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296;};}
function wrap(x){return Math.atan2(Math.sin(x),Math.cos(x));}

export class VesselSim{
 constructor(seed=42){this.reset(seed);}
 reset(seed=42){
  const r=rng(seed); this.seed=seed;this.revision=0;this.time=0;this.status='ready';
  this.radius=3+(r()-.5)*.2;this.initialGap=1.2+(r()-.5)*.12;this.n=24;this.rings=4;
  this.particles=[];this.edges=[];this.faces=[];this.stitches=[];this.punctures=[];this.events=[];this.trail=[];
  this.damage=0;this.peakTension=0;this.tension=0;this.winding=0;this.knot=false;this.cut=false;this.pending=null;
  this.needle={position:[2.8,this.radius,0],heldBy:'right'};
  this.tail=[3.5,this.radius,1.5];
  this.arms={left:{position:[4.5,5,3],jaw:1,held:null},right:{position:[...this.needle.position],jaw:0,held:'needle'}};
  for(let side=0;side<2;side++)for(let ring=0;ring<this.rings;ring++)for(let j=0;j<this.n;j++){
   const a=j*2*Math.PI/this.n;
   const p=[(side?1:-1)*(this.initialGap/2+ring*1.65),this.radius*Math.cos(a),this.radius*Math.sin(a)];
   this.particles.push({p,rest:[...p],old:[...p],inv:ring===this.rings-1?0:1,side,ring,j});
  }
  const edge=(a,b,c=.00005)=>this.edges.push({a,b,rest:dist(this.particles[a].p,this.particles[b].p),c});
  for(let s=0;s<2;s++)for(let k=0;k<this.rings;k++)for(let j=0;j<this.n;j++){
   const a=this.idx(s,k,j),b=this.idx(s,k,j+1);edge(a,b);
   if(k<this.rings-1){const c=this.idx(s,k+1,j),d=this.idx(s,k+1,j+1);edge(a,c,.0002);edge(a,d,.0004);edge(b,c,.0004);this.faces.push([a,b,c],[b,d,c]);}
  }
  this.cutPosition=[0,6,2];this.lastAction=null;this.result=null;return this.snapshot();
 }
 idx(side,ring,j){return side*this.rings*this.n+ring*this.n+((j%this.n)+this.n)%this.n;}
 event(type,data={}){this.events.push({type,revision:this.revision,time:this.time,...data});this.events=this.events.slice(-40);}
 holePoint(h){return [...this.particles[h.node].p];}
 puncture(from,to){
  if(this.cut||this.knot)return;
  const crossings=[];
  for(let side=0;side<2;side++){
   // Annular lip model: sweep the actual needle tip through the moving lip plane.
   let xs=0;for(let j=0;j<this.n;j++)xs+=this.particles[this.idx(side,0,j)].p[0];xs/=this.n;
   if(Math.abs(to[0]-from[0])<1e-9)continue;
   let t=(xs-from[0])/(to[0]-from[0]);if(t<=1e-5||t>1)continue;
   const hit=add(from,mul(sub(to,from),t)),rad=Math.hypot(hit[1],hit[2]);
   if(Math.abs(rad-this.radius)>.48)continue;
   let j=Math.round(Math.atan2(hit[2],hit[1])*this.n/(2*Math.PI));j=(j+this.n)%this.n;
   const h={side,node:this.idx(side,0,j),j,hit,t};crossings.push(h);
  }
  crossings.sort((a,b)=>a.t-b.t);
  for(const h of crossings){
   this.punctures.push(h);this.event('puncture',{side:h.side,point:h.hit});
   if(this.pending&&this.pending.side!==h.side){
    const dj=Math.min(Math.abs(h.j-this.pending.j),this.n-Math.abs(h.j-this.pending.j));
    if(dj<=2){
     const left=h.side===0?h:this.pending,right=h.side===1?h:this.pending;
     if(!this.stitches.some(s=>s.left.node===left.node&&s.right.node===right.node)){
      this.stitches.push({left,right,rest:dist(this.holePoint(left),this.holePoint(right))+.6,locked:false});
      this.event('thread_bridge',{count:this.stitches.length});
     }else{this.damage+=.03;this.event('repeated_puncture');}
    }else {this.damage+=.08;this.event('oblique_bridge_rejected');}
    this.pending=null;
   }else this.pending=h;
  }
 }
 grasp(name,jaw){
  const a=this.arms[name];a.jaw=jaw;
  if(jaw>.65){if(a.held==='needle')this.needle.heldBy=null;a.held=null;return;}
  if(a.held||jaw>.25)return;
  if(!this.needle.heldBy&&dist(a.position,this.needle.position)<.65){a.held='needle';this.needle.heldBy=name;this.event('needle_grasp',{arm:name});}
  else if(!Object.values(this.arms).some(x=>x.held==='tail')&&dist(a.position,this.tail)<.65&&!this.cut){a.held='tail';this.event('tail_grasp',{arm:name});}
 }
 solve(dt){
  for(const p of this.particles){p.old=[...p.p];}
  // XPBD distance constraints. Explicit compliance and lambda reset per time step.
  const constraints=this.edges.map(e=>({...e,lambda:0}));
  for(const s of this.stitches)constraints.push({a:s.left.node,b:s.right.node,rest:s.rest,c:.000001,lambda:0,tensile:true});
  for(let it=0;it<12;it++){
   for(const e of constraints){const a=this.particles[e.a],b=this.particles[e.b],d=sub(b.p,a.p),l=norm(d);if(l<1e-9)continue;
    const alpha=e.c/(dt*dt);let dl=(-(l-e.rest)-alpha*e.lambda)/(a.inv+b.inv+alpha);
    if(e.tensile)dl=Math.min(0,e.lambda+dl)-e.lambda;
    e.lambda+=dl;
    for(let q=0;q<3;q++){a.p[q]-=a.inv*dl*d[q]/l;b.p[q]+=b.inv*dl*d[q]/l;}
   }
   for(const p of this.particles){if(!p.inv){p.p=[...p.rest];continue;}
    // Cross-section support: explicitly a fixture-supported synthetic vessel.
    let rad=Math.hypot(p.p[1],p.p[2]);if(rad>1e-9){p.p[1]*=this.radius/rad;p.p[2]*=this.radius/rad;}
    if(!p.p.every(Number.isFinite))throw Error('Physics state became non-finite');
   }
  }
 }
 step(action){
  if(this.status==='completed'||this.status==='failed')throw Error('Episode ended; reset to begin another.');
  if(action.revision!==undefined&&action.revision!==this.revision)throw Error('Stale observation revision');
  const duration=action.duration??.2;if(!Number.isFinite(duration)||duration<.05||duration>1)throw Error('Duration must be 0.05–1 simulated seconds');
  // Validate the entire command before changing either arm.
  for(const name of ['left','right'])if(action[name]){
   const v=action[name];if(v.position&&(!Array.isArray(v.position)||v.position.length!==3||!v.position.every(Number.isFinite)||v.position.some(x=>Math.abs(x)>10)))throw Error('Position must be three finite coordinates within ±10 mm');
   if(v.position&&dist(v.position,this.arms[name].position)>3.01)throw Error('A single action may move each arm at most 3 mm');
   if(v.jaw!==undefined&&(!Number.isFinite(v.jaw)||v.jaw<0||v.jaw>1))throw Error('Jaw must be 0–1');
  }
  this.status='running';this.revision++;this.lastAction=clone(action);
  const start=clone(this.arms),needleStart=[...this.needle.position];
  const substeps=Math.ceil(duration*120),dt=duration/substeps;
  for(let i=1;i<=substeps;i++){
   const oldNeedle=[...this.needle.position],oldTail=[...this.tail];
   for(const name of ['left','right']){const v=action[name],a=this.arms[name];if(v?.position)a.position=add(start[name].position,mul(sub(v.position,start[name].position),i/substeps));
    if(v?.jaw!==undefined)this.grasp(name,v.jaw);
    if(a.held==='needle')this.needle.position=[...a.position];if(a.held==='tail')this.tail=[...a.position];
   }
   this.puncture(oldNeedle,this.needle.position);
   const tailArm=Object.values(this.arms).find(a=>a.held==='tail');
   if(tailArm&&this.needle.heldBy&&!this.cut){
    const oldRel=sub(oldTail,oldNeedle),rel=sub(this.tail,this.needle.position);
    const oldR=Math.hypot(oldRel[1],oldRel[2]),r=Math.hypot(rel[1],rel[2]);
    if(oldR>.5&&oldR<3&&r>.5&&r<3&&Math.abs(rel[0])<2)
     this.winding+=wrap(Math.atan2(rel[2],rel[1])-Math.atan2(oldRel[2],oldRel[1]));
    const pull=Math.max(0,norm(rel)-norm(oldRel));
    // Sliding thread constraint: free-end withdrawal consumes bridge slack.
    if(pull>0&&this.stitches.length){
     for(const s of this.stitches)if(!s.locked)s.rest=Math.max(.08,s.rest-pull*.6);
     this.tension=clamp(pull/dt*.06,0,3);this.peakTension=Math.max(this.peakTension,this.tension);
     if(this.tension>1.8)this.damage+=dt*.2;
    }else this.tension*=.98;
    if(Math.abs(this.winding)>Math.PI*1.85&&this.stitches.length&&this.stitches.every(s=>s.rest<.3)&&r>1.2){
     if(!this.knot)this.event('geometric_knot_recognized');this.knot=true;this.stitches.forEach(s=>s.locked=true);
    }
   }else if(!this.knot){
    // Unsecured thread slips: letting go without a knot cannot pass the hold test.
    for(const s of this.stitches)s.rest=Math.min(this.initialGap+.6,s.rest+dt*.25);
   }
   this.solve(dt);this.time+=dt;
  }
  this.trail.push([...this.needle.position]);this.trail=this.trail.slice(-500);
  if(dist(needleStart,this.needle.position)>0)this.event('needle_motion',{from:needleStart,to:this.needle.position});
  return this.observe();
 }
 cutThread(){
  if(this.status==='completed'||this.status==='failed')throw Error('Episode ended');
  if(!this.knot)throw Error('No secured knot; severing the thread would lose closure');
  if(dist(this.needle.position,this.cutPosition)>1)throw Error('Needle-side thread must physically reach the bench cutter');
  this.cut=true;this.revision++;this.event('thread_cut');return this.observe();
 }
 metrics(){
  const gaps=Array.from({length:this.n},(_,j)=>dist(this.particles[this.idx(0,0,j)].p,this.particles[this.idx(1,0,j)].p));
  const coverage=gaps.filter(g=>g<=.1*this.radius).length/this.n;
  return {coverage,maxGap:Math.max(...gaps),meanGap:gaps.reduce((a,b)=>a+b,0)/gaps.length,bridges:this.stitches.length,knot:this.knot,cut:this.cut,damage:this.damage,held:!!Object.values(this.arms).find(a=>a.held),lumenAreaRatio:null,lumenModel:'fixture-constrained; not independently simulated',simulationSeconds:this.time};
 }
 finish(){
  if(this.status==='completed'||this.status==='failed')throw Error('Episode ended');
  for(let i=0;i<600;i++){if(!this.knot)for(const s of this.stitches)s.rest=Math.min(this.initialGap+.6,s.rest+1/120*.25);this.solve(1/120);this.time+=1/120;}
  const m=this.metrics();const checks={closure:m.coverage>=.95,secured:this.knot,threadTrimmed:this.cut,released:!m.held,tissueIntact:m.damage<.2};
  const passed=Object.values(checks).every(Boolean);this.status=passed?'completed':'failed';this.revision++;
  this.result={passed,checks,metrics:m,scope:'simplified annular-lip and geometric-knot benchmark; NOT validated vessel anastomosis',holdTest:'5 simulated seconds, no external pressure load'};return clone(this.result);
 }
 observe(){return {revision:this.revision,time:+this.time.toFixed(3),status:this.status,arms:clone(this.arms),needle:clone(this.needle),tail:[...this.tail],events:clone(this.events.slice(-6)),instrumentation:{threadTension:+this.tension.toFixed(3),punctureCount:this.punctures.length,bridgeCount:this.stitches.length,loopWindingTurns:+(this.winding/(2*Math.PI)).toFixed(3),knot:this.knot,threadCut:this.cut,closure:this.metrics()},task:{radius:this.radius,initialGap:this.initialGap,frame:'x vessel axis; y up; z lateral; mm',cutter:[...this.cutPosition]},result:clone(this.result)};}
 snapshot(){return {...this.observe(),seed:this.seed,version:VERSION,particles:clone(this.particles),faces:clone(this.faces),stitches:clone(this.stitches),punctures:clone(this.punctures),trail:clone(this.trail),metrics:this.metrics()};}
}
