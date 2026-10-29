import {createRemoteJWKSet,jwtVerify} from 'jose';
const connections={google:'google-oauth2',facebook:'facebook',apple:'apple'};
const keysets=new Map();
// Only operator-configured Auth0 tenants are accepted. No client-selected issuers,
// callback URLs or token endpoints; provider secrets stay in Auth0, never this app.
export function socialConfig(env){
 try{
  const issuer=new URL(env.AUTH0_ISSUER);if(issuer.protocol!=='https:'||issuer.username||issuer.password||issuer.port||issuer.pathname!=='/'||issuer.search||issuer.hash)return null;
  if(!env.AUTH0_CLIENT_ID||!env.SOCIAL_CALLBACK_URL)return null;
  const callback=new URL(env.SOCIAL_CALLBACK_URL);if(callback.origin!==env.APP_ORIGIN||callback.search||callback.hash||callback.username||callback.password)return null;
  const providers=(env.AUTH0_PROVIDERS||'').split(',').map(x=>x.trim()).filter(x=>Object.hasOwn(connections,x));
  return providers.length?{issuer:issuer.href,clientId:env.AUTH0_CLIENT_ID,callback:callback.href,providers:[...new Set(providers)]}:null;
 }catch{return null;}
}
export function socialAuthorization(config,provider,{state,nonce,pkce}){
 const url=new URL('authorize',config.issuer);url.search=new URLSearchParams({client_id:config.clientId,redirect_uri:config.callback,response_type:'code',scope:'openid profile',state,nonce,code_challenge:pkce,code_challenge_method:'S256',connection:connections[provider],prompt:'login'});return url.href;
}
export async function socialIdentity(config,pending,code,verifier){
 const token=await fetch(new URL('oauth/token',config.issuer),{method:'POST',redirect:'manual',signal:AbortSignal.timeout(10000),headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:config.clientId,code,code_verifier:verifier,redirect_uri:config.callback})});
 if(!token.ok)throw new Error('social_authentication_failed');
 const data=await token.json();if(typeof data.id_token!=='string'||data.id_token.length>20000)throw new Error('social_authentication_failed');
 let keys=keysets.get(config.issuer);if(!keys){keys=createRemoteJWKSet(new URL('.well-known/jwks.json',config.issuer),{timeoutDuration:10000});keysets.set(config.issuer,keys);}
 const {payload}=await jwtVerify(data.id_token,keys,{issuer:config.issuer,audience:config.clientId,algorithms:['RS256'],requiredClaims:['sub','iat','exp','nonce'],maxTokenAge:'10m',clockTolerance:5});
 // Auth0's social sub prefixes identify the selected connection. Email is never
 // used to merge accounts, including Apple private-relay addresses.
 const prefix={google:'google-oauth2|',facebook:'facebook|',apple:'apple|'}[pending.provider];
 if(payload.nonce!==pending.nonce||typeof payload.sub!=='string'||payload.sub.length>512||!payload.sub.startsWith(prefix)||(payload.azp&&payload.azp!==config.clientId))throw new Error('social_authentication_failed');
 return {issuer:config.issuer,subject:payload.sub,name:typeof payload.name==='string'?payload.name.trim().slice(0,50)||'הלוחם השקט':'הלוחם השקט'};
}
export async function pkceHash(verifier){return Buffer.from(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))).toString('base64url');}
