import test from 'node:test';
import assert from 'node:assert/strict';
import {load,workoutTypes,dailyScore} from '../model.js';
import {emptySnapshot,normalizeSnapshot,mergeSnapshots} from '../account-data.js';
import {reminderSettings} from '../reminder-settings.js';
test('custom reminder schedules and workout selections survive account normalization and independent device merges',()=>{
 const base=emptySnapshot(),local=structuredClone(base),remote=structuredClone(base),date='2026-11-01';
 local.state.days[date]={'1-2':'done'};local.state.workouts[date]=workoutTypes[0];
 remote.reminders={timeZone:'Asia/Jerusalem',reminders:Array.from({length:5},(_,i)=>({id:'r'+i,kind:'custom',topic:'אימון '+i,time:'12:00',days:[1,3]}))};
 const merged=mergeSnapshots(base,local,remote);
 assert.equal(merged.conflicts.length,0);assert.equal(merged.snapshot.state.workouts[date],'טניס');
 assert.equal(dailyScore(merged.snapshot.state,date),25);assert.equal(merged.snapshot.reminders.reminders.length,5);
 assert.equal(load(JSON.stringify(merged.snapshot.state)).workouts[date],'טניס');
 const invalid=structuredClone(local);invalid.state.workouts[date]='unknown';assert.throws(()=>normalizeSnapshot(invalid));
 assert.throws(()=>reminderSettings({...remote.reminders,reminders:Array(21).fill(remote.reminders.reminders[0])}));
});

test('legacy weekday settings are validated and normalized into daily reminders',()=>{
 const r={id:'tennis',kind:'custom',topic:'טניס',time:'18:00'},prefs={timeZone:'Asia/Jerusalem',reminders:[r]};
 for(const days of [[],[1,1],[7],[-1],['1']])assert.throws(()=>reminderSettings({...prefs,reminders:[{...r,days}]}));
 assert.equal(reminderSettings({...prefs,reminders:[{...r,days:[3,1]}]}).reminders[0].days,undefined);
});
