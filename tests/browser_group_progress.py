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
 for id,points in [('0-2',5),('0-0',10),('0-6',15),('0-10',20)]:
  assert f'points-{points}' in page.locator(f'[data-habit-id="{id}"]').get_attribute('class')
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
 page.locator('[data-group="במהלך היום"]').click();assert 'points-25' in page.locator('[data-habit-id="1-2"]').get_attribute('class')
 page.locator('[data-info="1-2"]').click();page.locator('#detail-rest').click();assert 'points-10' in page.locator('[data-habit-id="1-2"]').get_attribute('class')
 page.locator('[data-group="בוקר"]').click()
 apple=page.locator('link[rel="apple-touch-icon"]');assert apple.get_attribute('href')=='apple-touch-icon-v3.png';assert apple.get_attribute('sizes')=='180x180';assert page.request.get(url+apple.get_attribute('href')).status==200
 for asset,size in [('apple-touch-icon-v3.png',180),('icon-192-v3.png',192),('icon-512-v3.png',512)]:
  sample=page.evaluate("""async ({src})=>{const img=new Image();img.src=src;await img.decode();const c=document.createElement('canvas');c.width=img.naturalWidth;c.height=img.naturalHeight;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return {width:c.width,height:c.height,pixel:[...ctx.getImageData(Math.round(c.width*.5),Math.round(c.height*.418),1,1).data]}}""",{'src':url+asset})
  assert sample['width']==size and sample['height']==size
  assert sample['pixel'][0]>220 and sample['pixel'][1]>150, 'Icon must contain the centered sun rather than a cropped corner'

 for w,h in [(320,568),(390,664),(430,740)]:
  page.set_viewport_size({'width':w,'height':h})
  assert page.locator('.score-ring').bounding_box()['height']<=46
  assert page.locator('.habit-panel').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.set_viewport_size({'width':390,'height':664});page.screenshot(path='/tmp/warrior-group-gauge.png')
 assert not errors,errors
 b.close()
server.shutdown();print('PASS: app icon assets, compact title-row gauge, morning reaches 100% independently, evening starts at zero, daily score preserved, point-based colors, reload and mobile layouts')
