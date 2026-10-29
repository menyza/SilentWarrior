import {accountSession,accountRequest} from './accounts.js';
import webpush from 'web-push';
import {settings,subscription,dueReminders,hash} from './core.js';
const ownerSchema='CREATE TABLE IF NOT EXISTS subscription_owners (subscription_id TEXT PRIMARY KEY REFERENCES subscriptions(id) ON DELETE CASCADE, user_id TEXT NOT NULL)';
function reply(data,status=200,origin){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,'Vary':'Origin'}:{})}});}
async function body(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Error('json_required');const text=await request.text();if(text.length>8192)throw new Error('body_too_large');return JSON.parse(text);}
async function authorized(request,env){const token=request.headers.get('Authorization')?.replace(/^Bearer /,'');if(!token||!/^[a-f0-9]{64}$/.test(token))return null;return env.DB.prepare('SELECT * FROM subscriptions WHERE token_hash = ?').bind(await hash(token)).first();}
export async function sendPush(row,env,payload,send=(...args)=>globalThis.fetch(...args)){
 const details=webpush.generateRequestDetails({endpoint:row.endpoint,keys:{p256dh:row.p256dh,auth:row.auth}},JSON.stringify(payload),{TTL:1800,urgency:'normal',vapidDetails:{subject:env.VAPID_SUBJECT,publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY}});
 const result=await send(details.endpoint,{method:'POST',headers:details.headers,body:details.body,redirect:'manual'});
 if(result.status===404||result.status===410){await env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(row.id).run();return 'expired';}
 if(!result.ok)throw new Error([401,403].includes(result.status)?'push_provider_rejected':'push_delivery_failed');return 'sent';
}
// Account sessions authorize every device operation; client-supplied owner IDs are ignored.
async function accountPush(request,env,path,origin){
 const user=await accountSession(request,env);if(!user)return reply({error:'login_required'},401,origin);
 if(path==='/push/subscription'&&request.method==='POST'){
  const data=await body(request),sub=subscription(data.subscription),prefs=settings(data.settings);
  const deviceHash=await hash(typeof data.deviceToken==='string'?data.deviceToken:'');
  const id=crypto.randomUUID(),tokenHash=await hash(crypto.randomUUID());
  // A conditional upsert and owner insertion share one D1 transaction. A known endpoint
  // alone cannot claim another account's device or an existing legacy registration.
  await env.DB.batch([
   env.DB.prepare(`INSERT INTO subscriptions (id,token_hash,endpoint,p256dh,auth,settings)
    SELECT ?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM subscription_owners WHERE user_id=?)<20
    OR EXISTS (SELECT 1 FROM subscriptions s JOIN subscription_owners o ON o.subscription_id=s.id WHERE s.endpoint=? AND o.user_id=?)
    ON CONFLICT(endpoint) DO UPDATE SET token_hash=excluded.token_hash,p256dh=excluded.p256dh,auth=excluded.auth,settings=excluded.settings
    WHERE EXISTS (SELECT 1 FROM subscription_owners WHERE subscription_id=subscriptions.id AND user_id=?)
    OR (NOT EXISTS (SELECT 1 FROM subscription_owners WHERE subscription_id=subscriptions.id) AND subscriptions.token_hash=?)`)
    .bind(id,tokenHash,sub.endpoint,sub.keys.p256dh,sub.keys.auth,JSON.stringify(prefs),user.id,sub.endpoint,user.id,user.id,deviceHash),
   env.DB.prepare('INSERT OR IGNORE INTO subscription_owners(subscription_id,user_id) SELECT id,? FROM subscriptions WHERE token_hash=?').bind(user.id,tokenHash)
  ]);
  const saved=await env.DB.prepare('SELECT id FROM subscriptions WHERE token_hash=?').bind(tokenHash).first();
  if(!saved)return reply({error:'subscription_owned_or_limit'},409,origin);
  return reply({id:saved.id,settings:prefs},201,origin);
 }
 const match=path.match(/^\/push\/subscription\/([^/]+)(\/test)?$/);if(!match)return reply({error:'not_found'},404,origin);
 const row=await env.DB.prepare('SELECT s.* FROM subscriptions s JOIN subscription_owners o ON o.subscription_id=s.id WHERE s.id=? AND o.user_id=?').bind(match[1],user.id).first();
 if(!row){
  if(!match[2]&&request.method==='DELETE'&&!await env.DB.prepare('SELECT id FROM subscriptions WHERE id=?').bind(match[1]).first())return reply({deleted:true},200,origin);
  return reply({error:'not_found'},404,origin);
 }
 if(!match[2]&&request.method==='GET')return reply({id:row.id,settings:JSON.parse(row.settings)},200,origin);
 if(!match[2]&&request.method==='PUT'){
  const prefs=settings(await body(request));await env.DB.prepare('UPDATE subscriptions SET settings=? WHERE id=?').bind(JSON.stringify(prefs),row.id).run();return reply({saved:true},200,origin);
 }
 if(!match[2]&&request.method==='DELETE'){
  await env.DB.batch([env.DB.prepare('DELETE FROM subscription_owners WHERE subscription_id=? AND user_id=?').bind(row.id,user.id),env.DB.prepare('DELETE FROM subscriptions WHERE id=?').bind(row.id)]);
  return reply({deleted:true},200,origin);
 }
 if(match[2]&&request.method==='POST'){
  const now=Date.now(),claimed=await env.DB.prepare('UPDATE subscriptions SET last_test=? WHERE id=? AND last_test<? RETURNING id').bind(now,row.id,now-60000).first();
  if(!claimed)return reply({error:'wait_one_minute'},429,origin);
  let status;try{status=await sendPush(row,env,{title:'הלוחם השקט · בדיקת התראה',body:'אם ההתראה הגיעה, החיבור למכשיר עובד. אפשר לחזור לשגרה שלך.'});}catch(error){await env.DB.prepare('UPDATE subscriptions SET last_test=0 WHERE id=? AND last_test=?').bind(row.id,now).run();throw error;}return reply(status==='expired'?{status,error:'subscription_expired'}:{status},status==='expired'?410:200,origin);
 }
 return reply({error:'not_found'},404,origin);
}

