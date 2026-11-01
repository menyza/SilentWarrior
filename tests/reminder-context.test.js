import test from 'node:test';
import assert from 'node:assert/strict';
import {reminderSettings} from '../reminder-settings.js';
import {dueReminders} from '../notifications/src/core.js';
import {reminderMessage} from '../notifications/src/reminder-context.js';
import {emptySnapshot,normalizeSnapshot} from '../account-data.js';
import {addDrink} from '../hydration.js';
const water={id:'water1',kind:'water',intervalMinutes:60},prefs={timeZone:'Asia/Jerusalem',reminders:[water]};
test('water reminders run on local 09:00-23:00 interval slots, never overnight and follow daylight saving',()=>{
 assert.equal(dueReminders(prefs,new Date('2026-11-01T06:59:00Z')).length,0);
 assert.equal(dueReminders(prefs,new Date('2026-11-01T07:00:00Z'))[0].slot,'09:00');
 assert.equal(dueReminders(prefs,new Date('2026-11-01T07:05:00Z'))[0].slot,'09:00');
 assert.equal(dueReminders(prefs,new Date('2026-11-01T07:10:00Z')).length,0);
 assert.equal(dueReminders(prefs,new Date('2026-11-01T08:00:00Z'))[0].slot,'10:00');
 assert.equal(dueReminders(prefs,new Date('2026-11-01T21:00:00Z'))[0].slot,'23:00');
 for(const instant of ['2026-11-01T21:01:00Z','2026-11-01T22:00:00Z','2026-11-02T04:00:00Z'])assert.equal(dueReminders(prefs,new Date(instant)).length,0);
 assert.equal(dueReminders(prefs,new Date('2026-07-01T06:00:00Z'))[0].slot,'09:00');
 const other={...prefs,reminders:[{...water,intervalMinutes:90}]};assert.equal(dueReminders(other,new Date('2026-11-01T08:30:00Z'))[0].slot,'10:30');
});
test('habit reminders skip done/rest/archived or unknown habits, while water runs until the fluid goal',()=>{
 const state=emptySnapshot().state,date='2026-11-01',habit={id:'read',kind:'habit',habitId:'1-1',time:'12:00',topic:'קריאה',date};
 assert.ok(reminderMessage(habit,state));state.days[date]={'1-1':'done','1-6':'done'};assert.equal(reminderMessage(habit,state),null);
 assert.ok(reminderMessage({...water,date},state)); // A completed water habit does not end periodic drinking reminders.
 addDrink(state,date,'coffee',2000,100,'11111111-1111-4111-8111-111111111111');assert.equal(reminderMessage({...water,date},state),null);
 state.days[date]['1-1']=null;state.removedHabits.push('1-1');assert.equal(reminderMessage(habit,state),null);assert.equal(reminderMessage({...habit,habitId:'2-99'},state),null);assert.equal(reminderMessage(habit,null),null);
});
test('contextual reminder preferences survive backups and reject duplicate water schedules and invalid intervals',()=>{
 const snapshot=emptySnapshot();snapshot.reminders={...prefs,reminders:[water,{id:'read',kind:'habit',habitId:'1-1',time:'20:00',topic:'קריאה'}]};
 const saved=normalizeSnapshot(snapshot);assert.equal(saved.reminders.reminders[0].intervalMinutes,60);assert.equal(saved.reminders.reminders[1].habitId,'1-1');
 for(const intervalMinutes of [0,10,841,60.5])assert.throws(()=>reminderSettings({...prefs,reminders:[{...water,intervalMinutes}]}));
 assert.throws(()=>reminderSettings({...prefs,reminders:[water,{...water,id:'water2'}]}));
});
