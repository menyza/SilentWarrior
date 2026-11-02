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
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':844},timezone_id='Asia/Jerusalem')
  page.clock.install(time=datetime(2026,11,2,12,0,tzinfo=ZoneInfo('Asia/Jerusalem')))
  page.add_init_script("if(!localStorage.getItem('silent-warrior-v1'))localStorage.setItem('silent-warrior-v1',JSON.stringify({profile:{sex:'male',weightKg:70,heightCm:175,completedAt:1,creatine:false,waterGoalMode:'auto'},waterGoal:2100,weights:{'2026-11-01':72},days:{}}));localStorage.setItem('levelup-onboarding-v1','legacy')")
  page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
  page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('[data-page="settings"]').click();page.locator('[data-page="profile"]').click()
  assert page.locator('#profile-weight').input_value()=='72';assert page.locator('#profile-weight').get_attribute('readonly') is not None
  page.locator('#profile-creatine').check();assert page.locator('#creatine-water-note').is_visible();assert page.locator('#profile-water-goal').input_value()=='2200'
  page.locator('#profile-form [type=submit]').click()
  assert page.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).profile.creatine") is True
  assert page.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).weights['2026-11-02']===undefined")
  page.locator('[data-page="weight"]').first.click();page.locator('#weight-date').fill('2026-11-02');page.locator('#weight-value').fill('80');page.locator('#weight-form [type=submit]').click()
  assert page.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).waterGoal")==2400
  page.locator('[data-page="settings"]').click();page.locator('[data-page="profile"]').click();assert page.locator('#profile-weight').input_value()=='80';assert page.locator('#profile-bmi').inner_text()=='26.1';assert page.locator('#profile-creatine').is_checked()
  page.locator('#profile-water-goal').fill('2600');page.locator('#profile-form [type=submit]').click()
  assert page.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).profile.waterGoalMode")=='manual'
  page.locator('[data-page="weight"]').first.click();page.locator('#weight-value').fill('75');page.locator('#weight-form [type=submit]').click()
  assert page.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).waterGoal")==2600
  page.reload();page.locator('[data-page="settings"]').click();page.locator('[data-page="profile"]').click();assert page.locator('#profile-weight').input_value()=='75';assert page.locator('#profile-creatine').is_checked()
  page.screenshot(path='/workspace/scratch/profile-creatine.png');browser.close()
 print('PASS: latest reported weight and BMI, creatine preference, no fabricated weigh-in, automatic water target and preserved manual target')
finally:server.shutdown()
