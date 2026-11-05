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
  page.clock.install(time=datetime(2026,11,5,12,0,tzinfo=ZoneInfo('Asia/Jerusalem')))
  page.add_init_script("localStorage.setItem('levelup-onboarding-v1','legacy');if(!localStorage.getItem('silent-warrior-v1'))localStorage.setItem('silent-warrior-v1',JSON.stringify({days:{'2026-10-31':{'1-2':'done'},'2026-11-01':{'1-2':'done'},'2026-11-03':{'1-2':'done'},'2026-11-04':{'1-2':'rest'},'2026-11-06':{'1-2':'done'}},workouts:{'2026-10-31':'חדר כושר','2026-11-01':'טניס','2026-11-03':'יוגה','2026-11-06':'שחייה'}}))")
  page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
  page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('#open-weekly-workouts').focus();page.keyboard.press('Enter')
  dialog=page.locator('#weekly-workouts');assert dialog.is_visible();assert dialog.locator('li').count()==2
  assert 'טניס' in dialog.inner_text() and 'יוגה' in dialog.inner_text();assert 'שחייה' not in dialog.inner_text() and 'חדר כושר' not in dialog.inner_text()
  assert '2 / 3' in dialog.inner_text() and 'ימי מנוחה שסומנו: 1' in dialog.inner_text()
  page.keyboard.press('Escape');assert not dialog.is_visible()
  page.evaluate("const s=JSON.parse(localStorage.getItem('silent-warrior-v1'));s.days={};s.workouts={};localStorage.setItem('silent-warrior-v1',JSON.stringify(s))")
  page.reload();page.locator('#open-weekly-workouts').click();assert 'עדיין לא תועדו' in dialog.inner_text();assert '0 / 3' in dialog.inner_text()
  page.locator('#close-weekly-workouts').click();assert not dialog.is_visible()
  assert page.locator('.habit-panel').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1')
  browser.close()
 print('PASS: weekly gauge opens date/type list, excludes rest and other weeks/future days, handles zero workouts, keyboard open/close and preserves home fit')
finally:server.shutdown()
