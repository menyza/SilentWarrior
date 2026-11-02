from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import threading
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])));threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  def mock(r):
   path=r.request.url.split('.dev')[-1];data='{"providers":["google"]}' if path.endswith('/social/config') else '{"user":{"id":"A","displayName":"Test"}}' if path.endswith('/me') else '{"revision":0,"snapshot":null}'
   r.fulfill(status=200,content_type='application/json',body=data)
  for onboarding in [False,True]:
   context=b.new_context(service_workers='block',viewport={'width':390,'height':844},timezone_id='Asia/Jerusalem');context.route('https://silentwarrior.menyzakar142.workers.dev/**',mock)
   page=context.new_page();page.clock.install(time=datetime(2026,11,2,12,0,tzinfo=ZoneInfo('Asia/Jerusalem')))
   if onboarding:page.add_init_script("localStorage.setItem('silent-warrior-account-v1',JSON.stringify({token:'a'.repeat(64),user:{id:'A'}}));localStorage.setItem('levelup-onboarding-v1','pending')")
   else:page.add_init_script("localStorage.setItem('levelup-onboarding-v1','legacy');localStorage.setItem('silent-warrior-v1',JSON.stringify({profile:{sex:'male',weightKg:70,heightCm:175,completedAt:1,creatine:true,waterGoalMode:'auto'},weights:{'2026-11-01':72}}))")
   page.goto(f'http://127.0.0.1:{server.server_port}')
   if not onboarding:page.locator('[data-page="settings"]').click();page.locator('[data-page="profile"]').click()
   page.locator('#profile-form').wait_for(state='visible');page.evaluate('document.fonts.ready')
   if onboarding:
    page.locator('#profile-sex').select_option('male');page.locator('#profile-weight').fill('70');page.locator('#profile-height').fill('175');page.locator('#profile-creatine').check();assert page.locator('#profile-water-goal').input_value()=='2400'
   for w,h in [(320,568),(375,667),(390,844),(430,932)]:
    page.set_viewport_size({'width':w,'height':h})
    assert page.locator('main').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1'),(onboarding,w,h,'main')
    assert page.locator('.profile-screen').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1'),(onboarding,w,h,'profile')
    assert page.locator('#profile-form').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1'),(onboarding,w,h,'form')
    assert page.locator('.profile-submit').evaluate('(e)=>{const r=e.getBoundingClientRect(),p=e.closest(".profile-screen").getBoundingClientRect();return r.top>=p.top&&r.bottom<=p.bottom+1}'),(onboarding,w,h,'submit')
   page.locator('#profile-info').click();assert page.locator('#profile-info-dialog').is_visible();page.locator('#close-profile-info').click()
   page.set_viewport_size({'width':390,'height':844});page.screenshot(path='/workspace/scratch/profile-one-screen'+('-new' if onboarding else '')+'.png');context.close()
  b.close()
 print('PASS: metrics and onboarding metrics fit one screen at four phone sizes; creatine adds 300 ml once; info remains available')
finally:server.shutdown()
