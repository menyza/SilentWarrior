import {reminderSettings} from '../../reminder-settings.js';
export const settings=reminderSettings;
export function subscription(value){
 let url;try{url=new URL(value?.endpoint);}catch{throw new Error('invalid_subscription');}
 if(url.protocol!=='https:'||url.port||url.username||url.password||!['web.push.apple.com','fcm.googleapis.com','updates.push.services.mozilla.com'].includes(url.hostname)||url.pathname.length<2||url.href.length>2048)throw new Error('invalid_endpoint');
 const keys=value?.keys;if(!keys||!/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh)||!/^[A-Za-z0-9_-]{22}$/.test(keys.auth))throw new Error('invalid_keys');
 return {endpoint:url.href,keys:{p256dh:keys.p256dh,auth:keys.auth}};
}
export function dueReminders(value,now=new Date()){
 const s=settings(value),parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:s.timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 const minute=Number(parts.hour)*60+Number(parts.minute),date=`${parts.year}-${parts.month}-${parts.day}`;
 const weekday=new Date(date+'T12:00:00Z').getUTCDay();
 return s.reminders.flatMap(r=>{
  const [h,m]=r.time.split(':').map(Number),difference=minute-h*60-m;
  // Cron can first encounter a 23:59 reminder after midnight. Attribute it to
  // the previous local calendar day, including its selected weekday.
  const previous=difference<0,elapsed=previous?difference+1440:difference;
  if(elapsed>=10)return [];
  const reminderDay=previous?(weekday+6)%7:weekday;
  if(r.days&&!r.days.includes(reminderDay))return [];
  const reminderDate=previous?new Date(Date.parse(date+'T12:00:00Z')-86400000).toISOString().slice(0,10):date;
  return [{...r,date:reminderDate}];
 });
}
export async function hash(value){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
