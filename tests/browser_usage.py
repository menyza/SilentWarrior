from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import threading,json
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page();page.clock.install();received={};errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script("localStorage.setItem('levelup-onboarding-v1','legacy')")  # Existing-user regression fixture.
 page.add_init_script("localStorage.setItem('silent-warrior-account-v1',JSON.stringify({token:'a'.repeat(64),user:{id:'A',displayName:'Alice'}}));window.__hidden=false;Object.defineProperty(document,'hidden',{configurable:true,get:()=>window.__hidden})")
 def route(r):
  path=r.request.url
  if path.endswith('/account/usage'):
   for session in r.request.post_data_json['sessions']:
    old=received.get(session['id']);received[session['id']]=session if not old or session['activeMs']>=old['activeMs'] else old
   data={'saved':True}
  elif path.endswith('/account/me'):data={'user':{'id':'A','displayName':'Alice'}}
  elif path.endswith('/account/social/config'):data={'providers':[]}
  else:data={'revision':0,'snapshot':None}
  r.fulfill(status=200,content_type='application/json',body=json.dumps(data))
 page.route('https://silentwarrior.menyzakar142.workers.dev/**',route)
 page.goto(f'http://127.0.0.1:{server.server_port}')
 page.wait_for_function("document.querySelector('#cloud-indicator').textContent==='שמור בחשבון'")
 page.clock.run_for(30000);page.evaluate("window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))")
 page.wait_for_timeout(100);before=sum(s['activeMs'] for s in received.values())
 assert len(received)==1 and 28000<=before<=33000,received
 page.clock.run_for(600000);assert sum(s['activeMs'] for s in received.values())==before
 page.evaluate("window.__hidden=false;document.dispatchEvent(new Event('visibilitychange'))");page.clock.run_for(30000)
 page.evaluate("window.__hidden=true;document.dispatchEvent(new Event('visibilitychange'))");page.wait_for_timeout(100)
 assert len(received)==2 and 58000<=sum(s['activeMs'] for s in received.values())<=65000,received
 assert not errors,errors
 browser.close()
server.shutdown();print('PASS: authenticated usage counts foreground entries and excludes background time')
