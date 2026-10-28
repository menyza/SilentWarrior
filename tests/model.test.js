import test from 'node:test';
import assert from 'node:assert/strict';
import {habits,load,toggle,completed,dayKey} from '../model.js';
test('all spreadsheet habits have unique IDs, including supplements twice',()=>{assert.equal(habits.length,29);assert.equal(new Set(habits.map(h=>h.id)).size,29);assert.equal(habits.filter(h=>h.name==='לקחת תוספי תזונה').length,2);});
test('mark, undo, reload, and separate dates',()=>{let s=load(null);toggle(s,'2026-10-28','0-0');assert.equal(completed(s,'2026-10-28'),1);assert.equal(completed(s,'2026-10-29'),0);s=load(JSON.stringify(s));assert.equal(completed(s,'2026-10-28'),1);toggle(s,'2026-10-28','0-0');assert.equal(completed(s,'2026-10-28'),0);});
test('rest and training count once, not twice',()=>{const s=load(null);toggle(s,'today','1-2','rest');assert.equal(completed(s,'today'),1);toggle(s,'today','1-2');assert.equal(completed(s,'today'),1);assert.equal(s.days.today['1-2'],'done');});
test('invalid saved JSON recovers and date keys use local calendar',()=>{assert.equal(load('oops').anchors.length,3);assert.equal(dayKey(new Date(2026,0,2)), '2026-01-02');});
