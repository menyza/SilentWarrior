import {socialConfig,socialAuthorization,socialIdentity,pkceHash} from './social-auth.js';
import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse} from '@simplewebauthn/server';
import {hash} from './core.js';
import {accountSchema} from './account-schema.js';
import {normalizeSnapshot} from '../../account-data.js';
const schemas=new WeakMap();
async function schema(env){let pending=schemas.get(env.DB);if(!pending){pending=env.DB.batch(accountSchema.map(sql=>env.DB.prepare(sql)));schemas.set(env.DB,pending);try{await pending;}catch(error){schemas.delete(env.DB);throw error;}}else await pending;}
function response(data,status,origin){return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':origin,'Vary':'Origin'}});}
async function json(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Error('invalid_request');const reader=request.body?.getReader();if(!reader)throw new Error('invalid_request');let length=0,text='';const decoder=new TextDecoder();while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;if(length>1000000){await reader.cancel();throw new Error('body_too_large');}text+=decoder.decode(value,{stream:true});}return JSON.parse(text+decoder.decode());}
const randomToken=()=>[...crypto.getRandomValues(new Uint8Array(32))].map(b=>b.toString(16).padStart(2,'0')).join('');
export async function accountSession(request,env){await schema(env);const token=request.headers.get('Authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];if(!token)return null;return env.DB.prepare('SELECT a.id,a.display_name,s.token_hash FROM account_sessions s JOIN accounts a ON a.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await hash(token),Date.now()).first();}
async function startSession(userId,env){const token=randomToken(),user=await env.DB.prepare('SELECT id,display_name FROM accounts WHERE id=?').bind(userId).first();await env.DB.prepare('INSERT INTO account_sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await hash(token),userId,Date.now()+30*24*60*60*1000).run();return {token,user:{id:user.id,displayName:user.display_name}};}
async function rate(request,env,kind,limit){const bucket=await hash(`${request.headers.get('CF-Connecting-IP')||'local'}:${kind}:${Math.floor(Date.now()/3600000)}`);const row=await env.DB.prepare('INSERT INTO account_rate_limits(bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,Date.now()+3600000).first();return row.count<=limit;}
async function invite(data,env){if(data.enrollmentKey&&env.ENROLLMENT_KEY&&await hash(data.enrollmentKey)===await hash(env.ENROLLMENT_KEY))return true;if(typeof data.deviceToken==='string'&&/^[a-f0-9]{64}$/.test(data.deviceToken)){return !!await env.DB.prepare('SELECT id FROM subscriptions WHERE token_hash=?').bind(await hash(data.deviceToken)).first();}return false;}
async function challenge(env,id,kind){if(typeof id!=='string'||id.length>60)return null;return env.DB.prepare('DELETE FROM account_challenges WHERE id=? AND kind=? AND expires_at>? RETURNING *').bind(id,kind,Date.now()).first();}
const userOut=user=>({id:user.id,displayName:user.display_name});
export async function accountRequest(request,env){
 const origin=env.APP_ORIGIN,path=new URL(request.url).pathname;
 if(!env.DB)return response({error:'account_unavailable'},503,origin);
 try{
  await schema(env);const rpID=new URL(origin).hostname;
  if(path==='/account/social/config'&&request.method==='GET'){const config=socialConfig(env);return response({providers:config?.providers||[]},200,origin);}
  if(path==='/account/social/start'&&request.method==='POST'){
   if(!await rate(request,env,'social',60))return response({error:'rate_limited'},429,origin);
   const config=socialConfig(env);if(!config)return response({error:'social_not_configured'},503,origin);
   const data=await json(request);if(!config.providers.includes(data.provider)||typeof data.pkce!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(data.pkce))return response({error:'invalid_data'},400,origin);
   const owner=data.link?await accountSession(request,env):null;if(data.link&&!owner)return response({error:'login_required'},401,origin);
   const id=crypto.randomUUID(),nonce=randomToken(),details={nonce,pkce:data.pkce,provider:data.provider,issuer:config.issuer,clientId:config.clientId,callback:config.callback};
   await env.DB.prepare('DELETE FROM account_challenges WHERE expires_at<?').bind(Date.now()).run();
   await env.DB.prepare('INSERT INTO account_challenges(id,challenge,kind,user_id,expires_at) VALUES (?,?,?,?,?)').bind(id,JSON.stringify(details),'social',owner?.id||null,Date.now()+600000).run();
   return response({state:id,url:socialAuthorization(config,data.provider,{state:id,nonce,pkce:data.pkce})},200,origin);
  }
  if(path==='/account/social/verify'&&request.method==='POST'){
   if(!await rate(request,env,'social-verify',100))return response({error:'rate_limited'},429,origin);
   const config=socialConfig(env);if(!config)return response({error:'social_not_configured'},503,origin);
   const data=await json(request);if(typeof data.code!=='string'||data.code.length>4096||typeof data.verifier!=='string'||!/^[A-Za-z0-9_-]{43,128}$/.test(data.verifier))return response({error:'invalid_data'},400,origin);
   const pending=await challenge(env,data.state,'social');if(!pending)return response({error:'challenge_expired'},400,origin);
   const details=JSON.parse(pending.challenge);
   if(details.issuer!==config.issuer||details.clientId!==config.clientId||details.callback!==config.callback||!config.providers.includes(details.provider)||await pkceHash(data.verifier)!==details.pkce)return response({error:'social_authentication_failed'},400,origin);
   const owner=pending.user_id?await accountSession(request,env):null;if(pending.user_id&&owner?.id!==pending.user_id)return response({error:'login_required'},401,origin);
   let identity;try{identity=await socialIdentity(config,details,data.code,data.verifier);}catch{return response({error:'social_authentication_failed'},400,origin);}
   const existing=await env.DB.prepare('SELECT user_id FROM account_social_identities WHERE issuer=? AND subject=?').bind(identity.issuer,identity.subject).first();
   if(owner&&existing&&existing.user_id!==owner.id)return response({error:'identity_already_linked'},409,origin);
   let userId=existing?.user_id||owner?.id;
   if(!existing){
    if(owner){await env.DB.prepare('INSERT OR IGNORE INTO account_social_identities(issuer,subject,user_id,provider,created_at) VALUES (?,?,?,?,?)').bind(identity.issuer,identity.subject,owner.id,details.provider,Date.now()).run();}
    else{
     const candidate=crypto.randomUUID(),now=Date.now();
     // Both statements run in one D1 transaction; the UNIQUE issuer/sub key
     // arbitrates concurrent first logins. Re-read the winner, never a loser ID.
     await env.DB.batch([env.DB.prepare('INSERT OR IGNORE INTO accounts(id,display_name,created_at) SELECT ?,?,? WHERE NOT EXISTS (SELECT 1 FROM account_social_identities WHERE issuer=? AND subject=?)').bind(candidate,identity.name,now,identity.issuer,identity.subject),env.DB.prepare('INSERT OR IGNORE INTO account_social_identities(issuer,subject,user_id,provider,created_at) SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM accounts WHERE id=?)').bind(identity.issuer,identity.subject,candidate,details.provider,now,candidate)]);
    }
    const linked=await env.DB.prepare('SELECT user_id FROM account_social_identities WHERE issuer=? AND subject=?').bind(identity.issuer,identity.subject).first();
    if(owner&&linked?.user_id!==owner.id)return response({error:'identity_already_linked'},409,origin);
    userId=linked?.user_id;
   }
   if(!userId)return response({error:'account_unavailable'},503,origin);
   return response(await startSession(userId,env),200,origin);
  }
  if(path==='/account/status'&&request.method==='GET')return response({available:true,method:'passkey',schemaVersion:1},200,origin);
  if(path==='/account/register/options'&&request.method==='POST'){
   if(!await rate(request,env,'register',20))return response({error:'rate_limited'},429,origin);
   const data=await json(request);if(!await invite(data,env))return response({error:'invite_required'},403,origin);
   const displayName=typeof data.displayName==='string'?data.displayName.trim():'';if(!displayName||displayName.length>50)return response({error:'invalid_name'},400,origin);
   const userId=crypto.randomUUID(),options=await generateRegistrationOptions({rpName:'הלוחם השקט',rpID,userName:displayName,userDisplayName:displayName,userID:new TextEncoder().encode(userId),attestationType:'none',timeout:60000,supportedAlgorithmIDs:[-7,-257],authenticatorSelection:{residentKey:'required',userVerification:'required'}}),id=crypto.randomUUID();
   await env.DB.batch(['account_challenges','account_sessions','account_rate_limits'].map(table=>env.DB.prepare(`DELETE FROM ${table} WHERE expires_at<?`).bind(Date.now())));
   await env.DB.prepare('INSERT INTO account_challenges(id,challenge,kind,user_id,display_name,expires_at) VALUES (?,?,?,?,?,?)').bind(id,options.challenge,'register',userId,displayName,Date.now()+300000).run();
   return response({challengeId:id,options},200,origin);
  }
  if(path==='/account/register/verify'&&request.method==='POST'){
   if(!await rate(request,env,'verify',100))return response({error:'rate_limited'},429,origin);
   const data=await json(request),pending=await challenge(env,data.challengeId,'register');if(!pending)return response({error:'challenge_expired'},400,origin);
   let result;try{result=await verifyRegistrationResponse({response:data.credential,expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});}catch{return response({error:'authentication_failed'},400,origin);}
   if(!result.verified)return response({error:'authentication_failed'},400,origin);
   const cred=result.registrationInfo.credential;
   await env.DB.batch([env.DB.prepare('INSERT INTO accounts(id,display_name,created_at) VALUES (?,?,?)').bind(pending.user_id,pending.display_name,Date.now()),env.DB.prepare('INSERT INTO account_credentials(id,user_id,public_key,counter,transports,created_at) VALUES (?,?,?,?,?,?)').bind(cred.id,pending.user_id,Buffer.from(cred.publicKey).toString('base64url'),cred.counter,JSON.stringify(cred.transports||[]),Date.now())]);
   return response(await startSession(pending.user_id,env),201,origin);
  }
  if(path==='/account/login/options'&&request.method==='POST'){
   if(!await rate(request,env,'login',60))return response({error:'rate_limited'},429,origin);
   const options=await generateAuthenticationOptions({rpID,userVerification:'required',timeout:60000}),id=crypto.randomUUID();
   await env.DB.batch(['account_challenges','account_sessions','account_rate_limits'].map(table=>env.DB.prepare(`DELETE FROM ${table} WHERE expires_at<?`).bind(Date.now())));
   await env.DB.prepare('INSERT INTO account_challenges(id,challenge,kind,expires_at) VALUES (?,?,?,?)').bind(id,options.challenge,'login',Date.now()+300000).run();return response({challengeId:id,options},200,origin);
  }
  if(path==='/account/login/verify'&&request.method==='POST'){
   if(!await rate(request,env,'verify',100))return response({error:'rate_limited'},429,origin);
   const data=await json(request),pending=await challenge(env,data.challengeId,'login');if(!pending||typeof data.credential?.id!=='string')return response({error:'challenge_expired'},400,origin);
   const cred=await env.DB.prepare('SELECT * FROM account_credentials WHERE id=?').bind(data.credential.id).first();if(!cred)return response({error:'authentication_failed'},400,origin);
   let result;try{result=await verifyAuthenticationResponse({response:data.credential,expectedChallenge:pending.challenge,expectedOrigin:origin,expectedRPID:rpID,requireUserVerification:true,credential:{id:cred.id,publicKey:Buffer.from(cred.public_key,'base64url'),counter:cred.counter,transports:JSON.parse(cred.transports)}});}catch{return response({error:'authentication_failed'},400,origin);}
   if(!result.verified)return response({error:'authentication_failed'},400,origin);
   const updated=await env.DB.prepare('UPDATE account_credentials SET counter=? WHERE id=? AND counter=? RETURNING id').bind(result.authenticationInfo.newCounter,cred.id,cred.counter).first();if(!updated)return response({error:'authentication_failed'},400,origin);
   return response(await startSession(cred.user_id,env),200,origin);
  }
  const user=await accountSession(request,env);if(!user)return response({error:'login_required'},401,origin);
  if(path==='/account/me'&&request.method==='GET')return response({user:userOut(user)},200,origin);
  if(path==='/account/logout'&&request.method==='POST'){await env.DB.prepare('DELETE FROM account_sessions WHERE token_hash=?').bind(user.token_hash).run();return response({loggedOut:true},200,origin);}
  if(path==='/account/history'&&request.method==='GET'){const {results}=await env.DB.prepare('SELECT revision,created_at FROM account_document_history WHERE user_id=? ORDER BY revision DESC LIMIT 10').bind(user.id).all();return response({versions:results},200,origin);}
  if(/^\/account\/history\/\d+$/.test(path)&&request.method==='GET'){const revision=Number(path.split('/').at(-1));const row=await env.DB.prepare('SELECT revision,data,created_at FROM account_document_history WHERE user_id=? AND revision=?').bind(user.id,revision).first();return response(row?{revision:row.revision,snapshot:JSON.parse(row.data),updatedAt:row.created_at}:{error:'not_found'},row?200:404,origin);}
  if(path==='/account/data'&&request.method==='GET'){
   const row=await env.DB.prepare('SELECT revision,data,updated_at FROM account_documents WHERE user_id=?').bind(user.id).first();return response(row?{revision:row.revision,snapshot:JSON.parse(row.data),updatedAt:row.updated_at}:{revision:0,snapshot:null,updatedAt:null},200,origin);
  }
  if(path==='/account/data'&&request.method==='PUT'){
   const data=await json(request);if(!Number.isInteger(data.revision)||data.revision<0)return response({error:'invalid_revision'},400,origin);
   const snapshot=normalizeSnapshot(data.snapshot),now=Date.now();
   await env.DB.prepare('INSERT OR IGNORE INTO account_documents(user_id,revision,data,updated_at) VALUES (?,0,?,?)').bind(user.id,'null',now).run();
   const updated=await env.DB.prepare('UPDATE account_documents SET revision=revision+1,data=?,updated_at=? WHERE user_id=? AND revision=? RETURNING revision').bind(JSON.stringify(snapshot),now,user.id,data.revision).first();
   if(!updated){const row=await env.DB.prepare('SELECT revision,data FROM account_documents WHERE user_id=?').bind(user.id).first();return response({error:'sync_conflict',revision:row.revision,snapshot:JSON.parse(row.data)},409,origin);}
   return response({revision:updated.revision,updatedAt:now},200,origin);
  }
  return response({error:'not_found'},404,origin);
 }catch(error){const invalid=['invalid_snapshot','invalid_request','body_too_large'].includes(error.message)||error instanceof SyntaxError;return response({error:invalid?'invalid_data':'account_unavailable'},invalid?400:503,origin);}
}
