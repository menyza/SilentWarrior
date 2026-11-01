from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading,json
from pathlib import Path
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':664})
 errors=[];page.on('pageerror',lambda error:errors.append(str(error)))
 page.add_init_script("Element.prototype.scrollIntoView=function(){throw new TypeError('Unsupported scroll options')};")
 page.add_init_script('''Object.defineProperty(window.Notification,'requestPermission',{value:async()=> 'granted'});window.__unsubscribed=false;const sub={toJSON:()=>({endpoint:'https://web.push.apple.com/test-ui',keys:{p256dh:'B'.repeat(87),auth:'A'.repeat(22)}}),unsubscribe:async()=>{window.__unsubscribed=true;return true}};const registration={pushManager:{getSubscription:async()=>sub,subscribe:async()=>sub}};Object.defineProperty(navigator,'serviceWorker',{value:{ready:Promise.resolve(registration),register:async()=>registration,getRegistration:async()=>registration}});''')
 calls=[]
 def route(r):
  req=r.request;calls.append((req.method,req.url,req.post_data))
  data={'publicKey':'B'*87} if req.url.endswith('/public-key') else {'token':'a'*64} if req.method=='POST' and req.url.endswith('/subscription') else {'status':'sent'} if req.url.endswith('/test') else {'saved':True}
  r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'},body=json.dumps(data))
 page.route('https://test-reminders.workers.dev/**',route)
 page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('[data-page="settings"]').click();page.locator('[data-page="notifications"]').click()
 assert page.locator('#push-test').is_enabled()
 page.locator('#push-test').click();assert 'יש להפעיל התראות' in page.locator('#push-status').inner_text()
 page.locator('#push-url').fill('test-reminders.workers.dev');page.locator('#push-form [type=submit]').click();assert 'נדרש קוד החיבור' in page.locator('#push-status').inner_text();assert page.locator('#push-form [type=submit]').is_enabled();page.locator('#push-code').fill('local-test-code');page.evaluate("document.dispatchEvent(new Event('visibilitychange'))");assert page.locator('#push-code').input_value()=='local-test-code';assert page.locator('#push-url').input_value()=='test-reminders.workers.dev'
 for topic in ['טניס','מים','שקילה']:
  page.locator('#add-reminder').click();row=page.locator('[data-reminder]').last
  row.locator('[data-topic]').fill(topic);row.locator('[type=time]').fill('14:30')
 assert page.locator('[data-reminder]').count()==5
 page.locator('[data-reminder]').last.locator('[data-remove-reminder]').click()
 assert page.locator('[data-reminder]').count()==4
 for day in [0,2,4,5,6]:page.locator('[data-reminder]').nth(2).locator(f'[data-weekday][value="{day}"]').uncheck()
 page.locator('#push-form [type=submit]').click()
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('ההרשמה נשמרה')")
 assert page.locator('#push-code').input_value()==''
 assert 'local-test-code' not in page.evaluate('localStorage.getItem("silent-warrior-push-v1")')
 body=json.loads(next(body for method,url,body in calls if method=='POST' and url.endswith('/subscription')))
 assert set(body)=={'subscription','settings'}
 assert len(body['settings']['reminders'])==4
 assert body['settings']['reminders'][2]['topic']=='טניס'
 assert body['settings']['reminders'][2]['days']==[1,3]
 assert body['settings']['reminders'][3]['time']=='14:30'
 page.locator('#push-test').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('קיבל את ההודעה')")
 page.locator('[data-reminder] input[type=time]').first.fill('09:15');page.locator('#push-form [type=submit]').click()
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('נשמרו בשירות')")
 assert any(method=='PUT' for method,_,_ in calls)
 page.reload();page.locator('[data-page="settings"]').click();page.locator('[data-page="notifications"]').click()
 assert page.locator('[data-reminder] input[type=time]').first.input_value()=='09:15'
 assert page.locator('[data-reminder]').nth(2).locator('[data-weekday]:checked').count()==2
 page.locator('#push-disable').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('כובו')")
 assert page.locator('#push-test').is_enabled();assert page.evaluate('window.__unsubscribed')
 page.locator('#push-url').fill('https://example.com');page.locator('#push-form [type=submit]').click()
 assert 'Cloudflare Workers' in page.locator('#push-status').inner_text()
 page.locator('#push-url').fill('test-reminders.workers.dev');page.locator('#push-code').fill('local-test-code')
 page.evaluate("""window.fetch=(_url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));const realTimer=window.setTimeout;window.setTimeout=(callback,delay,...args)=>realTimer(callback,delay===12000?50:delay,...args);""")
 page.locator('#push-form [type=submit]').click()
 page.wait_for_function("document.querySelector('#push-status').textContent.includes('12 שניות')")
 assert page.locator('#push-form [type=submit]').is_enabled()
 # Selecting a workout requires an explicit type; cancellation leaves the day unchanged.
 page.locator('[data-page="today"]').click();page.locator('[data-group="במהלך היום"]').click()
 workout=page.locator('[data-check="1-2"]');workout.click()
 assert page.locator('#workout-picker').is_visible()
 assert page.locator('[data-workout]').count()==5
 page.locator('#cancel-workout').click();assert workout.get_attribute('aria-pressed')=='false'
 for kind in ['טניס','פוצ׳יבולי','פדל','חדר כושר','אופנוע']:
  page.locator('[data-check="1-2"]').click();page.get_by_role('button',name=kind,exact=True).click()
  assert kind in page.locator('[data-check="1-2"]').inner_text(), (kind,page.locator('[data-check="1-2"]').inner_text(),page.evaluate('localStorage.getItem("silent-warrior-v1")'))
  state=json.loads(page.evaluate('localStorage.getItem("silent-warrior-v1")'))
  assert kind in state['workouts'].values()
  page.reload();page.locator('[data-group="במהלך היום"]').click()
  assert kind in page.locator('[data-check="1-2"]').inner_text()
  page.locator('[data-check="1-2"]').click()
  assert page.locator('[data-check="1-2"]').get_attribute('aria-pressed')=='false'
 assert not errors,errors
 b.close()
server.shutdown();print('PASS: bare hostname submits, missing code has visible feedback, button recovers, enrollment, update, reload, test and disable remain functional')
