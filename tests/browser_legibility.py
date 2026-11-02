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
  page=browser.new_page(viewport={'width':390,'height':780},device_scale_factor=2)
  page.add_init_script("localStorage.setItem('levelup-onboarding-v1','legacy')")  # Existing-user regression fixture.
  page.goto(f'http://127.0.0.1:{server.server_port}');page.evaluate('document.fonts.ready');page.emulate_media(reduced_motion='reduce')
  assert 'LevelUp' in page.locator('.brand').inner_text()
  assert 'למסע' in page.locator('.today-title h1').inner_text()
  page.locator('[data-group="בוקר"]').click();page.locator('[data-check="0-0"]').click()
  for w,h in [(320,568),(390,664),(390,780),(430,932)]:
   page.set_viewport_size({'width':w,'height':h})
   for group in ['בוקר','במהלך היום','ערב']:
    page.locator(f'[data-group="{group}"]').click()
    issues=page.locator('.habit-tile').evaluate_all('''els=>els.flatMap(el=>{
     const r=el.getBoundingClientRect(),name=el.querySelector('strong'),points=el.querySelector('.habit-points');
     const n=name.getBoundingClientRect(),p=points.getBoundingClientRect();
     return n.top<r.top||n.bottom>r.bottom+1||p.bottom>r.bottom+1||(!(n.right<=p.left||p.right<=n.left||n.bottom<=p.top||p.bottom<=n.top))||name.scrollHeight>name.clientHeight+1 ? [el.dataset.habitId] : [];
    })''')
    assert not issues,(w,h,group,issues)
    assert page.locator('.habit-panel').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1'),(w,h,group)
  page.set_viewport_size({'width':390,'height':780});page.locator('[data-group="בוקר"]').click()
  page.screenshot(path='/workspace/scratch/levelup-readable.png')
  browser.close()
 print('PASS: LevelUp branding and journey title; all habit labels and points fit without overlap or scrolling on four mobile sizes')
finally:server.shutdown()
