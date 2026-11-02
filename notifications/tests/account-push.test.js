import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {handle,scheduled} from '../src/worker.js';
import {hash} from '../src/core.js';
import webpush from 'web-push';
import {createECDH,randomBytes} from 'node:crypto';
function database(){const sql=new DatabaseSync(':memory:');sql.exec(readFileSync(new URL('../migrations/0001_subscriptions.sql',import.meta.url),'utf8'));return {prepare(query){const make=params=>({first:async()=>sql.prepare(query).get(...params)||null,run:async()=>sql.prepare(query).run(...params),all:async()=>({results:sql.prepare(query).all(...params)})});return {...make([]),bind(...params){return make(params);}};},async batch(statements){sql.exec('BEGIN');try{const result=[];for(const s of statements)result.push(await s.run());sql.exec('COMMIT');return result;}catch(e){sql.exec('ROLLBACK');throw e;}}};}
const origin='https://menyza.github.io';
function request(path,method='GET',data,token){return new Request('https://service.workers.dev'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});}
async function setup(){const env={DB:database(),APP_ORIGIN:origin,...(()=>{const k=webpush.generateVAPIDKeys();return {VAPID_SUBJECT:origin,VAPID_PUBLIC_KEY:k.publicKey,VAPID_PRIVATE_KEY:k.privateKey};})()};assert.equal((await handle(request('/account/status'),env)).status,200);for(const [id,token] of [['A','a'.repeat(64)],['B','b'.repeat(64)]]){await env.DB.prepare('INSERT INTO accounts(id,display_name,created_at) VALUES (?,?,?)').bind(id,id,Date.now()).run();await env.DB.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(token),id,Date.now()+3600000).run();}return env;}
const a='a'.repeat(64),b='b'.repeat(64),prefs={timeZone:'Asia/Jerusalem',reminders:[{kind:'morning',time:'08:00'}]};
function subscription(name){const ec=createECDH('prime256v1');ec.generateKeys();return {endpoint:'https://web.push.apple.com/'+name,keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}};}
async function enroll(env,sub,token=a,extra={}){const r=await handle(request('/push/subscription','POST',{subscription:sub,settings:prefs,...extra},token),env);assert.equal(r.status,201,JSON.stringify(await r.clone().json()));return (await r.json()).id;}
const path=id=>'/push/subscription/'+id;
test('account enrollment without key; devices, preferences and operations are isolated',async()=>{
 const env=await setup(),sub=subscription('alice'),id=await enroll(env,sub,a,{userId:'B'}),bob=await enroll(env,subscription('bob'),b);
 assert.equal((await env.DB.prepare('SELECT user_id FROM subscription_owners WHERE subscription_id=?').bind(id).first()).user_id,'A');
 for(const [method,suffix,data] of [['GET',''],['PUT','',{...prefs,reminders:[]}],['POST','/test'],['DELETE','']]){
  assert.equal((await handle(request(path(id)+suffix,method,data,b),env)).status,404);
  assert.equal((await handle(request(path(id)+suffix,method,data),env)).status,401);
 }
 assert.equal((await handle(request('/push/subscription','POST',{subscription:sub,settings:prefs},b),env)).status,409);
 assert.equal((await handle(request('/push/subscription','POST',{subscription:subscription('guest'),settings:prefs}),env)).status,401);
 assert.equal((await handle(request(path(id),'PUT',{timeZone:'UTC',reminders:[{kind:'evening',time:'19:15'}]},a),env)).status,200);
 assert.deepEqual((await (await handle(request(path(bob),'GET',undefined,b),env)).json()).settings,prefs);
 assert.equal((await handle(request(path(id),'DELETE',undefined,a),env)).status,200);
 assert.equal((await handle(request(path(bob),'GET',undefined,b),env)).status,200);
 assert.equal(await env.DB.prepare('SELECT id FROM subscriptions WHERE id=?').bind(id).first(),null);
 assert.equal((await handle(request(path(id),'DELETE',undefined,a),env)).status,200);
 const replacement=await enroll(env,sub,a);assert.notEqual(replacement,id);
 assert.equal((await handle(request(path(replacement),'PUT',{...prefs,timeZone:'invalid'},a),env)).status,400);
 await env.DB.prepare('UPDATE account_sessions SET expires_at=0 WHERE user_id=?').bind('B').run();
 assert.equal((await handle(request(path(bob),'PUT',prefs,b),env)).status,401);
});
test('legacy registrations remain valid, adoption needs their token, enrollment cannot steal account devices',async()=>{
 const env=await setup();env.ENROLLMENT_KEY='existing-key';const sub=subscription('legacy');
 const legacy=()=>handle(new Request('https://service.workers.dev/subscription',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','X-Enrollment-Key':env.ENROLLMENT_KEY},body:JSON.stringify({subscription:sub,settings:prefs})}),env);
 const r=await legacy();assert.equal(r.status,201);const {token}=await r.json(),old=await env.DB.prepare('SELECT * FROM subscriptions WHERE endpoint=?').bind(sub.endpoint).first();
 await env.DB.prepare("UPDATE subscriptions SET last_morning='2026-10-28:already-sent' WHERE id=?").bind(old.id).run();
 assert.equal((await handle(request('/push/subscription','POST',{subscription:sub,settings:prefs},a),env)).status,409);
 assert.equal((await handle(request('/subscription','PUT',prefs,token),env)).status,200);
 const id=await enroll(env,sub,a,{deviceToken:token});assert.equal(id,old.id);
 assert.equal((await env.DB.prepare('SELECT last_morning FROM subscriptions WHERE id=?').bind(id).first()).last_morning,'2026-10-28:already-sent');
 assert.equal((await handle(request('/subscription','PUT',prefs,token),env)).status,401);
 assert.equal((await legacy()).status,409);delete env.ENROLLMENT_KEY;
 assert.equal((await handle(request('/public-key'),env)).status,200);
 assert.equal((await handle(request('/subscription','POST',{subscription:subscription('no-key'),settings:prefs}),env)).status,401);
 assert.equal(await enroll(env,sub),id);
});
test('personal schedules, delivery and disable per device; scheduler includes more than 20 devices',async()=>{
 const env=await setup(),ids=[];
 for(let i=0;i<21;i++)ids.push(await enroll(env,subscription('device-'+i),i===20?b:a));
 assert.equal((await handle(request('/push/subscription','POST',{subscription:subscription('over-limit'),settings:prefs},a),env)).status,409);
 assert.equal(await enroll(env,subscription('device-0')),ids[0]);
 await handle(request(path(ids[0]),'PUT',{...prefs,reminders:[]},a),env);
 await handle(request(path(ids[1]),'DELETE',undefined,a),env);
 const oldFetch=globalThis.fetch,sent=[];globalThis.fetch=async(endpoint)=>{sent.push(endpoint);return new Response(null,{status:201});};
 try{
  await scheduled(env,new Date('2026-10-28T06:00:00Z'));assert.equal(sent.length,19);assert.ok(sent.includes('https://web.push.apple.com/device-20'));assert.ok(!sent.includes('https://web.push.apple.com/device-0'));
  await scheduled(env,new Date('2026-10-28T06:05:00Z'));assert.equal(sent.length,19);
  assert.equal((await handle(request(path(ids[20])+'/test','POST',undefined,b),env)).status,200);
  assert.equal((await handle(request(path(ids[20])+'/test','POST',undefined,b),env)).status,429);
 }finally{globalThis.fetch=oldFetch;}
});

test('water intervals deduplicate each slot, keep sending after a water habit mark and stop at the daily goal',async()=>{
 const env=await setup(),id=await enroll(env,subscription('interval-water')),date='2026-11-01';
 const prefs={timeZone:'Asia/Jerusalem',reminders:[{id:'water',kind:'water',intervalMinutes:60}]};
 assert.equal((await handle(request(path(id),'PUT',prefs,a),env)).status,200);
 const snapshot=(await import('../../account-data.js')).emptySnapshot();snapshot.state.days[date]={'1-6':'done'};
 await handle(request('/account/data','PUT',{revision:0,snapshot},a),env);
 const oldFetch=globalThis.fetch;let sends=0;globalThis.fetch=async()=>{sends++;return new Response(null,{status:201});};
 try{
  await scheduled(env,new Date('2026-11-01T06:55:00Z'));assert.equal(sends,0);
  await scheduled(env,new Date('2026-11-01T07:00:00Z'));await scheduled(env,new Date('2026-11-01T07:05:00Z'));assert.equal(sends,1);
  await scheduled(env,new Date('2026-11-01T08:00:00Z'));assert.equal(sends,2);
  snapshot.state.waterGoal=1000;snapshot.state.water={[date]:{'11111111-1111-4111-8111-111111111111':{kind:'water',ml:1000,at:100}}};
  assert.equal((await handle(request('/account/data','PUT',{revision:1,snapshot},a),env)).status,200);
  await scheduled(env,new Date('2026-11-01T09:00:00Z'));assert.equal(sends,2);
  await scheduled(env,new Date('2026-11-01T21:05:00Z'));assert.equal(sends,2);
 }finally{globalThis.fetch=oldFetch;}
});
test('habit delivery uses the owning account completion and suppresses only that user after marking',async()=>{
 const env=await setup(),alice=await enroll(env,subscription('habit-alice'),a),bob=await enroll(env,subscription('habit-bob'),b);
 const prefs={timeZone:'UTC',reminders:[{id:'reading',kind:'habit',habitId:'1-1',topic:'קריאה',time:'12:00'}]};
 await handle(request(path(alice),'PUT',prefs,a),env);await handle(request(path(bob),'PUT',prefs,b),env);
 const snapshot=(await import('../../account-data.js')).emptySnapshot();snapshot.state.days['2026-11-01']={'1-1':'done'};
 await handle(request('/account/data','PUT',{revision:0,snapshot},a),env);
 const oldFetch=globalThis.fetch,sent=[];globalThis.fetch=async url=>{sent.push(url);return new Response(null,{status:201});};
 try{await scheduled(env,new Date('2026-11-01T12:00:00Z'));assert.deepEqual(sent,['https://web.push.apple.com/habit-bob']);await scheduled(env,new Date('2026-11-01T12:05:00Z'));assert.equal(sent.length,1);}finally{globalThis.fetch=oldFetch;}
});

test('Custom workout types and history persist across legacy account saves',async()=>{
 const env=await setup(),token='a'.repeat(64),{emptySnapshot}=await import('../../account-data.js');
 const snapshot=emptySnapshot();snapshot.state.customWorkoutTypes=['פילאטיס'];snapshot.state.workouts['2026-11-01']='פילאטיס';snapshot.state.days['2026-11-01']={'1-2':'done'};
 assert.equal((await handle(request('/account/data','PUT',{revision:0,snapshot},token),env)).status,200);
 const legacy=structuredClone(snapshot);delete legacy.state.customWorkoutTypes;legacy.state.workouts={};
 assert.equal((await handle(request('/account/data','PUT',{revision:1,snapshot:legacy},token),env)).status,200);
 const saved=await (await handle(request('/account/data','GET',undefined,token),env)).json();
 assert.deepEqual(saved.snapshot.state.customWorkoutTypes,['פילאטיס']);assert.equal(saved.snapshot.state.workouts['2026-11-01'],'פילאטיס');
});

test('Adaptive habit scheduling uses only owner timing, deduplicates, skips completed habits and preserves timestamps on legacy saves',async()=>{
 const env=await setup(),{emptySnapshot}=await import('../../account-data.js'),snapshot=emptySnapshot();
 for(let n=26;n<=30;n++){const date=`2026-10-${n}`;snapshot.state.days[date]={'1-1':'done'};snapshot.state.habitTimes[date]={'1-1':Date.parse(date+'T10:00:00+02:00')};}
 assert.equal((await handle(request('/account/data','PUT',{revision:0,snapshot},a),env)).status,200);
 const settings={timeZone:'Asia/Jerusalem',reminders:[{id:'read',kind:'habit',habitId:'1-1',topic:'קריאה',time:'18:00',adaptive:true}]};
 await enroll(env,subscription('learned-alice'),a,{settings});await enroll(env,subscription('fallback-bob'),b,{settings});
 const oldFetch=globalThis.fetch,sent=[];globalThis.fetch=async url=>{sent.push(url);return new Response(null,{status:201});};
 try{
  await scheduled(env,new Date('2026-11-02T08:25:00Z'));assert.equal(sent.length,0);
  await scheduled(env,new Date('2026-11-02T08:30:00Z'));await scheduled(env,new Date('2026-11-02T08:35:00Z'));assert.deepEqual(sent,['https://web.push.apple.com/learned-alice']);
  await scheduled(env,new Date('2026-11-02T16:00:00Z'));assert.deepEqual(sent,['https://web.push.apple.com/learned-alice','https://web.push.apple.com/fallback-bob']);
  const legacy=structuredClone(snapshot);delete legacy.state.habitTimes;assert.equal((await handle(request('/account/data','PUT',{revision:1,snapshot:legacy},a),env)).status,200);
  const saved=await (await handle(request('/account/data','GET',undefined,a),env)).json();assert.deepEqual(saved.snapshot.state.habitTimes,snapshot.state.habitTimes);
  saved.snapshot.state.days['2026-11-03']={'1-1':'done'};assert.equal((await handle(request('/account/data','PUT',{revision:2,snapshot:saved.snapshot},a),env)).status,200);
  await scheduled(env,new Date('2026-11-03T08:30:00Z'));assert.equal(sent.length,2);
 }finally{globalThis.fetch=oldFetch;}
});
