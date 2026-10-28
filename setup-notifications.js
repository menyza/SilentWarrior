const names=['VAPID_PUBLIC_KEY','VAPID_PRIVATE_KEY','ENROLLMENT_KEY'];
const base64url=bytes=>btoa(String.fromCharCode(...bytes)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const decode=value=>Uint8Array.from(atob(value.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
let generated=false;
document.querySelector('#generate').addEventListener('click',async()=>{
 const button=document.querySelector('#generate');if(generated)return;button.disabled=true;
 try{
  const pair=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const jwk=await crypto.subtle.exportKey('jwk',pair.privateKey);
  const values=[base64url(new Uint8Array([4,...decode(jwk.x),...decode(jwk.y)])),jwk.d,[...crypto.getRandomValues(new Uint8Array(24))].map(x=>x.toString(16).padStart(2,'0')).join('')];
  const container=document.querySelector('#keys');
  names.forEach((name,i)=>{const section=document.createElement('section'),label=document.createElement('label'),input=document.createElement('input'),copy=document.createElement('button');label.textContent=name;label.htmlFor=name;input.id=name;input.value=values[i];input.type=i===0?'text':'password';input.readOnly=true;input.dir='ltr';input.autocomplete='off';copy.textContent='העתקת הערך';copy.setAttribute('aria-label',`העתקת ${name}`);copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(input.value);document.querySelector('#status').textContent=`${name} הועתק. הדבק בשדה Secret ב־Cloudflare.`;}catch{input.type='text';input.select();document.querySelector('#status').textContent='העתקה אוטומטית אינה זמינה; הערך נבחר להעתקה ידנית.';}});section.append(label,input,copy);container.append(section);});
  container.hidden=false;generated=true;button.textContent='המפתחות נוצרו בדפדפן';document.querySelector('#status').textContent='המפתחות מוכנים להעתקה. לא נשלח מידע לרשת.';
 }catch{button.disabled=false;document.querySelector('#status').textContent='לא ניתן ליצור מפתחות. פתח בכתובת HTTPS ובדפדפן מעודכן.';}
});
