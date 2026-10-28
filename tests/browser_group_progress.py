from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
import threading
from pathlib import Path
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])));threading.Thread(target=server.serve_forever,daemon=True).start()
url=f'http://127.0.0.1:{server.server_port}/'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':390,'height':664},is_mobile=True,has_touch=True)
 page.set_viewport_size({'width':390,'height':664});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(url);page.locator('[data-group="בוקר"]').click()
 assert page.locator('.score-ring').bounding_box()['height']<=46
 assert page.locator('.today-title').bounding_box()['height']<65
 for id,priority in [('0-2',1),('0-0',2),('0-6',3)]:
  assert f'priority-{priority}' in page.locator(f'[data-habit-id="{id}"]').get_attribute('class')
 count=page.locator('[data-check]').count()
 for i in range(count):
  button=page.locator('[data-check]').nth(i)
  if button.get_attribute('data-check')=='0-12':
   button.click();page.locator('#quick-weight').fill('75.5');page.locator('#weigh-in-form [type=submit]').click()
  else:button.click()
 assert page.get_by_role('progressbar').get_attribute('aria-valuenow')==str(count)
 assert '100 אחוזים' in page.get_by_role('progressbar').get_attribute('aria-valuetext')
 assert page.locator('.score-ring>span').text_content()=='100%'
 page.locator('[data-group="ערב"]').click();assert page.get_by_role('progressbar').get_attribute('aria-valuenow')=='0'
 page.locator('[data-page="history"]').click();assert int(page.locator('.stat-grid b').nth(1).inner_text())>0
 page.locator('[data-page="today"]').click();page.locator('[data-group="בוקר"]').click()
 assert '100 אחוזים' in page.get_by_role('progressbar').get_attribute('aria-valuetext')
 page.reload();page.locator('[data-group="בוקר"]').click();assert page.locator('.score-ring>span').text_content()=='100%'
 assert page.locator('.brand-icon').evaluate('(e)=>e.complete&&e.naturalWidth>0')
 manifest=page.request.get(url+'manifest.webmanifest').json()
 for icon in manifest['icons']:assert page.request.get(url+icon['src']).status==200
 for w,h in [(320,568),(390,664),(430,740)]:
  page.set_viewport_size({'width':w,'height':h})
  assert page.locator('.score-ring').bounding_box()['height']<=46
  assert page.locator('.habit-panel').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.set_viewport_size({'width':390,'height':664});page.screenshot(path='/tmp/warrior-group-gauge.png')
 assert not errors,errors
 b.close()
server.shutdown();print('PASS: app icon assets, compact title-row gauge, morning reaches 100% independently, evening starts at zero, daily score preserved, importance colors, reload and mobile layouts')
