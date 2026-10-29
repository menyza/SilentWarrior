from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading,json
from pathlib import Path
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':664})
 page.add_init_script('''Object.defineProperty(window.Notification,'requestPermission',{value:async()=> 'granted'});window.__unsubscribed=false;const sub={toJSON:()=>({endpoint:'https://web.push.apple.com/test-ui',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}}),unsubscribe:async()=>{window.__unsubscribed=true;return true}};const registration={pushManager:{getSubscription:async()=>sub,subscribe:async()=>sub}};Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve(registration),register:async()=>registration,getRegistration:async()=>registration}});''')

 page.add_init_script("localStorage.setItem('silent-warrior-account-v1',JSON.stringify({token:'a'.repeat(64),user:{id:'A',displayName:'Alice'}}))")
 calls=[]
 def route(r):
  req=r.request;calls.append((req.method,req.url,req.post_data,req.headers))
  if '/account/' in req.url:
   data={'providers':[]} if req.url.endswith('/social/config') else {'user':{'id':'A','displayName':'Alice'}} if req.url.endswith('/me') else {'revision':0,'snapshot':None}
  else:
   data={'publicKey':'B'*87} if req.url.endswith('/public-key') else {'id':'device-a'} if req.method=='POST' and req.url.endswith('/push/subscription') else {'status':'sent'} if req.url.endswith('/test') else {'saved':True}
  r.fulfill(status=201 if req.method=='POST' and req.url.endswith('/push/subscription') else 200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'},body=json.dumps(data))
 page.route('https://silentwarrior.menyzakar142.workers.dev/**',route)
 page.goto(f'http://127.0.0.1:{server.server_port}')
 page.wait_for_function("document.querySelector('#cloud-indicator').textContent==='שמור בחשבון'")
 page.locator('[data-page="settings"]').click();page.locator('[data-page="notifications"]').click()
 assert page.locator('#push-code').count()==0
 page.locator('[name=morning]').fill('09:15')
 page.locator('#push-form [type=submit]').click()
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('ההרשמה נשמרה')")
 enrollment=next(c for c in calls if c[0]=='POST' and c[1].endswith('/push/subscription'))
 assert enrollment[3]['authorization']=='Bearer '+'a'*64
 assert 'x-enrollment-key' not in enrollment[3]
 assert json.loads(enrollment[2])['settings']['reminders'][0]['time']=='09:15'
 saved=json.loads(page.evaluate('localStorage.getItem("silent-warrior-push-v1")'))
 assert saved['owner']=='A' and saved['id']=='device-a' and 'token' not in saved
 page.locator('[name=morning]').fill('10:30');page.locator('#push-form [type=submit]').click()
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('עודכנו')")
 assert any(c[0]=='PUT' and c[1].endswith('/push/subscription/device-a') for c in calls)
 pending=[]
 page.route('**/push/subscription/device-a/test',lambda r:pending.append(r))
 page.locator('#push-test').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('שולח התראת בדיקה')")
 assert page.locator('#push-test').is_disabled()
 page.locator('[data-page="appearance"]').click();page.locator('[data-page="notifications"]').click()
 assert 'שולח התראת בדיקה' in page.locator('#push-status').inner_text()
 assert page.locator('#push-test').is_disabled()
 assert len(pending)==1
 pending[0].fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*'},body='{"status":"sent"}')
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('קיבל את ההודעה')")
 page.unroute('**/push/subscription/device-a/test')
 # A different signed-in account cannot expose or operate the stored registration.
 page.add_init_script("localStorage.setItem('silent-warrior-account-v1',JSON.stringify({token:'b'.repeat(64),user:{id:'B',displayName:'Bob'}}))")
 page.reload();page.wait_for_function("document.querySelector('#cloud-indicator').textContent==='שמור בחשבון'");page.locator('[data-page="settings"]').click();page.locator('[data-page="notifications"]').click()
 assert page.locator('#push-test').is_enabled() and page.locator('#push-disable').is_disabled()
 assert 'לחשבון אחר' in page.locator('#push-status').inner_text()
 before=len(calls);page.locator('#push-form [type=submit]').click();assert len(calls)==before
 # Return to the owner; disable removes only this device.
 page.add_init_script("localStorage.setItem('silent-warrior-account-v1',JSON.stringify({token:'a'.repeat(64),user:{id:'A',displayName:'Alice'}}))")
 page.reload();page.wait_for_function("document.querySelector('#cloud-indicator').textContent==='שמור בחשבון'");page.locator('[data-page="settings"]').click();page.locator('[data-page="notifications"]').click()
 page.locator('#push-disable').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('כובו')")
 assert page.evaluate('window.__unsubscribed')
 assert any(c[0]=='DELETE' and c[1].endswith('/push/subscription/device-a') for c in calls)
 assert page.locator('#push-test').is_enabled()
 b.close()
server.shutdown();print('PASS: account registration without code, personal schedule, test, owner switch isolation and device disable')
