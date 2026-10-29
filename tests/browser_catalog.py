from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading
from pathlib import Path
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])));threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':664},is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('[data-group="בוקר"]').click()
 assert page.locator('[data-check="0-1"]').count()==0
 assert page.locator('[data-check]').count()==12
 assert page.locator('.daily-meter .track').count()==0
 assert page.locator('.daily-meter h2').count()==0
 page.locator('[data-check="0-0"]').click();assert page.get_by_role('progressbar').get_attribute('aria-valuenow')=='1'
 page.locator('[data-page="settings"]').click();page.locator('[data-page="habits"]').click()
 page.locator('.add-habit summary').click()
 page.locator('#habit-name').fill('ללמוד 10 דקות');page.locator('#habit-importance').select_option('3');page.locator('#habit-effort').select_option('2')
 assert '20' in page.locator('#new-habit-points').inner_text()
 page.locator('#add-habit-form [type=submit]').click()
 custom=page.locator('[data-remove-habit^="custom-"]').first.get_attribute('data-remove-habit')
 page.locator('[data-page="today"]').click();page.locator('[data-group="בוקר"]').click()
 assert page.locator('.habit-pager').count()==1
 page.locator('[data-habit-page="1"]').click();assert page.locator(f'[data-check="{custom}"]').count()==1
 page.locator(f'[data-check="{custom}"]').click();assert page.get_by_role('progressbar').get_attribute('aria-valuenow')=='2'
 page.reload();page.locator('[data-group="בוקר"]').click();page.locator('[data-habit-page="1"]').click()
 assert page.locator(f'[data-check="{custom}"]').get_attribute('aria-pressed')=='true'
 page.locator('[data-page="settings"]').click();page.locator('[data-page="habits"]').click();page.locator('.manage-group summary').first.click();page.locator(f'[data-remove-habit="{custom}"]').click()
 page.locator('[data-page="today"]').click();page.locator('[data-group="בוקר"]').click()
 assert page.locator(f'[data-check="{custom}"]').count()==0
 assert page.get_by_role('progressbar').get_attribute('aria-valuenow')=='1'
 page.locator('[data-page="history"]').click()
 assert '30 נק׳' in page.locator('.stat-grid').inner_text() or page.locator('.stat-grid b').first.inner_text()=='30'
 assert 'ללמוד 10 דקות' in page.locator('.progress-table').inner_text()
 page.locator('[data-page="settings"]').click();page.locator('[data-page="habits"]').click();page.locator('.archived-habits summary').click();page.locator(f'[data-restore-habit="{custom}"]').click()
 page.locator('.add-habit summary').click();page.locator('#habit-name').fill('<img src=x onerror="window.hacked=true">');page.locator('#add-habit-form [type=submit]').click()
 page.locator('[data-page="today"]').click();page.locator('[data-group="בוקר"]').click();page.locator('[data-habit-page="1"]').click()
 assert page.locator('.compact-grid img').count()==0
 assert page.evaluate('window.hacked') is None
 for width,height in [(320,568),(390,664),(430,740)]:
  page.set_viewport_size({'width':width,'height':height})
  dims=page.locator('.habit-panel').evaluate('(e)=>[e.scrollHeight,e.clientHeight]');assert dims[0]<=dims[1]+1,(width,height,dims)
  page.locator('[data-habit-page="0"]').click()
  dims=page.locator('.habit-panel').evaluate('(e)=>[e.scrollHeight,e.clientHeight]');assert dims[0]<=dims[1]+1,(width,height,dims)
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.locator('[data-habit-page="1"]').click()
 page.set_viewport_size({'width':390,'height':664});page.locator('[data-habit-page="0"]').click();page.screenshot(path='/tmp/warrior-circle.png')
 first=page.locator('[data-check="0-0"]').bounding_box();target=page.locator('[data-check="0-3"]').bounding_box()
 page.locator('[data-check="0-0"]').dispatch_event('pointerdown',{'pointerId':1,'pointerType':'touch','isPrimary':True,'button':0,'clientX':first['x']+first['width']/2,'clientY':first['y']+first['height']/2})
 page.wait_for_timeout(420)
 page.locator('.compact-grid').dispatch_event('pointermove',{'pointerId':1,'pointerType':'touch','isPrimary':True,'clientX':target['x']+target['width']/2,'clientY':target['y']+target['height']/2})
 page.locator('.compact-grid').dispatch_event('pointerup',{'pointerId':1,'pointerType':'touch','isPrimary':True})
 page.reload();page.locator('[data-group="בוקר"]').click()
 assert page.locator('[data-check]').first.get_attribute('data-check')=='0-2'
 page.locator('[data-habit-page="1"]').click()
 assert page.locator(f'[data-check="{custom}"]').count()==1
 assert page.locator('[data-check]').count()==2
 assert not errors,errors
 b.close()
server.shutdown();print('PASS: removed requested habit, circular percentage-only gauge, create custom habit with weighted points, pagination, complete/reload/archive/restore, preserve historical score, escape markup, compact phone layouts')
