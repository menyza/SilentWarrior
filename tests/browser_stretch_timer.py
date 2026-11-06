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
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':664},timezone_id='Asia/Jerusalem')
  page.clock.install(time=datetime(2026,11,6,9,0,tzinfo=ZoneInfo('Asia/Jerusalem')))
  page.add_init_script("localStorage.setItem('levelup-onboarding-v1','legacy');if(!localStorage.getItem('silent-warrior-v1'))localStorage.setItem('silent-warrior-v1',JSON.stringify({days:{'2026-11-04':{'0-3':'done'},'2026-11-05':{'0-3':'done'}}}))")
  page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
  page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('[data-group="בוקר"]').click()
  assert page.locator('[data-habit-id="0-3"] .habit-streak').inner_text()=='2'
  page.locator('[data-check="0-3"]').click();assert page.locator('#stretch-dialog').is_visible();assert page.locator('#stretch-clock').inner_text()=='05:00'
  for w,h in [(320,568),(390,664)]:
   page.set_viewport_size({'width':w,'height':h});assert page.locator('#stretch-dialog').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1'),(w,h)
  assert page.locator('[data-check="0-3"]').get_attribute('aria-pressed')=='false'
  page.clock.fast_forward(60000);assert page.locator('#stretch-clock').inner_text()=='04:00'
  page.locator('#stretch-pause').click();page.clock.fast_forward(120000);assert page.locator('#stretch-clock').inner_text()=='04:00'
  page.locator('#stretch-pause').click();page.clock.fast_forward(20000);assert page.locator('#stretch-clock').inner_text()=='03:40'
  page.locator('#stretch-background').click();assert page.locator('[data-stretch-inline]').inner_text()=='03:40'
  page.reload();page.locator('[data-group="בוקר"]').click();page.locator('[data-check="0-3"]').click();assert page.locator('#stretch-clock').inner_text()=='03:40'
  page.locator('#stretch-reset').click();assert page.locator('#stretch-clock').inner_text()=='05:00';page.clock.fast_forward(300000)
  assert page.locator('#stretch-clock').inner_text()=='00:00';assert page.locator('[data-check="0-3"]').get_attribute('aria-pressed')=='false'
  page.locator('#stretch-done').click();assert not page.locator('#stretch-dialog').is_visible();assert page.locator('[data-check="0-3"]').get_attribute('aria-pressed')=='true'
  assert page.locator('[data-habit-id="0-3"] .habit-streak').inner_text()=='2'
  page.reload();page.locator('[data-group="בוקר"]').click();assert page.locator('[data-check="0-3"]').get_attribute('aria-pressed')=='true'
  assert page.locator('.habit-panel').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1')
  browser.close()
 print('PASS: weekend streak continuity; five-minute timer, pause/resume, background/reload, reset, explicit completion and persistence without auto-marking')
finally:server.shutdown()
