"""Browser redirect/PKCE/return UX with a mocked identity provider (no external accounts)."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,hashlib,base64
from urllib.parse import urlparse,parse_qs,quote
config=json.loads(Path('/tmp/silent-warrior-account-test.json').read_text())
origin,api=config['origin'],config['api']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':744},service_workers='block')
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 flows={};verified=[];starts=[];token='c'*64;owner={'id':'social-owner','displayName':'בדיקת Google'}
 def backend(route):
  request=route.request;path=urlparse(request.url).path
  data=json.loads(request.post_data or '{}')
  if path=='/account/social/config':result={'providers':['google','facebook','apple']}
  elif path=='/account/social/start':
   state='fixture-state-'+str(len(flows));flows[state]=data;starts.append(data)
   result={'state':state,'url':'https://identity.example.test/authorize?state='+state}
  elif path=='/account/social/verify':
   assert data['state'] in flows
   actual=base64.urlsafe_b64encode(hashlib.sha256(data['verifier'].encode()).digest()).decode().rstrip('=')
   assert actual==flows[data['state']]['pkce'];assert data['code']=='fixture-code'
   if flows[data['state']]['link']:assert request.headers.get('authorization')=='Bearer '+token
   verified.append(data['state']);result={'token':token,'user':owner}
  elif path=='/account/data':result={'revision':0,'snapshot':None,'updatedAt':None}
  elif path=='/account/me':result={'user':owner}
  else:result={'loggedOut':True}
  route.fulfill(status=200,content_type='application/json',headers={'Access-Control-Allow-Origin':origin},body=json.dumps(result))
 context.route(api+'/**',backend)
 def provider(route):
  state=parse_qs(urlparse(route.request.url).query)['state'][0]
  route.fulfill(status=302,headers={'Location':origin+'/?state='+quote(state)+'&code=fixture-code'})
 context.route('https://identity.example.test/**',provider)
 page.goto(origin);page.locator('[data-page="settings"]').click();page.locator('[data-page="account"]').click()
 with page.expect_response(lambda r:'/account/social/verify' in r.url):
  page.locator('#account-social-google').click()
 page.wait_for_function("document.querySelector('#cloud-indicator').textContent==='שמור בחשבון'")
 assert page.locator('.account-identity strong').inner_text()==owner['displayName']
 assert '?' not in page.url and len(verified)==1
 assert starts[0]['provider']=='google' and starts[0]['link']==False
 assert page.evaluate("sessionStorage.getItem('silent-warrior-social-request-v1')") is None
 with page.expect_response(lambda r:'/account/social/verify' in r.url):
  page.locator('#account-social-apple').click()
 page.wait_for_function("document.querySelector('#cloud-indicator').textContent==='שמור בחשבון'")
 assert len(verified)==2 and starts[1]['link']==True
 assert page.evaluate("JSON.parse(localStorage.getItem('silent-warrior-account-v1')).user.id")=='social-owner'
 # Callback without the same-tab request must never exchange its code.
 page.goto(origin+'/?state=attacker&code=fixture-code')
 page.wait_for_function("document.querySelector('#account-status').textContent.includes('לא נמצאה בקשת כניסה')")
 assert len(verified)==2 and '?' not in page.url
 assert not errors,errors
 browser.close()
print('PASS: social buttons, redirect, PKCE verifier, callback cleanup, account link, invalid-state rejection; mocked provider')
