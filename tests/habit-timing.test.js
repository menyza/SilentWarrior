import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../model.js';
import {recordHabitChanges,habitTiming,adaptiveSettings,localTimingParts} from '../habit-timing.js';
import {emptySnapshot,normalizeSnapshot,mergeSnapshots} from '../account-data.js';
import {reminderSettings} from '../reminder-settings.js';
import {reminderMessage} from '../notifications/src/reminder-context.js';
const zone='Asia/Jerusalem',now=new Date('2026-11-02T08:00:00Z');
function history(){const s=load(null);for(let n=26;n<=30;n++){const date=`2026-10-${n}`;s.days[date]={'1-1':'done'};s.habitTimes[date]={'1-1':Date.parse(date+'T10:00:00+02:00')};}return s;}
test('Live marking records a timestamp, undo leaves a tombstone, historical edits do not invent a time',()=>{
 const s=load(null),before=structuredClone(s);s.days['2026-11-02']={'1-1':'done'};recordHabitChanges(s,before,'2026-11-02',now.getTime());assert.equal(s.habitTimes['2026-11-02']['1-1'],now.getTime());
 const marked=structuredClone(s);s.days['2026-11-02']['1-1']=null;recordHabitChanges(s,marked,'2026-11-02',now.getTime());assert.equal(s.habitTimes['2026-11-02']['1-1'],null);
 s.days['2026-10-31']={'1-1':'done'};recordHabitChanges(s,marked,'2026-11-02');assert.equal(s.habitTimes['2026-10-31'],undefined);
});
test('Learning uses five prior marked days, local timezone and stable recent median; falls back on sparse or inconsistent data',()=>{
 const s=history(),prefs={timeZone:zone,reminders:[{id:'read',kind:'habit',habitId:'1-1',topic:'קריאה',adaptive:true,time:'18:00'}]};
 assert.deepEqual(habitTiming(s,'1-1',zone,now),{count:5,ready:true,usual:'10:00',time:'10:30'});
 assert.equal(adaptiveSettings(prefs,s,now).reminders[0].time,'10:30');
 s.days['2026-10-30']['1-1']=null;assert.equal(adaptiveSettings(prefs,s,now).reminders[0].time,'18:00');
 const unstable=history();[1,6,12,18,22].forEach((hour,i)=>{const date=`2026-10-${26+i}`;unstable.habitTimes[date]['1-1']=Date.parse(date+`T${String(hour).padStart(2,'0')}:00:00+02:00`);});assert.equal(habitTiming(unstable,'1-1',zone,now).ready,false);
});
test('Learning respects DST and ignores mismatched, future, current-day and old records',()=>{
 const s=load(null);for(let n=21;n<=25;n++){const date=`2026-10-${n}`;s.days[date]={'1-1':'done'};s.habitTimes[date]={'1-1':Date.parse(date+'T10:00:00'+(n<25?'+03:00':'+02:00'))};}
 assert.equal(habitTiming(s,'1-1',zone,now).usual,'10:00');assert.equal(localTimingParts(new Date('2026-10-24T07:00:00Z'),zone).minute,600);
 s.days['2026-11-02']={'1-1':'done'};s.habitTimes['2026-11-02']={'1-1':now.getTime()};s.days['2026-01-01']={'1-1':'done'};s.habitTimes['2026-01-01']={'1-1':Date.parse('2026-01-01T01:00Z')};assert.equal(habitTiming(s,'1-1',zone,now).count,5);
 s.habitTimes['2026-10-21']['1-1']=Date.parse('2026-10-22T10:00:00+03:00');assert.equal(habitTiming(s,'1-1',zone,now).ready,false);
});
test('Snapshots validate, preserve and merge marking times and adaptive settings',()=>{
 const base=emptySnapshot(),local=structuredClone(base),remote=structuredClone(base);local.state.habitTimes['2026-11-01']={'1-1':now.getTime()-86400000};remote.state.habitTimes['2026-11-01']={'0-0':now.getTime()-86400000};
 const merged=mergeSnapshots(base,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(Object.keys(merged.snapshot.state.habitTimes['2026-11-01']).length,2);
 const invalid=structuredClone(local);invalid.state.habitTimes['2026-11-01']['1-1']='bad';assert.throws(()=>normalizeSnapshot(invalid));
 const prefs={timeZone:zone,reminders:[{id:'read',kind:'habit',habitId:'1-1',topic:'קריאה',time:'18:00',adaptive:true}]};assert.equal(reminderSettings(prefs).reminders[0].adaptive,true);prefs.reminders[0].adaptive='yes';assert.throws(()=>reminderSettings(prefs));
});
test('Habit reminder wording varies across days and still suppresses completed habits',()=>{
 const s=load(null),bodies=new Set();for(let n=1;n<=5;n++)bodies.add(reminderMessage({id:'read',kind:'habit',habitId:'1-1',date:`2026-11-0${n}`},s).body);assert.equal(bodies.size,5);
 s.days['2026-11-01']={'1-1':'done'};assert.equal(reminderMessage({kind:'habit',habitId:'1-1',date:'2026-11-01'},s),null);
});
