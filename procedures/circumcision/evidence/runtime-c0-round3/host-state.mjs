import {execFileSync} from 'node:child_process';
export function hostState(){
 const out={platform:process.platform,at:new Date().toISOString(),screenLocked:null,userSessionLocked:null};
 if(process.platform!=='darwin')return out;
 try{
  const xml=execFileSync('/usr/sbin/ioreg',['-n','Root','-d1','-a'],{timeout:2000,stdio:['pipe','pipe','ignore']});
  const parsed=JSON.parse(execFileSync('/usr/bin/plutil',['-convert','json','-o','-','-'],{input:xml,timeout:2000}));
  const d=Array.isArray(parsed)?parsed[0]:parsed;
  const user=d.IOConsoleUsers?.find(u=>u.kCGSSessionUserIDKey===process.getuid());
  out.screenLocked=d.IOConsoleLocked??null;out.userSessionLocked=user?!!user.CGSSessionScreenIsLocked:null;
  out.source='IORegistry console and current-user session flags';
 }catch{out.source='unavailable';}
 return out;
}
