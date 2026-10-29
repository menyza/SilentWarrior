import {beginSocial,finishSocial} from './social-login.js';
import {emptySnapshot,normalizeSnapshot,meaningful,mergeSnapshots} from './account-data.js';
import {escapeHtml} from './habit-catalog.js';
const SESSION='silent-warrior-account-v1',BASE='silent-warrior-account-base-v1',GUEST='silent-warrior-guest-backup-v1';
const API=()=>document.querySelector('meta[name="account-api"]')?.content||'https://silentwarrior.menyzakar142.workers.dev';
let socialProviders=null;
let hooks=null,auth=read(SESSION),baseline=read(BASE),pending=null,conflict=null,busy=false,syncing=false,dirty=false,syncRun=null,message='',phase=auth?.token?'checking':'guest',timer;
export function pushAccount(){return auth?.token?{token:auth.token,id:auth.user.id,url:API()}:null;}
function read(key){try{return JSON.parse(localStorage.getItem(key));}catch{return null;}}
function store(key,value){localStorage.setItem(key,JSON.stringify(value));}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const b64=buffer=>btoa(String.fromCharCode(...new Uint8Array(buffer))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const bytes=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
function prettyError(error){if(error.name==='NotAllowedError')return 'הכניסה בוטלה או שמפתח הגישה לא נמצא. אפשר לנסות שוב או לבחור מפתח ממכשיר אחר.';if(error.name==='InvalidStateError')return 'כבר קיים מפתח מתאים. נסה התחברות לחשבון קיים.';if(error.name==='AbortError')return 'השרת לא הגיב בזמן. הנתונים נשארו במכשיר; ננסה שוב כשיהיה חיבור.';if(error instanceof TypeError)return 'אין חיבור לשירות החשבון. הנתונים המקומיים לא נמחקו.';return error.message||'הפעולה לא הצליחה.';}
async function api(path,{method='GET',body,token=auth?.token}={}){const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);try{const r=await fetch(API()+path,{method,signal:controller.signal,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});let data;try{data=await r.json();}catch{throw new Error('השירות לא החזיר תשובה תקינה. ייתכן שהפריסה טרם הסתיימה.');}if(!r.ok){const error=new Error(({login_required:'נדרשת כניסה מחדש לחשבון. שינויים מקומיים שלא סונכרנו עדיין נשמרו במכשיר.',invite_required:'ליצירת חשבון יש להזין את קוד החיבור ENROLLMENT_KEY או להשתמש במכשיר שכבר מחובר לתזכורות.',social_not_configured:'כניסה עם ספקים חיצוניים עדיין לא הוגדרה על ידי מנהל האפליקציה.',social_authentication_failed:'לא ניתן לאמת את הכניסה החיצונית. נסה שוב.',identity_already_linked:'הכניסה הזו כבר מקושרת לחשבון אחר. לא שינינו את החשבון או את ההתקדמות.',authentication_failed:'לא ניתן לאמת את מפתח הגישה. נסה שוב.',challenge_expired:'בקשת הכניסה פגה. לחץ שוב על התחברות.',rate_limited:'בוצעו ניסיונות רבים. יש להמתין לפני ניסיון נוסף.',account_unavailable:'שירות החשבונות עדיין אינו זמין. בדוק שהפריסה החדשה ב־Cloudflare הסתיימה.',invalid_name:'יש להזין שם לתצוגה, עד 50 תווים.',invalid_data:'קובץ הנתונים אינו תקין. לא שינינו את ההתקדמות.',unauthorized:'שירות החשבונות טרם עודכן. יש להמתין לסיום הפריסה ב־Cloudflare.'})[data.error]||'לא ניתן להשלים את הפעולה כרגע.');error.status=r.status;error.data=data;throw error;}return data;}finally{clearTimeout(timeout);}}
function view(rebuild=false){const header=document.querySelector('#cloud-indicator');if(header){header.textContent=phase==='ready'?(dirty?'ממתין לסנכרון':'שמור בחשבון'):phase==='syncing'?'מסנכרן…':phase==='conflict'?'נדרשת בחירה':auth?.token?'ממתין לחיבור':'שמירה מקומית';header.title=message;}
 const status=document.querySelector('#account-status');if(status)status.textContent=message;
 if(rebuild)hooks?.changed();
 document.querySelectorAll('#account-register button,#account-login,[data-social]').forEach(button=>{button.disabled=busy;});
}
function setPhase(value,text,rebuild=false){phase=value;message=text;view(rebuild);}
function downloaded(snapshot,name='silent-warrior-backup'){const file={format:'silent-warrior-backup',exportedAt:new Date().toISOString(),snapshot};const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name+'-'+new Date().toISOString().slice(0,10)+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
function stats(snapshot){const s=snapshot.state;return `${Object.keys(s.days).length} ימי מעקב, ${Object.keys(s.weights).length} מדידות ו־${s.customHabits.length} הרגלים אישיים`;}
function saveBase(snapshot,revision){baseline={owner:auth.user.id,snapshot,revision};store(BASE,baseline);}
function apply(snapshot){hooks.apply(normalizeSnapshot(snapshot));}
function recover(snapshot){store('silent-warrior-recovery-'+(auth?.user?.id||'guest'),{snapshot,savedAt:Date.now()});}
function startPending(local,remote,revision,kind){pending={local,remote,revision,kind,deviceAtStart:hooks.capture()};conflict=null;setPhase('import','לפני שינוי הנתונים, בחר כיצד לשלב את המידע.',true);}
function socialPanel(connected){const names={google:'Google',facebook:'Facebook',apple:'Apple'};return `<section class="social-login"><h2>${connected?'קישור דרך נוספת לחשבון הזה':'כניסה או הרשמה'}</h2>${socialProviders?.length?`<div class="social-buttons">${socialProviders.map(provider=>`<button id="account-social-${provider}" data-social="${provider}" class="social-${provider}" ${busy?'disabled':''}>${connected?'קישור':'המשך עם'} <bdi>${names[provider]}</bdi></button>`).join('')}</div><p class="hint">${connected?'קישור מפורש שומר את ההרגלים וההתקדמות בחשבון הנוכחי. אי אפשר לקשר כניסה שכבר שייכת לחשבון אחר.':'בכניסה הראשונה נוצר חשבון אישי. יש לבחור שוב באותו ספק בפעמים הבאות.'}</p>`:`<p class="hint">${socialProviders===null?'בודק אפשרויות כניסה…':'כניסה עם Google, Facebook ו־Apple תהיה זמינה לאחר השלמת הגדרת השירותים.'}</p>`}<p class="hint">לא מקשרים חשבונות אוטומטית לפי כתובת אימייל. אם כבר יש לך חשבון, היכנס אליו קודם ואז קשר אליו דרך נוספת.</p></section>`;}
export function accountPanel(){const connected=!!auth?.token,local=hooks?hooks.capture():emptySnapshot();return `<section class="account-screen"><div class="eyebrow">ההתקדמות שלך, גם אחרי התקנה מחדש</div><h1>החשבון שלי</h1><p id="account-status" role="status">${escapeHtml(message||'ללא התחברות, הנתונים נשמרים רק בדפדפן הזה.')}</p>${socialPanel(connected)}${connected?`<div class="account-identity"><strong>${escapeHtml(auth.user.displayName)}</strong><small>חשבון אישי · הנתונים מופרדים מחשבונות אחרים</small></div>${pending?`<section class="migration-choice"><h2>${pending.kind==='file'?'ייבוא קובץ גיבוי':'נמצא מידע מקומי להעברה'}</h2><p>במכשיר / בקובץ: ${stats(pending.local)}</p><p>בחשבון: ${stats(pending.remote)}</p><p>נמזג נתונים שאינם מתנגשים. אם אותו נתון שונה בשני המקומות, תתבקש לבחור.</p><button id="account-import">מיזוג והעברה לחשבון</button><button id="account-use-cloud">שימוש בנתוני החשבון בלבד</button><button id="account-download-pending">הורדת עותק לפני ההעברה</button></section>`:''}${conflict?`<section class="sync-conflict"><h2>יש ${conflict.paths.length} שינויים מתנגשים</h2><p>שינויים בשדות שונים כבר מוזגו. בחר מה לשמור רק בשדות שבהם שני מכשירים שינו את אותו נתון.</p><button id="account-prefer-local">בשדות המתנגשים: השינויים מהמכשיר הזה</button><button id="account-prefer-cloud">בשדות המתנגשים: השינויים שבשרת</button><button id="account-download-conflict">הורדת עותק מקומי לפני בחירה</button></section>`:''}<div class="account-actions"><button id="account-sync" ${pending||conflict?'disabled':''}>סנכרון עכשיו</button><button id="account-login">כניסה מחדש / בחירת מפתח אחר</button><button id="account-logout">יציאה מהחשבון</button></div><p class="hint">אם יצרת מפתח גישה, הוא נשמר במנהל המפתחות שלך, למשל ״סיסמאות״ של Apple. לאחר התקנה מחדש מתחברים באותו מפתח. אם אינו זמין במחשב אחר, בוחרים כניסה באמצעות טלפון / קוד QR כשהדפדפן מציע זאת. אין כאן שחזור באימייל.</p><details class="account-history"><summary>גרסאות קודמות בשרת</summary><button id="account-history">טעינת גרסאות</button><div id="account-versions"></div></details>`:`<p>אפשר גם ליצור חשבון פרטי עם מפתח גישה (Passkey). באייפון מאשרים באמצעות Face ID או קוד המכשיר. יש לשמור את המפתח במנהל מפתחות שזמין לך גם אחרי התקנה מחדש.</p><form id="account-register"><label for="account-name">השם שלך לתצוגה</label><input id="account-name" name="displayName" required maxlength="50" autocomplete="nickname"><label for="account-invite">קוד חיבור, אם נדרש</label><input id="account-invite" name="enrollmentKey" type="password" autocomplete="off" placeholder="ENROLLMENT_KEY שכבר שמרת"><small>במכשיר שמחובר לתזכורות ננסה להשתמש בחיבור הקיים. הקוד אינו סיסמת החשבון ואינו נשמר כאן.</small><button type="submit">יצירת חשבון עם מפתח גישה</button></form><button id="account-login">יש לי חשבון — התחברות</button>`}<section class="account-backup"><h2>עותק נוסף בשליטתך</h2><p>גיבוי מכיל הרגלים, סימונים, משקל, סדר והעדפות תזכורות. הוא אינו מכיל מפתחות כניסה או קודי התראות. שמור אותו במקום פרטי.</p><button id="account-export">ייצוא לקובץ גיבוי</button><label for="account-file">ייבוא גיבוי לבדיקה לפני שמירה</label><input id="account-file" type="file" accept="application/json,.json"><small>${stats(local)} שמורים כעת במכשיר.</small></section><p class="hint">לאחר התחברות, נתוני המעקב נשמרים גם ב־Cloudflare. בלי חיבור לרשת השינויים נשמרים במכשיר וממתינים לסנכרון. מצב ״שמור בחשבון״ מופיע רק לאחר אישור מהשרת. התראות דורשות הרשאה נפרדת בכל מכשיר.</p></section>`;}
async function connect(result){
 // Keep the old identity active until the new account has been fetched. Never
 // expose or upload the previous user's local view under the new session.
 if(syncRun)await syncRun;
 setPhase(phase,'טוען את החשבון שבחרת…');
 const remote=await api('/account/data',{token:result.token});
 if(syncRun)await syncRun;
 const local=hooks.capture(),oldOwner=auth?.user?.id,oldBase=baseline;
 if(oldOwner&&oldOwner!==result.user.id&&(dirty||pending||conflict||!baseline||!same(local,baseline.snapshot))){await api('/account/logout',{method:'POST',body:{},token:result.token});throw new Error('יש שינויים בחשבון הנוכחי שטרם סונכרנו. יש להשלים סנכרון או לפתור את הבחירה לפני מעבר לחשבון אחר.');}
 if(meaningful(local))store(GUEST,{snapshot:local,owner:oldOwner||null,target:result.user.id,savedAt:Date.now()});
 auth=result;pending=null;conflict=null;store(SESSION,auth);baseline=oldOwner===auth.user.id?oldBase:null;
 const cloud=remote.snapshot?normalizeSnapshot(remote.snapshot):emptySnapshot();
 if(oldOwner===auth.user.id&&baseline?.owner===auth.user.id){setPhase('ready','מחובר. בודק שינויים שנשמרו במכשיר.');await synchronize();return;}
 if(!oldOwner&&meaningful(local)){startPending(local,cloud,remote.revision,'device');return;}
 saveBase(cloud,remote.revision);apply(cloud);dirty=false;setPhase('ready','הנתונים נטענו מהחשבון.',true);
}

async function authenticate(kind,form){if(busy)return;busy=true;try{if(!window.PublicKeyCredential||!navigator.credentials)throw new Error('מפתח גישה דורש דפדפן מעודכן וחיבור HTTPS.');setPhase(phase,'פותח בקשת זיהוי מאובטחת…');
 const registration=kind==='register',device=read('silent-warrior-push-v1');
 const start=await api(`/account/${kind}/options`,{method:'POST',body:registration?{displayName:form.elements.displayName.value,enrollmentKey:form.elements.enrollmentKey.value.trim(),deviceToken:device?.token}: {},token:null});
 const options=start.options;options.challenge=bytes(options.challenge);
 let credential;
 if(registration){options.user.id=bytes(options.user.id);options.excludeCredentials=(options.excludeCredentials||[]).map(c=>({...c,id:bytes(c.id)}));credential=await navigator.credentials.create({publicKey:options});}
 else{options.allowCredentials=(options.allowCredentials||[]).map(c=>({...c,id:bytes(c.id)}));credential=await navigator.credentials.get({publicKey:options});}
 if(!credential)throw new Error('הכניסה בוטלה.');const r=credential.response,response={clientDataJSON:b64(r.clientDataJSON)};
 if(registration){response.attestationObject=b64(r.attestationObject);if(r.getTransports)response.transports=r.getTransports();}else{response.authenticatorData=b64(r.authenticatorData);response.signature=b64(r.signature);response.userHandle=r.userHandle?b64(r.userHandle):null;}
 const result=await api(`/account/${kind}/verify`,{method:'POST',body:{challengeId:start.challengeId,credential:{id:credential.id,rawId:b64(credential.rawId),type:credential.type,response,clientExtensionResults:credential.getClientExtensionResults(),authenticatorAttachment:credential.authenticatorAttachment}},token:null});
 await connect(result);
 }catch(error){setPhase(auth?.token?'offline':'guest',prettyError(error),true);}finally{busy=false;view();}}
async function put(snapshot,revision,token=auth?.token){return api('/account/data',{method:'PUT',body:{snapshot,revision},token});}
async function synchronize(){if(syncRun)return syncRun;const run=runSync();syncRun=run;try{return await run;}finally{if(syncRun===run)syncRun=null;}}
async function runSync(){if(!auth?.token||pending||conflict||syncing||!baseline){view();return;}syncing=true;const connectionToken=auth.token,active=()=>auth?.token===connectionToken;
 try{setPhase('syncing','מסנכרן את ההתקדמות…');for(let attempt=0;attempt<4;attempt++){
  const current=hooks.capture(),remote=await api('/account/data',{token:connectionToken});if(!active())return;const cloud=remote.snapshot?normalizeSnapshot(remote.snapshot):emptySnapshot(),merged=mergeSnapshots(baseline.snapshot,current,cloud);
  if(merged.conflicts.length){conflict={deviceAtStart:hooks.capture(),base:baseline.snapshot,local:current,remote:cloud,revision:remote.revision,paths:merged.conflicts};recover(current);setPhase('conflict','יש שינויים שדורשים בחירה שלך. הנתונים המקומיים נשמרו.',true);return;}
  let snapshot=merged.snapshot,revision=remote.revision;
  if(!same(snapshot,cloud)){
   try{const saved=await put(snapshot,revision,connectionToken);if(!active())return;revision=saved.revision;}catch(error){if(error.status===409)continue;throw error;}
  }
  // Preserve edits made while the network request was in flight.
  const latest=hooks.capture(),next=mergeSnapshots(current,latest,snapshot);
  saveBase(snapshot,revision);
  if(next.conflicts.length){conflict={deviceAtStart:hooks.capture(),base:current,local:latest,remote:snapshot,revision,paths:next.conflicts};recover(latest);setPhase('conflict','נדרש לבחור בין שינויים מקבילים.',true);return;}
  if(!same(latest,next.snapshot))apply(next.snapshot);dirty=!same(next.snapshot,snapshot);
  if(dirty)continue;
  setPhase('ready','הנתונים שמורים בחשבון ומסונכרנים.');view();return;
 }setPhase('offline','יש שינויים נוספים שממתינים לסנכרון. נסה שוב בעוד רגע.');
 }catch(error){if(active())setPhase(error.status===401?'expired':'offline',prettyError(error));}finally{syncing=false;view();}}
function changed(){if(!auth?.token||pending||conflict)return;dirty=true;view();clearTimeout(timer);timer=setTimeout(synchronize,700);}
async function chooseImport(useLocal){if(!pending)return;const local=hooks.capture(),p=pending;recover(p.kind==='file'?p.local:local);
 const source=p.kind==='file'?mergeSnapshots(p.deviceAtStart,local,p.local,'local').snapshot:local;
 if(useLocal){const merged=mergeSnapshots(emptySnapshot(),source,p.remote);if(merged.conflicts.length){conflict={deviceAtStart:hooks.capture(),base:emptySnapshot(),local:source,remote:p.remote,revision:p.revision,paths:merged.conflicts};pending=null;setPhase('conflict','יש נתונים שונים במכשיר ובחשבון. בחר מה לשמור בשדות המתנגשים.',true);return;}saveBase(p.remote,p.revision);pending=null;apply(merged.snapshot);}
 else{saveBase(p.remote,p.revision);pending=null;apply(p.remote);}
 setPhase('ready','מסנכרן את הבחירה…',true);dirty=true;await synchronize();}
async function chooseConflict(prefer){if(!conflict)return;const c=conflict,latest=mergeSnapshots(c.deviceAtStart,hooks.capture(),c.local,'local').snapshot,snapshot=mergeSnapshots(c.base,latest,c.remote,prefer).snapshot;recover(c.local);saveBase(c.remote,c.revision);conflict=null;apply(snapshot);dirty=true;setPhase('ready','שומר את הבחירה…',true);await synchronize();}
export function initAccount(options){hooks=options;
 document.addEventListener('local-data-changed',changed);document.addEventListener('habit-order-changed',e=>{if(e.detail.saved)changed();});document.addEventListener('reminders-changed',changed);
 document.addEventListener('submit',e=>{if(e.target.id!=='account-register')return;e.preventDefault();if(e.target.reportValidity())authenticate('register',e.target);});
 document.addEventListener('click',async e=>{const button=e.target.closest('button');if(!button||!button.id.startsWith('account-'))return;try{
 if(button.dataset.social){if(busy)return;if(auth?.token){await synchronize();if(dirty||pending||conflict||phase!=='ready')throw new Error('לפני קישור כניסה נוספת יש להשלים סנכרון ולפתור בחירות ממתינות.');}busy=true;view();try{await beginSocial(api,button.dataset.social,auth?.user?.id);}catch(error){busy=false;view();throw error;}return;}
 switch(button.id){
 case 'account-login':await authenticate('login');break;
 case 'account-sync':await synchronize();break;
 case 'account-export':downloaded(hooks.capture());setPhase(phase,'קובץ הגיבוי הורד. יש לשמור אותו במקום פרטי.');break;
 case 'account-download-pending':if(pending)downloaded(pending.local);break;
 case 'account-download-conflict':if(conflict)downloaded(conflict.local);break;
 case 'account-import':await chooseImport(true);break;
 case 'account-use-cloud':await chooseImport(false);break;
 case 'account-prefer-local':await chooseConflict('local');break;
 case 'account-prefer-cloud':await chooseConflict('remote');break;
 case 'account-logout':{
  if(pending||conflict||dirty||phase!=='ready'){setPhase(phase,'לפני יציאה יש להשלים סנכרון או לפתור את הבחירה, כדי שלא לאבד שינויים.',true);break;}
  await api('/account/logout',{method:'POST',body:{}});auth=null;baseline=null;localStorage.removeItem(SESSION);localStorage.removeItem(BASE);apply(emptySnapshot());dirty=false;setPhase('guest','יצאת מהחשבון. הנתונים נשמרים בשרת; התצוגה המקומית כעת ריקה.',true);break;}
 case 'account-history':{const {versions}=await api('/account/history');const node=document.querySelector('#account-versions');node.replaceChildren();for(const v of versions){const b=document.createElement('button');b.textContent='הורדת גרסה '+v.revision+' · '+new Date(v.created_at).toLocaleString('he-IL');b.addEventListener('click',async()=>{try{const result=await api('/account/history/'+v.revision);downloaded(result.snapshot,'silent-warrior-version-'+v.revision);}catch(error){setPhase(phase,prettyError(error));}});node.append(b);}if(!versions.length)node.textContent='גרסאות קודמות יופיעו אחרי שמירות נוספות.';break;}
 }}catch(error){setPhase(phase,prettyError(error));}});
 document.addEventListener('change',async e=>{if(e.target.id!=='account-file')return;const file=e.target.files?.[0];if(!file)return;try{if(file.size>1000000)throw new Error('קובץ הגיבוי גדול מדי.');const data=JSON.parse(await file.text());if(data.format!=='silent-warrior-backup')throw new Error('זה אינו קובץ גיבוי של הלוחם השקט.');const imported=normalizeSnapshot(data.snapshot);if(!auth?.token)throw new Error('יש להתחבר לחשבון לפני ייבוא. הקובץ לא שינה את הנתונים.');const remote=await api('/account/data');startPending(imported,remote.snapshot?normalizeSnapshot(remote.snapshot):emptySnapshot(),remote.revision,'file');}catch(error){setPhase(phase,prettyError(error));}});
 window.addEventListener('online',synchronize);document.addEventListener('visibilitychange',()=>{if(!document.hidden)synchronize();});setInterval(()=>{if(!document.hidden&&navigator.onLine)synchronize();},20000);
 async function restoreSession(){if(auth?.token){if(baseline?.owner!==auth.user?.id)baseline=null;api('/account/me').then(async()=>{if(!baseline){const guest=read(GUEST);const remote=await api('/account/data');if(guest?.owner===null&&guest.target===auth.user.id&&meaningful(guest.snapshot)){startPending(guest.snapshot,remote.snapshot||emptySnapshot(),remote.revision,'device');}else{const cloud=remote.snapshot?normalizeSnapshot(remote.snapshot):emptySnapshot();saveBase(cloud,remote.revision);apply(cloud);setPhase('ready','הנתונים נטענו מהחשבון.',true);}}else await synchronize();}).catch(error=>setPhase(error.status===401?'expired':'offline',prettyError(error),true));}}
 async function start(){try{const result=await finishSocial(api,auth?.user?.id);if(result){await connect(result);return;}}catch(error){setPhase(auth?.token?'offline':'guest',prettyError(error),true);return;}await restoreSession();}
 start();
 api('/account/social/config',{token:null}).then(result=>{socialProviders=result.providers;view(true);}).catch(()=>{socialProviders=[];view(true);});
 view();
}
