import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../model.js';
import {reviewData} from '../progress-view.js';
import {exportSheets,excelWorkbook} from '../excel-export.js';
test('weekly review counts actual records, excludes rest from workouts and compares matching weekdays',()=>{
 const state=load(null);state.days={'2026-10-25':{'0-0':'done'},'2026-11-01':{'0-0':'done','1-2':'done'},'2026-11-02':{'0-0':'done','1-2':'rest'},'2026-11-03':{'0-0':'done'},'2026-11-05':{'0-0':'done'}};
 const data=reviewData(state,'week','2026-11-04','2026-11-04');
 assert.equal(data.tracked.length,3);assert.equal(data.workouts,1);assert.equal(data.actions,5);assert.equal(data.improved.id,'0-0');assert.equal(data.improved.previousCount,1);
 assert.ok(data.needsAttention);assert.equal(data.next.id,data.needsAttention.id);
 const empty=reviewData(load(null),'week','2026-11-04','2026-11-04');assert.equal(empty.strongest,null);assert.equal(empty.needsAttention,null);assert.equal(empty.improved,null);
});
test('monthly comparisons use equal elapsed day counts and handle shorter previous months',()=>{
 const state=load(null);state.days={'2026-02-02':{'0-0':'done'},'2026-03-30':{'0-0':'done'},'2026-03-31':{'0-0':'done'}};
 const data=reviewData(state,'month','2026-03-31','2026-03-31');assert.equal(data.previousTracked.length,1);assert.equal(data.rows.find(h=>h.id==='0-0').comparisonCount,0);assert.equal(data.improved,null);
});
test('Excel export includes workout types, weights, archived records and reminders without treating unmarked habits as failures',()=>{
 const state=load(null);state.days={'2026-11-01':{'0-1':'done','1-2':'done'},'2026-11-02':{'1-2':'rest'}};state.workouts={'2026-11-01':'טניס'};state.weights={'2026-11-01':75.5};state.reflections={'2026-11-01':'busy'};
 const reminders={timeZone:'Asia/Jerusalem',reminders:[{id:'r1',kind:'custom',topic:'קריאה',time:'20:00',days:[1,3]}]};
 const sheets=exportSheets(state,reminders,'2026-11-02');assert.equal(sheets[0].rows[1][5],75.5);assert.equal(sheets[0].rows[1][7],'טניס');assert.equal(sheets[0].rows[2][6],'מנוחה מתוכננת');
 const journal=sheets.find(sheet=>sheet.name==='יומן הרגלים').rows;assert.ok(journal.some(row=>row[1]==='0-1'&&row[4]==='בוצע'&&row[7]==='כן'));assert.ok(journal.some(row=>row[4]==='לא סומן'));
 assert.deepEqual(sheets[3].rows[1],['קריאה','20:00','שני, רביעי','Asia/Jerusalem']);
 const before=structuredClone(state),bytes=excelWorkbook(state,reminders,'2026-11-02');assert.deepEqual(state,before);assert.equal(new DataView(bytes.buffer).getUint32(0,true),0x04034b50);
 assert.equal(exportSheets(load(null),null,'2026-11-02')[0].rows.length,1);
});
