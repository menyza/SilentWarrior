"""Backfill the previous day after local midnight without modifying today's data."""
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import threading
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':664},is_mobile=True,has_touch=True,timezone_id='Asia/Jerusalem')
 page.clock.install(time=datetime(2026,10,30,0,5,tzinfo=ZoneInfo('Asia/Jerusalem')))
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
 page.goto(f'http://127.0.0.1:{server.server_port}')
 assert page.locator('.selected-day time').get_attribute('datetime')=='2026-10-30'
 assert page.locator('[data-day-step="1"]').is_disabled()
 page.locator('[data-group="בוקר"]').click();page.locator('[data-check="0-0"]').click();page.clock.run_for(1600)
 page.locator('[data-day-step="-1"]').click();assert page.locator('.selected-day time').get_attribute('datetime')=='2026-10-29'
 assert 'אתמול' in page.locator('.selected-day').inner_text()
 assert page.locator('[data-check="0-0"]').get_attribute('aria-pressed')=='false'
 page.locator('[data-check="0-2"]').click();assert page.locator('[data-check="0-2"]').get_attribute('aria-pressed')=='true'
 assert page.locator('.celebration').count()==0
 page.locator('[data-check="0-12"]').click();assert page.locator('#weigh-in-date').input_value()=='2026-10-29'
 page.locator('#quick-weight').fill('75.5');page.locator('#weigh-in-form [type=submit]').click()
 page.locator('[data-group="במהלך היום"]').click();page.locator('[data-info="1-2"]').click();page.locator('#detail-rest').click()
 page.locator('#review-day').click();page.locator('#reflection-reason').select_option('busy');page.locator('#reflection-form [type=submit]').click()
 state=page.evaluate('JSON.parse(localStorage.getItem("silent-warrior-v1"))')
 assert state['days']['2026-10-30']['0-0']=='done'
 assert '0-2' not in state['days']['2026-10-30']
 assert state['days']['2026-10-29']['0-2']=='done'
 assert state['days']['2026-10-29']['1-2']=='rest'
 assert state['weights']['2026-10-29']==75.5
 assert state['reflections']['2026-10-29']=='busy' and '2026-10-30' not in state['reflections']
 page.locator('[data-day-step="-1"]').click();assert page.locator('.selected-day time').get_attribute('datetime')=='2026-10-28'
 page.locator('[data-day-step="1"]').click();page.reload()
 assert page.locator('.selected-day time').get_attribute('datetime')=='2026-10-29'
 page.locator('[data-group="בוקר"]').click();assert page.locator('[data-check="0-2"]').get_attribute('aria-pressed')=='true'
 # A selected historical date remains stable when the calendar day changes.
 page.clock.set_system_time(datetime(2026,10,31,0,5,tzinfo=ZoneInfo('Asia/Jerusalem')))
 page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
 assert page.locator('.selected-day time').get_attribute('datetime')=='2026-10-29'
 page.locator('[data-day-today]').click();assert page.locator('.selected-day time').get_attribute('datetime')=='2026-10-31'
 assert page.locator('[data-day-step="1"]').is_disabled()
 # Follow today across midnight once the user returns to today.
 page.clock.set_system_time(datetime(2026,11,1,0,5,tzinfo=ZoneInfo('Asia/Jerusalem')))
 page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
 assert page.locator('.selected-day time').get_attribute('datetime')=='2026-11-01'
 for w,h in [(320,568),(375,667),(390,664),(430,740)]:
  page.set_viewport_size({'width':w,'height':h})
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  for group in ['בוקר','במהלך היום','ערב']:
   page.locator(f'[data-group="{group}"]').click()
   dims=page.locator('.habit-panel').evaluate('(e)=>[e.scrollHeight,e.clientHeight]');assert dims[0]<=dims[1]+1,(w,h,group,dims)
 page.set_viewport_size({'width':390,'height':664});page.screenshot(path='/tmp/warrior-day-navigation.png')
 assert not errors,errors
 browser.close()
server.shutdown();print('PASS: previous/next days after midnight, separate habit/rest/weight/reflection storage, reload, pinned dates, today rollover and compact layouts')
