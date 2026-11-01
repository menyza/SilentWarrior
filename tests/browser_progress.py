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
 page=browser.new_page(viewport={'width':390,'height':664},timezone_id='Asia/Jerusalem')
 page.clock.install(time=datetime(2026,11,4,12,0,tzinfo=ZoneInfo('Asia/Jerusalem')))
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
 page.add_init_script("if(!localStorage.getItem('silent-warrior-v1'))localStorage.setItem('silent-warrior-v1',JSON.stringify({habitConfigVersion:1,days:{'2026-10-31':{'1-2':'done'},'2026-11-01':{'1-2':'done'},'2026-11-02':{'1-2':'done'},'2026-11-03':{'1-2':'rest'},'2026-11-04':{'0-0':'done'}}}))")
 page.goto(f'http://127.0.0.1:{server.server_port}')
 def percent(kind):return page.locator(f'[data-gauge={kind}] .score-ring>span').text_content()
 assert page.get_by_role('progressbar').count()==3
 assert percent('weekly')=='67%';assert percent('daily')=='3%'
 for group in ['בוקר','במהלך היום','ערב']:
  page.locator(f'[data-group="{group}"]').click();assert percent('daily')=='3%';assert percent('weekly')=='67%'
 page.locator('[data-group="במהלך היום"]').click();page.locator('[data-check="1-2"]').click()
 page.get_by_role('button',name='טניס',exact=True).click();assert percent('weekly')=='100%';assert percent('daily')=='7%'
 page.locator('[data-check="1-2"]').click();assert percent('weekly')=='67%'
 page.locator('[data-info="1-2"]').click();page.locator('#detail-rest').click();assert percent('weekly')=='67%'
 page.locator('[data-page="settings"]').click();page.locator('#weekly-workout-goal').fill('4');page.locator('#workout-goal-form [type=submit]').click()
 page.locator('[data-page="today"]').click();assert percent('weekly')=='50%'
 page.reload();assert percent('weekly')=='50%'
 for w,h in [(320,568),(390,664),(430,740)]:
  page.set_viewport_size({'width':w,'height':h})
  for group in ['בוקר','במהלך היום','ערב']:
   page.locator(f'[data-group="{group}"]').click()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   dims=page.locator('.habit-panel').evaluate('(e)=>[e.scrollHeight,e.clientHeight]');assert dims[0]<=dims[1]+1,(w,h,group,dims)
 page.set_viewport_size({'width':390,'height':664});page.screenshot(path='/tmp/warrior-three-gauges.png')
 page.clock.set_system_time(datetime(2026,11,8,0,5,tzinfo=ZoneInfo('Asia/Jerusalem')));page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
 assert percent('weekly')=='0%';assert percent('daily')=='0%'
 assert page.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).days['2026-11-01']['1-2']")=='done'
 assert not errors,errors
 browser.close()
server.shutdown();print('PASS: three independent gauges, workout picker, rest exclusion, editable weekly goal, reload, Sunday reset, mobile fit and history retention')
