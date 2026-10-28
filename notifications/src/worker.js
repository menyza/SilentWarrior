import webpush from 'web-push';
import {settings,subscription,dueReminders,hash} from './core.js';
function reply(data,status=200,origin){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}});}
async function body(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Error('json_required');const text=await request.text();if(text.length>8192)throw new Error('body_too_large');return JSON.parse(text);}
async function authorized(request,env){const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return env.DB.prepare('SELECT * FROM subscriptions WHERE token_hash = ?').bind(await hash(token)).first();}
export async function sendPush(row,env,payload,send=(...args)=>globalThis.fetch(...args)){
 const details=webpush.generateRequestDetails({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify(payload),{TTL:1800,urgency:'normal',vapidDetails:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
 const result=await send(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'manual'});
 if(result.status===404||result.status===410){await env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(row.id).run();return 'expired';}
 if(!result.ok)throw new Error('push_delivery_failed');return 'sent';
}
export async function handle(request,env){
 const origin=request.headers.get('Origin');if(origin!==env.APP_ORIGIN)return reply({error:'origin_not_allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Enrollment-Key','Access-Control-Max-Age':'600','Vary':'Origin'}});
 if(!env.DB||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY||!env.ENROLLMENT_KEY)return reply({error:'service_not_configured'},503,origin);
 const path=new URL(request.url).pathname;
 try{
  if(path==='/public-key'&&request.method==='GET')return reply({publicKey:env.VAPID_PUBLIC_KEY},200,origin);
  if(path==='/subscription'&&request.method==='POST'){
   if(await hash(request.headers.get('X-Enrollment-Key')||'')!==await hash(env.ENROLLMENT_KEY))return reply({error:'invalid_enrollment_key'},401,origin);
   const data=await body(request),sub=subscription(data.subscription),prefs=settings(data.settings);
   const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM subscriptions').first();const existing=await env.DB.prepare('SELECT id FROM subscriptions WHERE endpoint = ?').bind(sub.endpoint).first();if(count.count>=20&&!existing)return reply({error:'device_limit'},429,origin);
   const id=crypto.randomUUID(),token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
   try{await env.DB.prepare('INSERT INTO subscriptions (id,token_hash,endpoint,p256dh,auth,settings) VALUES (?,?,?,?,?,?) ON CONFLICT(endpoint) DO UPDATE SET id=excluded.id,token_hash=excluded.token_hash,p256dh=excluded.p256dh,auth=excluded.auth,settings=excluded.settings').bind(id,await hash(token),sub.endpoint,sub.keys.p256dh,sub.keys.auth,JSON.stringify(prefs)).run();}catch{return reply({error:'subscription_exists_or_unavailable'},409,origin);}
   return reply({token},201,origin);
  }
  const row=await authorized(request,env);if(!row){if(path==='/subscription'&&request.method==='DELETE')return reply({deleted:true},200,origin);return reply({error:'unauthorized'},401,origin);}
  if(path==='/subscription'&&request.method==='PUT'){const prefs=settings(await body(request));await env.DB.prepare('UPDATE subscriptions SET settings = ? WHERE id = ?').bind(JSON.stringify(prefs),row.id).run();return reply({saved:true},200,origin);}
  if(path==='/subscription'&&request.method==='DELETE'){await env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(row.id).run();return reply({deleted:true},200,origin);}
  if(path==='/test'&&request.method==='POST'){
   const now=Date.now(),result=await env.DB.prepare('UPDATE subscriptions SET last_test = ? WHERE id = ? AND last_test < ? RETURNING id').bind(now,row.id,now-60000).first();if(!result)return reply({error:'wait_one_minute'},429,origin);
   const status=await sendPush(row,env,{title:'הלוחם השקט · בדיקת התראה',body:'אם ההתראה הגיעה, החיבור למכשיר עובד. אפשר לחזור לשגרה שלך.'});return reply({status},status==='expired'?410:200,origin);
  }
  return reply({error:'not_found'},404,origin);
 }catch(error){const invalid=['invalid_settings','invalid_timezone','invalid_reminder','invalid_subscription','invalid_endpoint','invalid_keys','json_required','body_too_large'].includes(error.message)||error instanceof SyntaxError;return reply({error:invalid?'invalid_request':'service_error'},invalid?400:503,origin);}
}
export async function scheduled(env,now=new Date()){
 const {results}=await env.DB.prepare('SELECT * FROM subscriptions LIMIT 20').all();
 for(const row of results){let due;try{due=dueReminders(JSON.parse(row.settings),now);}catch{continue;}
  for(const reminder of due){const column=reminder.kind==='morning'?'last_morning':'last_evening',claim=`${reminder.date}:${crypto.randomUUID()}`;
   const claimed=await env.DB.prepare(`UPDATE subscriptions SET ${column} = ? WHERE id = ? AND (${column} IS NULL OR ${column} NOT LIKE ?) RETURNING id`).bind(claim,row.id,`${reminder.date}:%`).first();if(!claimed)continue;
   try{await sendPush(row,env,{title:reminder.kind==='morning'?'בוקר טוב, הלוחם השקט':'רגע לשגרת הערב',body:'זמן לפעולה קטנה בשבילך. פותחים ובוחרים מה מתאים עכשיו.'});}
   catch{await env.DB.prepare(`UPDATE subscriptions SET ${column} = NULL WHERE id = ? AND ${column} = ?`).bind(row.id,claim).run();}
  }
 }
}
export default {fetch:handle,scheduled(controller,env,ctx){ctx.waitUntil(scheduled(env,new Date(controller.scheduledTime)));}};
