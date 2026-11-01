from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
import threading,json
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':664},timezone_id='Asia/Jerusalem')
 page.clock.install(time=datetime(2026,11,4,12,0,tzinfo=ZoneInfo('Asia/Jerusalem')))
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
 page.add_init_script("if(!localStorage.getItem('silent-warrior-v1'))localStorage.setItem('silent-warrior-v1',JSON.stringify({habitConfigVersion:1,removedHabits:['0-1'],days:{'2026-11-02':{'0-0':'done'},'2026-11-03':{'0-0':'done'}}}))")
 page.goto(f'http://127.0.0.1:{server.server_port}')
 assert page.locator('[data-reporting-streak]').get_attribute('data-reporting-streak')=='2'
 page.locator('#open-water').click();page.locator('[data-drink-kind=coffee]').click();page.locator('[data-drink-ml="1000"]').click();page.locator('#close-water').click()
 assert '1200 / 2000' in page.locator('#open-water').inner_text()
 assert page.locator('[data-reporting-streak]').get_attribute('data-reporting-streak')=='3'
 page.locator('[data-group="בוקר"]').click();page.locator('[data-check="0-0"]').click();page.locator('[data-check="0-11"]').click()
 page.locator('[data-group="במהלך היום"]').click();page.locator('[data-check="1-0"]').click()
 page.locator('[data-group="ערב"]').click();page.locator('[data-check="2-3"]').click()
 assert '2450 / 2000' in page.locator('#open-water').inner_text()
 page.locator('[data-group="בוקר"]').click();assert page.locator('[data-habit-id="0-0"] .habit-streak').inner_text()=='🔥3'
 page.locator('[data-check="0-0"]').click();assert '2200 / 2000' in page.locator('#open-water').inner_text()
 page.locator('[data-check="0-0"]').click();assert '2450 / 2000' in page.locator('#open-water').inner_text()
 page.locator('#open-water').click();page.locator('.drink-history summary').click()
 entries=page.evaluate("JSON.parse(localStorage.getItem('silent-warrior-v1')).water['2026-11-04']")
 coffee=next(key for key,value in entries.items() if value and value['kind']=='coffee')
 page.locator(f'[data-remove-drink="{coffee}"]').click()
 page.locator('#drink-kind').select_option('tea');page.locator('#drink-ml').fill('375');page.locator('#drink-form [type=submit]').click();page.locator('#close-water').click()
 assert '2625 / 2000' in page.locator('#open-water').inner_text()
 page.locator('[data-page="settings"]').click();page.locator('#water-goal').fill('3000');page.locator('#water-goal-form [type=submit]').click()
 page.reload();page.locator('[data-page="today"]').click();assert '2625 / 3000' in page.locator('#open-water').inner_text()
 page.locator('[data-page="history"]').click();assert page.locator('.water-trend svg').count()==1;assert page.locator('.completion-trend svg').count()==1
 page.locator('[data-water-date="2026-11-03"]').click();assert page.locator('#water-dialog').is_visible();assert page.locator('#water-dialog').get_attribute('data-date')=='2026-11-03';page.locator('#close-water').click()
 page.locator('[data-period="month"]').click();assert 'חודשי' in page.locator('.water-trend h2').inner_text()
 page.locator('[data-page="today"]').click();page.locator('[data-group="בוקר"]').click()
 for w,h in [(320,568),(390,664),(430,740)]:
  page.set_viewport_size({'width':w,'height':h});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  dims=page.locator('.habit-panel').evaluate('(e)=>[e.scrollHeight,e.clientHeight]');assert dims[0]<=dims[1]+1,(w,h,dims)
 page.set_viewport_size({'width':390,'height':664});page.screenshot(path='/tmp/warrior-hydration-home.png')
 page.locator('#open-water').click();page.screenshot(path='/tmp/warrior-hydration-dialog.png')
 assert not errors,errors
 browser.close()
server.shutdown();print('PASS: drink presets and custom amounts, all automatic contributions, undo/recheck, deletion, goal persistence, streaks, charts and mobile fit')
