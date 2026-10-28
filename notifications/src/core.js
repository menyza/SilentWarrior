export function settings(value){
 if(!value||!Array.isArray(value.reminders)||value.reminders.length>2)throw new Error('invalid_settings');
 try{new Intl.DateTimeFormat('en',{timeZone:value.timeZone}).format();}catch{throw new Error('invalid_timezone');}
 if(typeof value.timeZone!=='string'||value.timeZone.length>80)throw new Error('invalid_timezone');
 const seen=new Set();for(const r of value.reminders){if(!r||!['morning','evening'].includes(r.kind)||seen.has(r.kind)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))throw new Error('invalid_reminder');seen.add(r.kind);}
 return {timeZone:value.timeZone,reminders:value.reminders.map(({kind,time})=>({kind,time}))};
}
export function subscription(value){
 let url;try{url=new URL(value?.endpoint);}catch{throw new Error('invalid_subscription');}
 if(url.protocol!=='https:'||url.port||url.username||url.password||!['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(url.hostname)||url.pathname.length<2||url.href.length>2048)throw new Error('invalid_endpoint');
 const keys=value?.keys;if(!keys||!/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh)||!/^[A-Za-z0-9_-]{22}$/.test(keys.auth))throw new Error('invalid_keys');
 return {endpoint:url.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export function dueReminders(value,now=new Date()){
 const s=settings(value),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:s.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const minute=Number(parts.hour)*60+Number(parts.minute),date=`${parts.year}-${parts.month}-${parts.day}`;
 return s.reminders.filter(r=>{const [h,m]=r.time.split(':').map(Number),difference=minute-h*60-m;return difference>=0&&difference<10;}).map(r=>({...r,date}));
}
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
