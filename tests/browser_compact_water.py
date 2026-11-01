from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
import threading
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])))
threading.Thread(target=server.serve_forever,daemon=True).start()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
  page=browser.new_page(viewport={'width':390,'height':664})
  page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
  page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('#open-water').click()
  for w,h in [(320,568),(390,664),(390,780)]:
   page.set_viewport_size({'width':w,'height':h})
   page.locator('[data-drink-ml="250"]').first.click()
   assert page.locator('.drink-added').evaluate('(e)=>e.getAnimations().length>0')
   assert page.locator('#water-dialog').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1'),(w,h)
   assert page.locator('#close-water').evaluate('(e)=>e.getBoundingClientRect().bottom<=innerHeight'),(w,h)
   page.locator('#water-history').click()
   assert page.locator('#water-dialog').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1'),(w,h,'history')
   page.locator('#water-add-view').click()
  page.locator('[data-drink-ml="1000"]').click();page.locator('[data-drink-ml="250"]').first.click()
  assert 'היעד הושלם' in page.locator('#drink-feedback').inner_text()
  page.locator('#close-water').click();page.locator('[data-group="במהלך היום"]').click()
  assert page.locator('[data-check="1-6"]').get_attribute('aria-pressed')=='true'
  page.reload();page.locator('[data-group="במהלך היום"]').click()
  assert page.locator('[data-check="1-6"]').get_attribute('aria-pressed')=='true'
  page.locator('#open-water').click();page.screenshot(path='/workspace/scratch/compact-water.png')
  browser.close()
 print('PASS: compact add/history views without scrolling; click animation; water goal automatically completes daily habit and persists')
finally:server.shutdown()