export async function handle(request,env){
 const origin=request.headers.get('Origin');if(origin!==env.APP_ORIGIN)return reply({error:'origin_not_allowed'},403);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization, X-Enrollment-Key','Access-Control-Max-Age':'600','Vary':'Origin'}});
 if(new URL(request.url).pathname.startsWith('/account/'))return accountRequest(request,env);
 if(!env.DB||!env.VAPID_PUBLIC_KEY||!env.VAPID_PRIVATE_KEY)return reply({error:'service_not_configured'},503,origin);
 const path=new URL(request.url).pathname;
 try{
  await env.DB.prepare(ownerSchema).run();
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS subscription_owners_user ON subscription_owners(user_id)').run();
  if(path.startsWith('/push/'))return await accountPush(request,env,path,origin);
  if(path==='/public-key'&&request.method==='GET')return reply({publicKey:env.VAPID_PUBLIC_KEY},200,origin);
  if(path==='/subscription'&&request.method==='POST'){
   if(!env.ENROLLMENT_KEY||await hash(request.headers.get('X-Enrollment-Key')||'')!==await hash(env.ENROLLMENT_KEY))return reply({error:'invalid_enrollment_key'},401,origin);
   const data=await body(request),sub=subscription(data.subscription),prefs=settings(data.settings);
   const count=await env.DB.prepare('SELECT COUNT(*) AS count FROM subscriptions s WHERE NOT EXISTS (SELECT 1 FROM subscription_owners o WHERE o.subscription_id=s.id)').first();const existing=await env.DB.prepare('SELECT id FROM subscriptions WHERE endpoint = ?').bind(sub.endpoint).first();if(count.count>=20&&!existing)return reply({error:'device_limit'},429,origin);
   if(existing&&await env.DB.prepare('SELECT user_id FROM subscription_owners WHERE subscription_id=?').bind(existing.id).first())return reply({error:'subscription_owned'},409,origin);
   const id=crypto.randomUUID(),token=[...crypto.getRandomValues(new Uint8Array(32))].map(x=>x.toString(16).padStart(2,'0')).join('');
   try{const saved=await env.DB.prepare('INSERT INTO subscriptions (id,token_hash,endpoint,p256dh,auth,settings) SELECT ?,?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM subscriptions s JOIN subscription_owners o ON o.subscription_id=s.id WHERE s.endpoint=?) ON CONFLICT(endpoint) DO UPDATE SET id=excluded.id,token_hash=excluded.token_hash,p256dh=excluded.p256dh,auth=excluded.auth,settings=excluded.settings WHERE NOT EXISTS (SELECT 1 FROM subscription_owners WHERE subscription_id=subscriptions.id) RETURNING id').bind(id,await hash(token),sub.endpoint,sub.keys.p256dh,sub.keys.auth,JSON.stringify(prefs),sub.endpoint).first();if(!saved)return reply({error:'subscription_owned'},409,origin);}catch{return reply({error:'subscription_exists_or_unavailable'},409,origin);}
   return reply({token},201,origin);
  }
  const row=await authorized(request,env);if(!row){if(path==='/subscription'&&request.method==='DELETE')return reply({deleted:true},200,origin);return reply({error:'unauthorized'},401,origin);}
  if(await env.DB.prepare('SELECT user_id FROM subscription_owners WHERE subscription_id=?').bind(row.id).first())return reply({error:'unauthorized'},401,origin);
  if(path==='/subscription'&&request.method==='PUT'){const prefs=settings(await body(request));await env.DB.prepare('UPDATE subscriptions SET settings = ? WHERE id = ?').bind(JSON.stringify(prefs),row.id).run();return reply({saved:true},200,origin);}
  if(path==='/subscription'&&request.method==='DELETE'){await env.DB.prepare('DELETE FROM subscriptions WHERE id = ?').bind(row.id).run();return reply({deleted:true},200,origin);}
  if(path==='/test'&&request.method==='POST'){
   const now=Date.now(),result=await env.DB.prepare('UPDATE subscriptions SET last_test = ? WHERE id = ? AND last_test < ? RETURNING id').bind(now,row.id,now-60000).first();if(!result)return reply({error:'wait_one_minute'},429,origin);
   let status;try{status=await sendPush(row,env,{title:'הלוחם השקט · בדיקת התראה',body:'אם ההתראה הגיעה, החיבור למכשיר עובד. אפשר לחזור לשגרה שלך.'});}catch(error){await env.DB.prepare('UPDATE subscriptions SET last_test=0 WHERE id=? AND last_test=?').bind(row.id,now).run();throw error;}return reply(status==='expired'?{status,error:'subscription_expired'}:{status},status==='expired'?410:200,origin);
  }
  return reply({error:'not_found'},404,origin);
 }catch(error){if(['push_provider_rejected','push_delivery_failed'].includes(error.message))return reply({error:error.message},502,origin);const invalid=['invalid_settings','invalid_timezone','invalid_reminder','invalid_subscription','invalid_endpoint','invalid_keys','json_required','body_too_large'].includes(error.message)||error instanceof SyntaxError;return reply({error:invalid?'invalid_request':'service_error'},invalid?400:503,origin);}
}
export async function scheduled(env,now=new Date()){
 let cursor='';
 while(true){
 const {results}=await env.DB.prepare('SELECT * FROM subscriptions WHERE id>? ORDER BY id LIMIT 100').bind(cursor).all();
 if(!results.length)break;cursor=results.at(-1).id;
 for(const row of results){let due;try{due=dueReminders(JSON.parse(row.settings),now);}catch{continue;}
  for(const reminder of due){const column=reminder.kind==='morning'?'last_morning':'last_evening',claim=`${reminder.date}:${crypto.randomUUID()}`;
   const claimed=await env.DB.prepare(`UPDATE subscriptions SET ${column} = ? WHERE id = ? AND (${column} IS NULL OR ${column} NOT LIKE ?) RETURNING id`).bind(claim,row.id,`${reminder.date}:%`).first();if(!claimed)continue;
   try{await sendPush(row,env,{title:reminder.kind==='morning'?'בוקר טוב, הלוחם השקט':'רגע לשגרת הערב',body:'זמן לפעולה קטנה בשבילך. פותחים ובוחרים מה מתאים עכשיו.'});}
   catch{await env.DB.prepare(`UPDATE subscriptions SET ${column} = NULL WHERE id = ? AND ${column} = ?`).bind(row.id,claim).run();}
  }
 }
 }
}
export default {fetch:handle,scheduled(controller,env,ctx){ctx.waitUntil(scheduled(env,new Date(controller.scheduledTime)));}};
