import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import webpush from 'web-push';
import {createECDH,randomBytes} from 'node:crypto';
import {hash} from '../src/core.js';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const keys=webpush.generateVAPIDKeys(),code=randomBytes(24).toString('hex'),origin='https://menyza.github.io';
let sent=0;
const mf=new Miniflare(convertV4MiniflareOptions({workers:[{name:"test",modules:true,scriptPath:'.wrangler/test-build/worker.js',compatibilityDate:'2026-10-01',compatibilityFlags:['nodejs_compat'],d1Databases:['DB'],bindings:{APP_ORIGIN:origin,VAPID_SUBJECT:origin,VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,ENROLLMENT_KEY:code},outboundService:async request=>{assert.equal(new URL(request.url).hostname,'web.push.apple.com');assert.match(request.headers.get('Authorization'),/vapid/);assert.ok((await request.arrayBuffer()).byteLength>0);sent++;return new Response(null,{status:201});}}]}));
try{
 const db=await mf.getD1Database('DB');await db.exec(readFileSync('migrations/0001_subscriptions.sql','utf8').replace(/\n/g,' '));
 const ec=createECDH('prime256v1');ec.generateKeys();
 const request=(path,method,body,headers={})=>mf.dispatchFetch('https://service.workers.dev'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...headers},...(body?{body:JSON.stringify(body)}:{})});
 const registration=await request('/subscription','POST',{subscription:{endpoint:'https://web.push.apple.com/runtime-test',keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}},settings:{timeZone:'Asia/Jerusalem',reminders:[{kind:'morning',time:'08:00'}]}},{'X-Enrollment-Key':code});
 assert.equal(registration.status,201);const {token}=await registration.json();
 const response=await request('/test','POST',null,{Authorization:`Bearer ${token}`});assert.equal(response.status,200);assert.equal(sent,1);
 assert.equal((await request('/subscription','DELETE',null,{Authorization:`Bearer ${token}`})).status,200);
 await mf.dispatchFetch('https://service.workers.dev/account/status',{headers:{Origin:origin}});
 const session='a'.repeat(64),other='b'.repeat(64);
 for(const [id,value] of [['alice',session],['bob',other]]){
  await db.prepare('INSERT INTO accounts(id,display_name,created_at) VALUES (?,?,?)').bind(id,id,Date.now()).run();
  await db.prepare('INSERT INTO account_sessions(token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(value),id,Date.now()+60000).run();
 }
 const enrolled=await request('/push/subscription','POST',{subscription:{endpoint:'https://web.push.apple.com/account-runtime',keys:{p256dh:ec.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}},settings:{timeZone:'UTC',reminders:[{kind:'evening',time:'20:15'}]}},{Authorization:`Bearer ${session}`});
 assert.equal(enrolled.status,201);const {id}=await enrolled.json(),device='/push/subscription/'+id;
 assert.equal((await request(device,'DELETE',null,{Authorization:`Bearer ${other}`})).status,404);
 assert.equal((await request(device,'PUT',{timeZone:'UTC',reminders:[]},{Authorization:`Bearer ${session}`})).status,200);
 assert.equal((await request(device+'/test','POST',null,{Authorization:`Bearer ${session}`})).status,200);
 assert.equal((await request(device,'DELETE',null,{Authorization:`Bearer ${session}`})).status,200);
 console.log('PASS: account device registration, owner isolation, personal settings, test send and disable in real workerd/D1');
 console.log('PASS: actual Cloudflare workerd runtime, D1 registration, Node-compatible Web Push encryption and VAPID signing, mocked outbound transport, device revocation');
}finally{await mf.dispose();}
