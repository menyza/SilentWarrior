import test from 'node:test';
import assert from 'node:assert/strict';
import {load} from '../model.js';
import {streaks,reportingStreak} from '../analytics.js';
import {createStretchTimer,toggleStretchTimer,stretchRemaining,restoreStretchTimer,stretchClock} from '../stretch-timer.js';
test('Friday and Saturday preserve Thursday streaks and Sunday continues them; missed weekdays still break streaks',()=>{
 const s=load(null);s.days={'2026-11-04':{'0-0':'done'},'2026-11-05':{'0-0':'done'}};
 for(const date of ['2026-11-06','2026-11-07','2026-11-08'])assert.deepEqual(streaks(s,'0-0',date),{current:2,best:2});
 s.days['2026-11-08']={'0-0':'done'};assert.deepEqual(streaks(s,'0-0','2026-11-08'),{current:3,best:3});assert.equal(reportingStreak(s,'2026-11-08').current,3);
 s.days['2026-11-06']={'0-0':'done'};assert.equal(streaks(s,'0-0','2026-11-08').current,3);
 assert.equal(streaks(s,'0-0','2026-11-10').current,0);
});
test('An unmarked Thursday is not forgiven by a weekend report',()=>{const s=load(null);s.days={'2026-11-04':{'0-0':'done'},'2026-11-06':{'0-0':'done'}};assert.equal(streaks(s,'0-0','2026-11-07').current,0);});
test('Timer uses elapsed clock time, pauses and resumes, restores only for its owner and never goes negative',()=>{
 const t=createStretchTimer('2026-11-06','A',1000);assert.equal(stretchClock(stretchRemaining(t,1000)),'05:00');
 const paused=toggleStretchTimer(t,61000);assert.equal(stretchRemaining(paused,999000),240000);
 const resumed=toggleStretchTimer(paused,999000);assert.equal(stretchClock(stretchRemaining(resumed,1019000)),'03:40');
 assert.deepEqual(restoreStretchTimer(JSON.stringify(resumed),'A'),resumed);assert.equal(restoreStretchTimer(JSON.stringify(resumed),'B'),null);assert.equal(stretchRemaining(resumed,99999999),0);
});
