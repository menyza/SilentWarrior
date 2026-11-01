"""Weekly feedback, day editing and native XLSX download; requires Playwright/openpyxl."""
from playwright.sync_api import sync_playwright
from http.server import ThreadingHTTPServer,SimpleHTTPRequestHandler
from functools import partial
from pathlib import Path
from datetime import datetime
from zoneinfo import ZoneInfo
from openpyxl import load_workbook
import threading,json,zipfile
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(Path(__file__).resolve().parents[1])))
threading.Thread(target=server.serve_forever,daemon=True).start()
fixture={'habitConfigVersion':1,'removedHabits':['0-1'],'weeklyWorkoutGoal':4,'days':{'2026-10-25':{'0-0':'done'},'2026-11-01':{'0-0':'done','1-2':'done'},'2026-11-02':{'0-0':'done','1-2':'rest'},'2026-11-03':{'0-0':'done','1-2':'done'}},'workouts':{'2026-11-01':'טניס','2026-11-03':'חדר כושר'},'weights':{'2026-11-03':75.5},'reflections':{'2026-11-02':'busy'},'habitOverrides':{'0-2':{'name':'=SUM(1,2) & <בדיקה>','group':'בוקר','importance':1,'effort':1}}}
with sync_playwright() as p:
 browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=browser.new_page(viewport={'width':390,'height':744},timezone_id='Asia/Jerusalem',accept_downloads=True)
 page.clock.install(time=datetime(2026,11,4,12,0,tzinfo=ZoneInfo('Asia/Jerusalem')))
 errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://silentwarrior.menyzakar142.workers.dev/**',lambda r:r.fulfill(status=200,content_type='application/json',body='{"providers":[]}'))
 page.add_init_script("if(!localStorage.getItem('silent-warrior-v1'))localStorage.setItem('silent-warrior-v1',"+json.dumps(json.dumps(fixture,ensure_ascii=False))+ ");sessionStorage.setItem('silent-warrior-selected-day','2026-11-01');localStorage.setItem('silent-warrior-reminder-preferences',JSON.stringify({timeZone:'Asia/Jerusalem',reminders:[{id:'r1',kind:'custom',topic:'קריאה',time:'20:00',days:[1,3]}]}))")
 page.goto(f'http://127.0.0.1:{server.server_port}');page.locator('[data-page="history"]').click()
 assert page.get_by_role('heading',name='השבוע שלי',exact=True).is_visible()
 assert page.locator('.review-stats b').nth(0).inner_text()=='3'
 assert '2' in page.locator('.review-stats b').nth(2).inner_text()
 assert page.locator('.review-day').count()==7
 assert not page.locator('.review-table').get_attribute('open')
 assert 'כוס מים' in page.locator('.insight-positive').inner_text()
 page.locator('[data-report-day="2026-11-02"]').first.click();assert page.locator('#back-report').is_visible()
 page.locator('#back-report').click();page.locator('[data-review-habit]').click()
 assert page.locator('.selected-day time').get_attribute('datetime')=='2026-11-04'
 page.locator('[data-page="history"]').click();page.locator('[data-shift="-1"]').click()
 assert page.locator('.review-stats b').first.inner_text()=='1'
 page.locator('[data-shift="1"]').click();page.locator('[data-period="month"]').click();assert page.get_by_role('heading',name='החודש שלי',exact=True).is_visible()
 page.locator('[data-period="week"]').click()
 with page.expect_download() as event:page.locator('#export-excel').click()
 download=event.value;assert download.suggested_filename=='silent-warrior-2026-11-04.xlsx'
 path=download.path();archive=zipfile.ZipFile(path);assert archive.testzip() is None
 with open(path,'rb') as stream:workbook=load_workbook(stream)
 assert workbook.sheetnames==['סיכום יומי','יומן הרגלים','הגדרות הרגלים','תזכורות','שתייה','מידע']
 summary=list(workbook['סיכום יומי'].values);daily=next(row for row in summary if row[0]=='2026-11-03')
 assert daily[5]==75.5 and daily[7]=='חדר כושר'
 assert next(row for row in summary if row[0]=='2026-11-01')[7]=='טניס'
 assert next(row for row in summary if row[0]=='2026-11-02')[6]=='מנוחה מתוכננת'
 assert workbook['סיכום יומי'].sheet_view.rightToLeft and workbook['סיכום יומי'].freeze_panes=='A2'
 assert any(cell.value=='=SUM(1,2) & <בדיקה>' and cell.data_type=='s' for row in workbook['הגדרות הרגלים'] for cell in row)
 assert not any(cell.data_type=='f' for sheet in workbook for row in sheet for cell in row)
 assert list(workbook['תזכורות'].values)[1][:3]==('קריאה','20:00','Asia/Jerusalem')
 for mode in ['light','dark']:
  page.emulate_media(color_scheme=mode)
  for width in [320,390,430]:
   page.set_viewport_size({'width':width,'height':744});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
  page.set_viewport_size({'width':390,'height':744});page.locator('.review-scroll').evaluate('(e)=>e.scrollTo(0,0)');page.screenshot(path=f'/tmp/warrior-review-{mode}.png')
 page.clock.set_system_time(datetime(2026,11,8,0,5,tzinfo=ZoneInfo('Asia/Jerusalem')));page.evaluate("document.dispatchEvent(new Event('visibilitychange'))")
 assert page.locator('.review-day').first.get_attribute('data-report-day')=='2026-11-08'
 assert page.locator('.review-stats b').first.inner_text()=='0'
 assert not errors,errors
 browser.close()
server.shutdown();print('PASS: weekly summary, honest missing-data feedback, day editing, next-step navigation, week/month paging, native XLSX with workout types and safe text cells, light/dark mobile widths')
