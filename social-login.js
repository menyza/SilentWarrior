// OAuth authorization-code + PKCE: verifier stays in this tab, never in a URL.
const KEY='silent-warrior-social-request-v1';
const encode=value=>btoa(String.fromCharCode(...new Uint8Array(value))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export async function beginSocial(api,provider,owner){
 const verifier=encode(crypto.getRandomValues(new Uint8Array(32)));
 const pkce=encode(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
 const result=await api('/account/social/start',{method:'POST',body:{provider,pkce,link:!!owner}});
 // Fail before navigating when tab storage is unavailable. The app data remains.
 sessionStorage.setItem(KEY,JSON.stringify({state:result.state,verifier,owner:owner||null,createdAt:Date.now()}));
 location.assign(result.url);
}
export async function finishSocial(api,owner){
 const url=new URL(location.href);if(!url.searchParams.has('state')||(!url.searchParams.has('code')&&!url.searchParams.has('error')))return null;
 const state=url.searchParams.get('state'),code=url.searchParams.get('code'),error=url.searchParams.get('error');
 for(const key of ['code','state','error','error_description'])url.searchParams.delete(key);
 history.replaceState(null,'',url.pathname+url.search+url.hash);
 let pending;try{pending=JSON.parse(sessionStorage.getItem(KEY));}catch{}
 sessionStorage.removeItem(KEY);
 if(!pending||pending.state!==state||Date.now()-pending.createdAt>600000||pending.owner!==(owner||null))throw new Error('לא נמצאה בקשת כניסה תואמת בחלון הזה. חזור לחשבון שלי ונסה שוב באותו דפדפן.');
 if(error)throw new Error('הכניסה אצל ספק ההתחברות בוטלה או לא אושרה. ההתקדמות לא השתנתה.');
 return api('/account/social/verify',{method:'POST',body:{state,code,verifier:pending.verifier}});
}
