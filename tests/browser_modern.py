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
 assert page.locator('[data-check]').count()==13
 page.locator('[data-check="0-12"]').click();assert page.locator('#weigh-in').is_visible()
 page.locator('#quick-weight').fill('75.5');page.locator('#weigh-in-form [type=submit]').click()
 assert page.locator('[data-check="0-12"]').get_attribute('aria-pressed')=='true'
 assert page.get_by_role('progressbar').get_attribute('aria-valuenow')=='10'
 assert page.locator('.celebration i').count()==14
 page.locator('[data-page="weight"]').click();assert page.locator('.weight-summary b').first.inner_text().startswith('75.5')
 page.locator('[data-page="today"]').click();page.locator('[data-group="בוקר"]').click()
 page.locator('[data-check="0-12"]').click();assert page.get_by_role('progressbar').get_attribute('aria-valuenow')=='0'
 page.locator('[data-check="0-12"]').click();assert page.locator('#quick-weight').input_value()=='75.5'
 page.locator('#weigh-in-form [type=submit]').click()
 first=page.locator('[data-check="0-0"]').bounding_box();target=page.locator('[data-check="0-2"]').bounding_box()
 page.locator('[data-check="0-0"]').dispatch_event('pointerdown',{'pointerId':1,'pointerType':'touch','isPrimary':True,'button':0,'clientX':first['x']+first['width']/2,'clientY':first['y']+first['height']/2})
 page.wait_for_timeout(420);assert page.locator('.drag-ghost').count()==1
 page.locator('.compact-grid').dispatch_event('pointermove',{'pointerId':1,'pointerType':'touch','isPrimary':True,'clientX':target['x']+target['width']/2,'clientY':target['y']+target['height']/2})
 assert 'translate' in page.locator('.drag-ghost').get_attribute('style')
 assert page.locator('.habit-tile:not(.drag-ghost)').evaluate_all('(els)=>els.some(e=>e.getAnimations().length>0)')
 page.locator('.compact-grid').dispatch_event('pointerup',{'pointerId':1,'pointerType':'touch','isPrimary':True})
 page.wait_for_timeout(250);assert page.locator('.drag-ghost').count()==0
 order=page.locator('[data-check]').evaluate_all('(els)=>els.map(e=>e.dataset.check)');assert order[:3]==['0-1','0-2','0-0']
 page.reload();page.locator('[data-group="בוקר"]').click();assert page.locator('[data-check]').evaluate_all('(els)=>els.map(e=>e.dataset.check)')==order
 assert page.locator('[data-check="0-12"]').get_attribute('aria-pressed')=='true'
 for w,h in [(320,568),(375,667),(390,664),(430,740)]:
  page.set_viewport_size({'width':w,'height':h})
  for g in ['בוקר','במהלך היום','ערב']:
   page.locator(f'[data-group="{g}"]').click()
   dims=page.locator('.habit-panel').evaluate('(e)=>[e.scrollHeight,e.clientHeight]');assert dims[0]<=dims[1]+1,(w,h,g,dims)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.emulate_media(reduced_motion='reduce');page.locator('[data-group="בוקר"]').click();page.locator('[data-check="0-1"]').click()
 assert page.locator('.celebration').count()==0
 page.set_viewport_size({'width':390,'height':664});page.screenshot(path='/tmp/warrior-modern.png')
 assert not errors,errors
 b.close()
server.shutdown();print('PASS: morning weight saves measurement and completion, undo/reload, drag ghost and animated reflow, persistent order, colorful reward, reduced motion, four compact phone sizes')
