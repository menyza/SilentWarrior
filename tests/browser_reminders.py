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
 calls=[]
 def route(r):
  req=r.request;calls.append((req.method,req.url,req.post_data))
  data={'publicKey':'B'*87} if req.url.endswith('/public-key') else {'token':'a'*64} if req.method=='POST' and req.url.endswith('/subscription') else {'status':'sent'} if req.url.endswith('/test') else {'saved':True}
  r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'},body=json.dumps(data))
 page.route('https://test-reminders.workers.dev/**',route)
 page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('[data-page="habits"]').click()
 assert page.locator('#push-test').is_disabled()
 page.locator('#push-url').fill('test-reminders.workers.dev');page.locator('#push-form [type=submit]').click();assert 'נדרש קוד החיבור' in page.locator('#push-status').inner_text();assert page.locator('#push-form [type=submit]').is_enabled();page.locator('#push-code').fill('local-test-code');page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");assert page.locator('#push-code').input_value()=='local-test-code';assert page.locator('#push-url').input_value()=='test-reminders.workers.dev'
 page.locator('#push-form [type=submit]').click()
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('ההרשמה נשמרה')")
 assert page.locator('#push-code').input_value()==''
 assert 'local-test-code' not in page.evaluate('localStorage.getItem("silent-warrior-push-v1")')
 body=json.loads(next(body for method,url,body in calls if method=='POST' and url.endswith('/subscription')))
 assert set(body)=={'subscription','settings'}
 page.locator('#push-test').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('קיבל את ההודעה')")
 page.locator('[name=morning]').fill('09:15');page.locator('#push-form [type=submit]').click()
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('עודכנו')")
 assert any(method=='PUT' for method,_,_ in calls)
 page.reload();page.locator('[data-page="habits"]').click()
 assert page.locator('[name=morning]').input_value()=='09:15'
 page.locator('#push-disable').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('כובו')")
 assert page.locator('#push-test').is_disabled();assert page.evaluate('window.__unsubscribed')
 page.locator('#push-url').fill('https://example.com');page.locator('#push-form [type=submit]').click()
 assert 'Cloudflare Workers' in page.locator('#push-status').inner_text()
 page.locator('#push-url').fill('test-reminders.workers.dev');page.locator('#push-code').fill('local-test-code')
 page.evaluate("""window.fetch=(_url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));const realTimer=window.setTimeout;window.setTimeout=(callback,delay,...args)=>realTimer(callback,delay===12000?50:delay,...args);""")
 page.locator('#push-form [type=submit]').click()
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('12 שניות')")
 assert page.locator('#push-form [type=submit]').is_enabled()
 b.close()
server.shutdown();print('PASS: bare hostname submits, missing code has visible feedback, button recovers, enrollment, update, reload, test and disable remain functional')
