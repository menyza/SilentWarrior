"""Settings, theme changes, exact weight comparisons and interactive chart editing."""
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from datetime import date,timedelta
import threading,json
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])))
threading.Thread(target=server.serve_forever,daemon=True).start()
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':744},is_mobile=True,has_touch=True)
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
 page.add_init_script('''if(!localStorage.getItem('silent-warrior-v1')){const day=(n)=>{const d=new Date();d.setDate(d.getDate()-n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')};localStorage.setItem('silent-warrior-v1',JSON.stringify({habitConfigVersion:1,weights:{[day(0)]:75.2,[day(1)]:75.5,[day(7)]:76,[day(40)]:77},days:{[day(0)]:{'0-0':'done'}}}));}''')
 page.goto(f'http://127.0.0.1:{server.server_port}')
 assert page.locator('nav button').count()==4
 page.locator('[data-page="settings"]').click()
 page.locator('[data-page="appearance"]').click()
 page.locator('button[data-theme="dark"]').click();assert page.locator('html').get_attribute('data-theme')=='dark'
 page.reload();assert page.locator('html').get_attribute('data-theme')=='dark'
 page.locator('[data-page="settings"]').click();page.locator('[data-page="appearance"]').click()
 page.locator('button[data-theme="light"]').click();assert page.locator('html').get_attribute('data-theme')=='light'
 page.emulate_media(color_scheme='dark');assert page.locator('html').get_attribute('data-theme')=='light'
 page.locator('button[data-theme="auto"]').click();assert page.locator('html').get_attribute('data-theme')=='dark'
 page.emulate_media(color_scheme='light');page.wait_for_function("document.documentElement.dataset.theme==='light'")
 page.locator('[data-page="habits"]').click();page.locator('.manage-group summary').first.click()
 page.locator('[data-edit-habit="0-0"]').click();page.locator('#edit-habit-name').fill('מים לפני השינה')
 page.locator('#edit-habit-group').select_option(label='ערב');page.locator('#edit-importance').select_option('3');page.locator('#edit-effort').select_option('2')
 assert '20' in page.locator('#edit-habit-form output').inner_text()
 page.locator('#edit-habit-form [type=submit]').click()
 page.locator('[data-page="today"]').click();page.locator('[data-group="ערב"]').click()
 assert page.locator('[data-check="0-0"]').get_attribute('aria-pressed')=='true'
 assert page.locator('[data-check="0-0"] strong').inner_text()=='מים לפני השינה'
 assert page.locator('[data-check="0-0"] .habit-points').inner_text().strip().endswith('20 נק׳')
 page.reload();page.locator('[data-group="ערב"]').click();assert page.locator('[data-check="0-0"]').count()==1
 page.locator('[data-page="weight"]').click();assert page.locator('.weight-summary b').first.inner_text().startswith('75.2')
 assert page.locator('[data-weight-daily]').inner_text()=='-0.3';assert page.locator('[data-weight-weekly]').inner_text()=='-0.8'
 assert page.locator('.weight-chart a').count()==2
 page.locator('[data-weight-period="month"]').click();assert page.locator('.weight-chart a').count()==3
 page.locator('[data-weight-period="year"]').click();assert page.locator('.weight-chart a').count()==4
 page.locator('.weight-chart a').first.click();assert page.locator('#weight-value').input_value()=='77'
 page.locator('#weight-value').fill('77.3');page.locator('#weight-form [type=submit]').click()
 assert '77.3' in page.locator('.weight-chart a').first.get_attribute('aria-label')
 page.locator('.weight-history summary').click();page.locator('[data-edit-weight]').last.click()
 assert page.locator('#weight-value').input_value()=='77.3'
 page.locator('[data-new-weight]').click();page.locator('#weight-value').fill('75.1');page.locator('#weight-form [type=submit]').click()
 assert page.locator('[data-weight-daily]').inner_text()=='-0.4'
 # The new settings retain access to registration and notification controls.
 page.locator('[data-page="settings"]').click();page.locator('[data-page="account"]').click();assert page.locator('#account-register').count()==1
 page.locator('[data-page="notifications"]').click();assert page.locator('#push-form').count()==1
 for mode in ['light','dark']:
  page.locator('[data-page="appearance"]').click();page.locator(f'button[data-theme="{mode}"]').click()
  page.locator('[data-page="weight"]').click()
  for width in [320,390,430]:
   page.set_viewport_size({'width':width,'height':744});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.set_viewport_size({'width':390,'height':744});page.screenshot(path=f'/tmp/warrior-weight-{mode}.png')
  page.locator('[data-page="settings"]').click();page.locator('[data-page="appearance"]').click();page.screenshot(path=f'/tmp/warrior-settings-{mode}.png')
 assert not errors,errors
 browser.close()
server.shutdown();print('PASS: settings navigation, habit editing persistence, light/dark/automatic, exact deltas, chart periods, chart/table editing and phone widths')
