// Synthetic initial conditions, not a clinical anatomical population model.
export const SCENARIO_VERSION='S1';
const declared=Object.freeze({11:{profile:'compact',scale:.92},29:{profile:'reference',scale:1},83:{profile:'expanded',scale:1.08}});

function stream(seed){
 let state=seed>>>0;
 return ()=>{
  state=(state+0x9e3779b9)>>>0;
  let x=Math.imul(state^(state>>>16),0x21f0aaad);
  x=Math.imul(x^(x>>>15),0x735a2d97);
  return ((x^(x>>>15))>>>0)/2**32;
 };
}

export function defineScenario(seed){
 if(!Number.isInteger(seed)||seed<0||seed>0xffffffff)throw Error('Seed must be an unsigned 32-bit integer');
 const next=stream(seed),sampledScale=.9+.2*next();
 const profile=declared[seed]??{profile:'generated',scale:sampledScale};
 const arms={};
 for(const [name,side] of [['left',1],['right',-1]]){
  arms[name]={position:[34*profile.scale+(next()-.5)*4,24*profile.scale+(next()-.5)*4,side*16*profile.scale+(next()-.5)*4],rotationDeg:[0,0,0],jaw:1};
 }
 return {version:SCENARIO_VERSION,seed,profile:profile.profile,scale:profile.scale,initialArms:arms,scope:'Authored synthetic size cases and deterministic initial instrument offsets; not population anatomy or a procedure trajectory'};
}
