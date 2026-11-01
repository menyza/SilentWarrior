import test from 'node:test';
import assert from 'node:assert/strict';
import {load,dailyProgress,groupProgress} from '../model.js';
import {weeklyWorkoutProgress} from '../analytics.js';
import {emptySnapshot,normalizeSnapshot,mergeSnapshots,meaningful} from '../account-data.js';
test('daily and day-part progress differ; archived habits do not inflate the daily denominator',()=>{
 const s=load(null);s.days['2026-11-04']={'0-0':'done','0-1':'done','1-2':'rest'};
 const daily=dailyProgress(s,'2026-11-04');assert.equal(daily.done,2);assert.equal(daily.total,29);
 assert.equal(groupProgress(s,'2026-11-04','בוקר').done,1);assert.equal(dailyProgress(s,'2026-11-05').done,0);
});
test('weekly workout goal resets on Sunday, excludes rest/future dates and retains history',()=>{
 const s=load(null);s.days={'2026-10-31':{'1-2':'done'},'2026-11-01':{'1-2':'done'},'2026-11-02':{'1-2':'rest'},'2026-11-03':{'1-2':'done'},'2026-11-05':{'1-2':'done'}};
 assert.deepEqual(weeklyWorkoutProgress(s,'2026-11-04'),{done:2,total:3,percent:67,start:'2026-11-01',end:'2026-11-07'});
 s.weeklyWorkoutGoal=4;assert.equal(weeklyWorkoutProgress(s,'2026-11-04').percent,50);
 assert.equal(weeklyWorkoutProgress(s,'2026-11-08').done,0);assert.equal(s.days['2026-11-01']['1-2'],'done');
 s.weeklyWorkoutGoal=1;assert.equal(weeklyWorkoutProgress(s,'2026-11-04').percent,100);
});
test('weekly workout targets migrate safely and survive account merge/backup',()=>{
 assert.equal(load(null).weeklyWorkoutGoal,3);assert.equal(load('{}').weeklyWorkoutGoal,3);
 const base=emptySnapshot(),local=structuredClone(base),remote=structuredClone(base);local.state.weeklyWorkoutGoal=5;remote.state.days['2026-11-04']={'0-0':'done'};
 const result=mergeSnapshots(base,local,remote);assert.equal(result.conflicts.length,0);assert.equal(result.snapshot.state.weeklyWorkoutGoal,5);
 assert.ok(meaningful(local));for(const value of [0,8,2.5,'3']){const bad=structuredClone(base);bad.state.weeklyWorkoutGoal=value;assert.throws(()=>normalizeSnapshot(bad));}
 const legacy=structuredClone(base);delete legacy.state.weeklyWorkoutGoal;assert.equal(normalizeSnapshot(legacy).state.weeklyWorkoutGoal,3);
});
