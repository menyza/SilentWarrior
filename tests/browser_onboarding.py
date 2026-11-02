from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import threading,json,hashlib,base64
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])))
threading.Thread(target=server.serve_forever,daemon=True).start()
origin=f'http://127.0.0.1:{server.server_port}'
saved=None;revision=0;pkce=None
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  context=browser.new_context(viewport={'width':390,'height':844},service_workers='block')
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def api(r):
   global saved,revision,pkce
   req=r.request;path=req.url.split('.dev')[-1];data={}
   if path=='/account/social/config':data={'providers':['google']}
   elif path=='/account/social/start':
    body=req.post_data_json;assert body['provider']=='google' and not body['link'];pkce=body['pkce'];data={'state':'mock-state','url':'https://identity.example/authorize'}
   elif path=='/account/social/verify':
    body=req.post_data_json;assert body['state']=='mock-state';assert base64.urlsafe_b64encode(hashlib.sha256(body['verifier'].encode()).digest()).decode().rstrip('=')==pkce
    data={'token':'a'*64,'user':{'id':'A','displayName':'New User'}}
   elif path=='/account/me' and req.headers.get('authorization')=='Bearer '+'z'*64:
    r.fulfill(status=401,content_type='application/json',body='{"error":"login_required"}');return
   elif path=='/account/me':data={'user':{'id':'A','displayName':'New User'}}
   elif path=='/account/data':
    if req.method=='PUT':
     assert req.headers['authorization']=='Bearer '+'a'*64
     body=req.post_data_json;assert body['revision']==revision;saved=body['snapshot'];revision+=1;data={'revision':revision}
    else:data={'revision':revision,'snapshot':saved}
   r.fulfill(status=200,content_type='application/json',body=json.dumps(data))
  context.route('https://silentwarrior.menyzakar142.workers.dev/**',api)
  context.route('https://identity.example/**',lambda r:r.fulfill(status=302,headers={'Location':origin+'/?state=mock-state&code=mock-code'},body=''))
  page.goto(origin);page.locator('#account-social-google').wait_for(state='visible')
  assert page.locator('.welcome-screen').is_visible();assert not page.locator('nav').is_visible()
  page.evaluate('document.fonts.ready');page.screenshot(path='/workspace/scratch/levelup-welcome.png')
  page.locator('#account-social-google').click();page.locator('#profile-form').wait_for(state='visible')
  assert page.locator('#profile-form').get_attribute('data-onboarding')=='true'
  # Refresh mid-onboarding must keep the profile step, even after the empty cloud state was cached.
  page.reload();page.locator('#profile-form').wait_for(state='visible')
  page.locator('#profile-sex').select_option('male');page.locator('#profile-weight').fill('70');page.locator('#profile-height').fill('175')
  assert page.locator('#profile-bmi').inner_text()=='22.9';assert page.locator('#profile-water-goal').input_value()=='2100'
  page.locator('#profile-water-goal').fill('2200');page.locator('#profile-height').fill('180')
  assert page.locator('#profile-water-goal').input_value()=='2200'
  page.evaluate("document.dispatchEvent(new Event('account-view-changed'))")
  assert page.locator('#profile-water-goal').input_value()=='2200'
  page.screenshot(path='/workspace/scratch/levelup-profile.png')
  page.locator('#profile-form [type=submit]').click();page.locator('.today-title').wait_for(state='visible')
  page.wait_for_function("document.querySelector('#cloud-indicator').textContent==='שמור בחשבון'")
  assert saved['state']['profile']['weightKg']==70 and saved['state']['profile']['heightCm']==180
  assert saved['state']['waterGoal']==2200 and 70 in saved['state']['weights'].values()
  page.reload();page.locator('.today-title').wait_for(state='visible');assert not page.locator('.welcome-screen').count()
  page.locator('[data-page="settings"]').click();page.locator('[data-page="profile"]').click();assert page.locator('#profile-weight').input_value()=='70'
  assert not errors,errors
  context.close()
  unavailable=browser.new_context(service_workers='block');unavailable.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
  page=unavailable.new_page();page.goto(origin);page.wait_for_function("document.querySelector('#account-status')?.textContent.includes('אינה זמינה')")
  assert page.locator('#account-social-google').is_disabled()
  page.locator('#onboarding-account').click();assert page.locator('#account-login').is_visible()
  expired=browser.new_context(service_workers='block');expired.route('https://silentwarrior.menyzakar142.workers.dev/**',api);expired.route('https://identity.example/**',lambda r:r.fulfill(status=302,headers={'Location':origin+'/?state=mock-state&code=mock-code'},body=''))
  reauth=expired.new_page();reauth.add_init_script("if(!localStorage.getItem('silent-warrior-account-v1'))localStorage.setItem('silent-warrior-account-v1',JSON.stringify({token:'z'.repeat(64),user:{id:'A'}}));localStorage.setItem('levelup-onboarding-v1','pending')")
  reauth.goto(origin);reauth.wait_for_function("document.querySelector('#account-status')?.textContent.includes('כניסה מחדש')")
  reauth.locator('#account-social-google').click();reauth.locator('.today-title').wait_for(state='visible');expired.close()
  legacy=browser.new_context(service_workers='block');legacy.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":["google"]}'))
  old=legacy.new_page();old.add_init_script("localStorage.setItem('silent-warrior-v1',JSON.stringify({waterGoal:2400,days:{'2026-11-01':{'0-0':'done'}}}))")
  old.goto(origin);old.locator('.today-title').wait_for(state='visible');assert old.locator('.welcome-screen').count()==0
  assert old.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).waterGoal")==2400
  old.locator('[data-page="settings"]').click();old.locator('[data-page="profile"]').click()
  old.locator('#profile-sex').select_option('prefer_not');old.locator('#profile-weight').fill('80');old.locator('#profile-height').fill('180');old.locator('#profile-water-goal').fill('2600');old.locator('#profile-form [type=submit]').click()
  assert old.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).waterGoal")==2600
  assert old.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).days['2026-11-01']['0-0']")=='done'
  browser.close()
 print('PASS: welcome, Google PKCE redirect, profile after login, mid-flow refresh, BMI and editable water recommendation, account persistence, repeat visits and unavailable-provider fallback')
finally:server.shutdown()
