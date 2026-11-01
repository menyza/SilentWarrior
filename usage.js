export const USAGE_IDLE_MS=120000;
export function activeDuration(lastTick,lastInteraction,now,visible){return visible?Math.max(0,Math.min(30000,Math.min(now,lastInteraction+USAGE_IDLE_MS)-lastTick)):0;}
export function createUsageTracker({getAccount,storage,send,now=()=>performance.now(),wall=()=>Date.now(),id=()=>crypto.randomUUID(),initialVisible=true}){
 const key='silent-warrior-usage-pending-v1';let pending={};try{const raw=JSON.parse(storage.getItem(key));if(raw&&typeof raw==='object'&&!Array.isArray(raw))pending=raw;}catch{}
 let current=null,visible=initialVisible,lastTick=now(),lastInteraction=lastTick,sending=false,blockedToken=null;
 const persist=()=>{if(Object.keys(pending).length>1000)pending=Object.fromEntries(Object.entries(pending).sort((a,b)=>b[1].lastSeenAt-a[1].lastSeenAt).slice(0,1000));try{storage.setItem(key,JSON.stringify(pending));}catch{}};
 function open(){const account=getAccount();if(!account||!visible)return;const time=wall();current={owner:account.id,id:id(),startedAt:time,lastSeenAt:time,activeMs:0};lastTick=now();lastInteraction=lastTick;pending[current.id]={...current};persist();}
 function tick(){const time=now(),account=getAccount();if(current){const delta=activeDuration(lastTick,lastInteraction,time,visible);if(delta){current.activeMs+=delta;current.lastSeenAt=Math.max(current.lastSeenAt,wall()-Math.max(0,time-(lastInteraction+USAGE_IDLE_MS)));pending[current.id]={...current};persist();}}lastTick=time;if(current?.owner!==account?.id){current=null;open();}else if(!current&&account&&visible)open();}
 function interact(){tick();lastInteraction=now();}
 function visibility(value){tick();if(visible===value)return;visible=value;if(!visible)current=null;else open();lastTick=now();lastInteraction=lastTick;}
 async function flush(){const account=getAccount();if(sending||!account||account.token===blockedToken)return;const records=Object.values(pending).filter(entry=>entry.owner===account.id&&entry.startedAt>=wall()-90*86400000).slice(0,20);if(!records.length)return;sending=true;let followUp=false;try{const response=await send(account,records.map(({id,startedAt,lastSeenAt,activeMs})=>({id,startedAt:Math.floor(startedAt),lastSeenAt:Math.floor(lastSeenAt),activeMs:Math.floor(activeMs)})));if(response.status===401){blockedToken=account.token;return;}if(!response.ok)return;for(const record of records){const latest=pending[record.id];if(latest&&latest.owner===record.owner&&latest.activeMs<=record.activeMs&&latest.lastSeenAt<=record.lastSeenAt)delete pending[record.id];}persist();followUp=Object.values(pending).some(entry=>entry.owner===getAccount()?.id);}catch{}finally{sending=false;if(followUp)queueMicrotask(flush);}}
 open();return {tick,interact,visibility,flush};
}
export function initUsage(getAccount){
 let tracker;try{tracker=createUsageTracker({getAccount,storage:localStorage,initialVisible:!document.hidden,send:(account,sessions)=>fetch(account.url+'/account/usage',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${account.token}`},body:JSON.stringify({sessions}),keepalive:true})});}catch{return;}
 tracker.visibility(!document.hidden);tracker.flush();
 for(const event of ['pointerdown','keydown','touchstart'])document.addEventListener(event,()=>tracker.interact(),{passive:true});
 setInterval(()=>{tracker.tick();tracker.flush();},15000);
 document.addEventListener('visibilitychange',()=>{tracker.visibility(!document.hidden);tracker.flush();});
 document.addEventListener('account-session-changed',()=>{tracker.tick();tracker.flush();});
 window.addEventListener('pagehide',()=>{tracker.visibility(false);tracker.flush();});window.addEventListener('pageshow',()=>{tracker.visibility(!document.hidden);tracker.flush();});window.addEventListener('online',()=>tracker.flush());
}
