"""Existing legacy devices continue working without exposing service configuration."""
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading,json
from pathlib import Path
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':664})
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("""Element.prototype.scrollIntoView=function(){throw new TypeError('Unsupported scroll options')};if(!localStorage.getItem('silent-warrior-push-v1'))localStorage.setItem('silent-warrior-push-v1',JSON.stringify({url:'https://silentwarrior.menyzakar142.workers.dev',token:'a'.repeat(64),settings:{timeZone:'Asia/Jerusalem',reminders:[{kind:'morning',time:'08:00'},{kind:'evening',time:'21:00'}]}}));window.__unsubscribed=false;const sub={unsubscribe:async()=>{window.__unsubscribed=true;return true}};const registration={pushManager:{getSubscription:async()=>sub}};Object.defineProperty(navigator,'serviceWorker',{value:{register:async()=>registration,getRegistration:async()=>registration}});""")
 calls=[]
 def route(r):
  req=r.request;calls.append((req.method,req.url,req.post_data,req.headers))
  data={'providers':[]} if req.url.endswith('/account/social/config') else {'status':'sent'} if req.url.endswith('/test') else {'saved':True}
  r.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS'},body=json.dumps(data))
 page.route('https://silentwarrior.menyzakar142.workers.dev/**',route)
 page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('[data-page="settings"]').click();page.locator('[data-page="notifications"]').click()
 assert page.locator('#push-url,#push-code,input[name=url],input[name=code]').count()==0
 assert page.locator('#push-zone').evaluate('(e)=>e.tagName')=='SELECT'
 assert page.locator('#push-zone option:checked').inner_text()=='ישראל — ירושלים'
 for topic in ['טניס','מים','שקילה']:
  page.locator('#add-reminder').click();row=page.locator('[data-reminder]').last
  row.locator('[data-topic]').fill(topic);row.locator('[type=time]').fill('14:30')
 page.locator('[data-reminder]').last.locator('[data-remove-reminder]').click();assert page.locator('[data-reminder]').count()==4
 for day in [0,2,4,5,6]:page.locator('[data-reminder]').nth(2).locator(f'[data-weekday][value="{day}"]').uncheck()
 page.locator('#push-zone').select_option('America/New_York')
 page.locator('#push-form [type=submit]').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('נשמרו בשירות')")
 update=next(call for call in calls if call[0]=='PUT');settings=json.loads(update[2])
 assert settings['timeZone']=='America/New_York' and len(settings['reminders'])==4
 assert settings['reminders'][2]['topic']=='טניס' and settings['reminders'][2]['days']==[1,3]
 assert update[3]['authorization']=='Bearer '+'a'*64
 assert not any(call[0]=='POST' and call[1].endswith('/subscription') for call in calls)
 page.reload();page.locator('[data-page="settings"]').click();page.locator('[data-page="notifications"]').click()
 assert page.locator('#push-zone').input_value()=='America/New_York'
 page.locator('#main').evaluate('(e)=>e.scrollTo(0,0)');page.screenshot(path='/tmp/notification-settings-clean.png')
 page.locator('#push-test').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('קיבל את ההודעה')")
 page.evaluate("window.__realFetch=window.fetch;window.fetch=(_url,opts)=>new Promise((resolve,reject)=>opts.signal.addEventListener('abort',()=>reject(new DOMException('Aborted','AbortError'))));const realTimer=window.setTimeout;window.setTimeout=(callback,delay,...args)=>realTimer(callback,delay===12000?50:delay,...args)")
 page.locator('#push-form [type=submit]').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('12 שניות')");assert page.locator('#push-form [type=submit]').is_enabled()
 page.evaluate('window.fetch=window.__realFetch')
 page.locator('#push-disable').click();page.wait_for_function("document.querySelector('#push-status').textContent.includes('כובו')")
 assert page.evaluate('window.__unsubscribed') and page.locator('#push-form [type=submit]').is_disabled()
 assert page.get_by_role('button',name='כניסה לחשבון',exact=True).count()==0
 # The next render offers account sign-in rather than technical setup fields.
 page.locator('[data-page="appearance"]').click();page.locator('[data-page="notifications"]').click()
 assert page.get_by_role('button',name='כניסה לחשבון',exact=True).is_visible()
 assert page.locator('#push-url,#push-code').count()==0
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
server.shutdown();print('PASS: hidden service configuration, Hebrew timezone picker, legacy device updates without reenrollment, weekday persistence, test/timeout feedback, disable and account sign-in')
