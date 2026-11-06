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
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':664},timezone_id='Asia/Jerusalem')
  page.clock.install(time=datetime(2026,11,6,9,0,tzinfo=ZoneInfo('Asia/Jerusalem')))
  page.add_init_script('''localStorage.setItem('levelup-onboarding-v1','legacy');window.__tones=[];window.AudioContext=class {constructor(){this.state='running';this.destination={};this.start=Date.now();}get currentTime(){return (Date.now()-this.start)/1000;}resume(){this.state='running';return Promise.resolve();}createOscillator(){const o={frequency:{setValueAtTime(v){o.hz=v;}},connect(){},disconnect(){},start(t){o.at=t;window.__tones.push(o);},stop(t){if(t===undefined)o.cancelled=true;}};return o;}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}};''')
  page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
  page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('[data-group="בוקר"]').click();page.locator('[data-check="0-3"]').click()
  page.wait_for_function('window.__tones.length===10');assert page.locator('#stretch-sound').get_attribute('aria-pressed')=='true'
  assert page.evaluate('window.__tones[0].at')==30
  page.clock.fast_forward(31000);assert 'מקטע 2' in page.locator('#stretch-status').inner_text()
  page.locator('#stretch-pause').click();assert page.evaluate('window.__tones.every(t=>t.cancelled)')
  page.clock.fast_forward(60000);page.locator('#stretch-pause').click();page.wait_for_function('window.__tones.filter(t=>!t.cancelled).length===9')
  assert page.evaluate('Math.round(window.__tones.filter(t=>!t.cancelled)[0].at)')==120
  page.locator('#stretch-sound').click();assert page.locator('#stretch-sound').get_attribute('aria-pressed')=='false';assert page.evaluate('window.__tones.every(t=>t.cancelled)')
  page.locator('#stretch-sound').click();page.wait_for_function('window.__tones.filter(t=>!t.cancelled).length===9')
  page.locator('#stretch-reset').click();page.wait_for_function('window.__tones.filter(t=>!t.cancelled).length===10')
  for w,h in [(320,568),(390,664)]:
   page.set_viewport_size({'width':w,'height':h});assert page.locator('#stretch-dialog').evaluate('(e)=>e.scrollHeight<=e.clientHeight+1'),(w,h)
  page.locator('#stretch-done').click();assert page.evaluate('window.__tones.every(t=>t.cancelled)')
  b.close()
 print('PASS: half-minute audio schedule, pause/resume, mute/unmute, reset, completion cancellation, segment feedback and small-screen fit')
finally:server.shutdown()
