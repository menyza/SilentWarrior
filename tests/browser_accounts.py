"""Run after notifications/tests/account-local-server.js; uses real WebAuthn signatures and local D1."""
from playwright.sync_api import sync_playwright
from pathlib import Path
import json,time,tempfile
info=Path('/tmp/silent-warrior-account-test.json')
for _ in range(40):
 if info.exists():break
 time.sleep(.25)
config=json.loads(info.read_text());origin=config['origin'];api=config['api']
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 errors=[]
 def device(credential=None):
  context=browser.new_context(viewport={'width':390,'height':744},accept_downloads=True)
  page=context.new_page();page.on('pageerror',lambda e:errors.append(str(e)))
  cdp=context.new_cdp_session(page);cdp.send('WebAuthn.enable',{'enableUI':False})
  aid=cdp.send('WebAuthn.addVirtualAuthenticator',{'options':{'protocol':'ctap2','transport':'internal','hasResidentKey':True,'hasUserVerification':True,'isUserVerified':True,'automaticPresenceSimulation':True}})['authenticatorId']
  if credential:cdp.send('WebAuthn.addCredential',{'authenticatorId':aid,'credential':credential})
  page.goto(origin)
  return context,page,cdp,aid
 def account(page):page.locator('[data-page="account"]').click()
 def saved(page):page.wait_for_function("document.querySelector('#cloud-indicator').textContent==='שמור בחשבון'",timeout=30000)
 def doc(page):
  return page.evaluate("""async(api)=>{const a=JSON.parse(localStorage.getItem('silent-warrior-account-v1'));const r=await fetch(api+'/account/data',{headers:{Authorization:'Bearer '+a.token,'Content-Type':'application/json'}});return r.json()}""",api)
 def sign_in(page):
  account(page);page.locator('#account-login').click();saved(page)
 c1,a,cdp1,aid1=device()
 a.locator('[data-group="בוקר"]').click();a.locator('[data-check="0-0"]').click()
 a.locator('[data-check="0-12"]').click();a.locator('#quick-weight').fill('75.5');a.locator('#weigh-in-form [type=submit]').click()
 account(a);a.locator('#account-name').fill('חשבון בדיקה א');a.locator('#account-invite').fill('local-test-invite');a.locator('#account-register [type=submit]').click()
 a.wait_for_selector('#account-import',timeout=30000)
 assert doc(a)['snapshot'] is None,'Guest data must not upload before consent'
 a.locator('#account-import').click();saved(a)
 first=doc(a);assert first['snapshot']['state']['weights'][time.strftime('%Y-%m-%d')]==75.5
 credentials=cdp1.send('WebAuthn.getCredentials',{'authenticatorId':aid1})['credentials'];assert len(credentials)==1
 c2,b,cdp2,aid2=device(credentials[0]);sign_in(b)
 assert doc(b)['snapshot']==first['snapshot']
 b.locator('[data-page="today"]').click();b.locator('[data-group="בוקר"]').click();assert b.locator('[data-check="0-0"]').get_attribute('aria-pressed')=='true'
 # Concurrent independent edits, including an offline device.
 c2.set_offline(True);b.locator('[data-check="0-4"]').click()
 a.locator('[data-page="today"]').click();a.locator('[data-group="בוקר"]').click();a.locator('[data-check="0-2"]').click();saved(a)
 c2.set_offline(False);account(b);b.locator('#account-sync').click();saved(b)
 account(a);a.locator('#account-sync').click();saved(a)
 day=time.strftime('%Y-%m-%d');marks=doc(a)['snapshot']['state']['days'][day]
 assert marks['0-0']==marks['0-2']==marks['0-4']=='done'
 # Two conflicting measurements are never silently overwritten.
 c2.set_offline(True);b.locator('[data-page="weight"]').click();b.locator('#weight-value').fill('75.9');b.locator('#weight-form [type=submit]').click()
 a.locator('[data-page="weight"]').click();a.locator('#weight-value').fill('74.9');a.locator('#weight-form [type=submit]').click();saved(a)
 c2.set_offline(False);account(b)
 if b.locator('#account-sync').is_enabled():b.locator('#account-sync').click()
 b.wait_for_selector('#account-prefer-local',timeout=30000)
 assert doc(a)['snapshot']['state']['weights'][day]==74.9
 b.locator('#account-prefer-local').click();saved(b)
 assert doc(b)['snapshot']['state']['weights'][day]==75.9
 with b.expect_download() as event:b.locator('#account-export').click()
 download=event.value;backup=json.loads(Path(download.path()).read_text());assert backup['format']=='silent-warrior-backup'
 assert backup['snapshot']['state']['weights'][day]==75.9
 assert 'token' not in json.dumps(backup)
 backup['snapshot']['state']['reflections'][day]='busy'
 b.locator('#account-file').set_input_files({'name':'restore.json','mimeType':'application/json','buffer':json.dumps(backup).encode()})
 b.wait_for_selector('#account-import');b.locator('#account-import').click();saved(b)
 assert doc(b)['snapshot']['state']['reflections'][day]=='busy'
 b.locator('.account-history summary').click();b.locator('#account-history').click();b.wait_for_selector('#account-versions button');assert b.locator('#account-versions button').count()>0
 # Fresh browser storage simulates reinstall; same passkey restores all cloud state.
 latest_credential=cdp2.send('WebAuthn.getCredentials',{'authenticatorId':aid2})['credentials'][0]
 c3,fresh,cdp3,aid3=device(latest_credential);sign_in(fresh)
 assert doc(fresh)['snapshot']['state']['weights'][day]==75.9
 assert doc(fresh)['snapshot']['state']['reflections'][day]=='busy'
 fresh.locator('[data-page="today"]').click();fresh.locator('[data-group="בוקר"]').click();assert fresh.locator('[data-check="0-4"]').get_attribute('aria-pressed')=='true'
 # A second real passkey account sees no data from the first.
 c4,other,cdp4,aid4=device();account(other);other.locator('#account-name').fill('חשבון בדיקה ב');other.locator('#account-invite').fill('local-test-invite');other.locator('#account-register [type=submit]').click();saved(other)
 assert doc(other)['snapshot'] is None
 other.locator('[data-page="today"]').click();other.locator('[data-group="בוקר"]').click();assert other.locator('[data-check="0-0"]').get_attribute('aria-pressed')=='false'
 assert not errors,errors
 browser.close()
print('PASS: real passkey registration/login, consent before migration, D1 persistence, two-device offline merge, explicit weight conflict, private backup export, server history, fresh-storage restore, account isolation')
