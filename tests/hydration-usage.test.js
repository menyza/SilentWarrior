import test from 'node:test';
import assert from 'node:assert/strict';
import {load,toggle} from '../model.js';
import {addDrink,removeDrink,waterDay,completeWaterHabit} from '../hydration.js';
import {reportingStreak,streaks} from '../analytics.js';
import {emptySnapshot,normalizeSnapshot,mergeSnapshots} from '../account-data.js';
import {waterSeries,completionSeries} from '../trend-charts.js';
import {activeDuration,createUsageTracker} from '../usage.js';
const date='2026-11-01',one='11111111-1111-4111-8111-111111111111',two='22222222-2222-4222-8222-222222222222';
test('water additions derive from habit status, undo cleanly and never double count; coffee contributes',()=>{
 const state=load(null);for(const id of ['0-0','1-0','0-11','2-3'])toggle(state,date,id);
 assert.equal(waterDay(state,date).total,1250);
 toggle(state,date,'0-0');assert.equal(waterDay(state,date).total,1000);toggle(state,date,'0-0');assert.equal(waterDay(state,date).total,1250);
 addDrink(state,date,'coffee',200,100,one);assert.equal(waterDay(state,date).total,1450);removeDrink(state,date,one);assert.equal(waterDay(state,date).total,1250);
 assert.equal(load(JSON.stringify(state)).waterGoal,2000);
});
test('water merges across devices by entry ID, retains deletions and validates account backups',()=>{
 const base=emptySnapshot(),local=structuredClone(base),remote=structuredClone(base);
 addDrink(local.state,date,'water',250,100,one);addDrink(remote.state,date,'water',1000,200,two);remote.state.waterGoal=3000;
 const merged=mergeSnapshots(base,local,remote);assert.deepEqual(merged.conflicts,[]);assert.equal(waterDay(merged.snapshot.state,date).total,1250);assert.equal(merged.snapshot.state.waterGoal,3000);
 const bad=structuredClone(local);bad.state.water[date][one].ml=-1;assert.throws(()=>normalizeSnapshot(bad));
 const changed=structuredClone(merged.snapshot);removeDrink(changed.state,date,one);const deleted=mergeSnapshots(merged.snapshot,changed,merged.snapshot);assert.equal(waterDay(deleted.snapshot.state,date).total,1000);
});
test('reporting streak includes water and weight records, tolerates unfinished today and breaks after a missed day',()=>{
 const state=load(null);state.days['2026-10-30']={'0-0':'done'};state.weights['2026-10-31']=75;
 addDrink(state,date,'water',250,100,one);assert.equal(reportingStreak(state,'2026-11-02').current,3);assert.equal(reportingStreak(state,'2026-11-03').current,0);
 assert.equal(streaks(state,'0-0','2026-11-01').current,0);
 const water=waterSeries(state,'week',date,date);assert.equal(water[0].value,250);
 const progress=completionSeries(state,'2026-10-31','2026-10-31');assert.equal(progress.at(-1).value,null);assert.ok(progress.find(day=>day.date==='2026-10-30').value>0);
});
test('usage counts foreground entries once, pauses background/idle time and never sends another account data',async()=>{
 let mono=0,time=1000000,account={id:'A',token:'tokenA'},calls=[];const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)};let n=0;
 const tracker=createUsageTracker({getAccount:()=>account,storage,send:async(a,sessions)=>{calls.push({owner:a.id,sessions});return {ok:true};},now:()=>mono,wall:()=>time,id:()=>[one,two,'33333333-3333-4333-8333-333333333333'][n++]});
 await tracker.flush();assert.equal(calls[0].sessions.length,1);
 mono+=15000;time+=15000;tracker.tick();await tracker.flush();assert.equal(calls.at(-1).sessions[0].activeMs,15000);
 tracker.visibility(false);mono+=60000;time+=60000;tracker.tick();await tracker.flush();assert.equal(calls.at(-1).sessions[0].activeMs,15000);
 tracker.visibility(true);await tracker.flush();assert.equal(calls.at(-1).sessions[0].id,two);
 account={id:'B',token:'tokenB'};tracker.tick();await tracker.flush();assert.equal(calls.at(-1).owner,'B');assert.equal(calls.at(-1).sessions[0].activeMs,0);
 assert.equal(activeDuration(120000,0,135000,true),0);assert.equal(activeDuration(0,0,15000,false),0);
});

test('Daily water habit completes at the target from drinks or automatic contributions without adding water',()=>{
 const state=load(null);state.waterGoal=500;
 addDrink(state,date,'coffee',200,1,one);assert.notEqual(state.days[date]?.['1-6'],'done');
 state.days[date]??={};state.days[date]['0-0']='done';assert.equal(completeWaterHabit(state,date),false);
 addDrink(state,date,'water',50,2,two);assert.equal(state.days[date]['1-6'],'done');assert.equal(waterDay(state,date).total,500);assert.equal(completeWaterHabit(state,date),false);
 const automatic=load(null);automatic.waterGoal=500;automatic.days[date]={'1-0':'done'};assert.equal(completeWaterHabit(automatic,date),true);assert.equal(waterDay(automatic,date).total,500);
 const archived=load(null);archived.removedHabits.push('1-6');archived.waterGoal=500;archived.days[date]={'1-0':'done'};assert.equal(completeWaterHabit(archived,date),false);
});
