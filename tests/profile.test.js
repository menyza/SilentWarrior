import test from 'node:test';
import assert from 'node:assert/strict';
import {profileEstimate,cleanProfile,validProfile,currentProfileWeight,syncProfileWaterGoal} from '../profile.js';
import {emptySnapshot,normalizeSnapshot,meaningful,mergeSnapshots} from '../account-data.js';
const profile={sex:'male',weightKg:70,heightCm:175,completedAt:Date.parse('2026-11-02T10:00Z')};
test('BMI is separate from a bounded weight-based water estimate',()=>{
 assert.deepEqual(profileEstimate(70,175),{bmi:22.9,waterMl:2100});assert.equal(profileEstimate(70,160).waterMl,2100);
 assert.equal(profileEstimate(20,180).waterMl,1500);assert.equal(profileEstimate(200,180).waterMl,3000);assert.equal(profileEstimate(70,0),null);
});
test('Profile is validated, backed up and treated as meaningful data',()=>{
 assert.equal(validProfile(profile),true);assert.equal(cleanProfile({...profile,heightCm:NaN}),null);
 const snapshot=emptySnapshot();assert.equal(meaningful(snapshot),false);snapshot.state.profile=profile;snapshot.state.waterGoal=2200;
 assert.equal(meaningful(snapshot),true);assert.deepEqual(normalizeSnapshot(snapshot).state.profile,profile);
 const invalid=structuredClone(snapshot);invalid.state.profile.weightKg='70';assert.throws(()=>normalizeSnapshot(invalid));
});
test('Independent edits of an existing profile merge across devices',()=>{
 const base=emptySnapshot();base.state.profile=profile;const local=structuredClone(base),remote=structuredClone(base);local.state.profile.heightCm=180;remote.state.profile.weightKg=72;
 const merged=mergeSnapshots(base,local,remote);assert.equal(merged.conflicts.length,0);assert.equal(merged.snapshot.state.profile.heightCm,180);assert.equal(merged.snapshot.state.profile.weightKg,72);
});

test('Latest dated weight reports drive current metrics and auto water goals without rewriting manual targets',()=>{
 const state=emptySnapshot().state;state.profile={...profile,creatine:true,waterGoalMode:'auto'};state.weights={'2026-11-01':72,'2026-11-02':80,'2026-11-03':90};
 assert.deepEqual(currentProfileWeight(state,'2026-11-02'),{weightKg:80,date:'2026-11-02'});assert.equal(syncProfileWaterGoal(state,'2026-11-02'),true);assert.equal(state.waterGoal,2700);
 state.weights['2026-10-31']=65;assert.equal(currentProfileWeight(state,'2026-11-02').weightKg,80);
 delete state.weights['2026-11-02'];assert.equal(currentProfileWeight(state,'2026-11-02').weightKg,72);syncProfileWaterGoal(state,'2026-11-02');assert.equal(state.waterGoal,2500);
 state.profile.waterGoalMode='manual';state.waterGoal=2600;state.weights['2026-11-02']=75;assert.equal(syncProfileWaterGoal(state,'2026-11-02'),false);assert.equal(state.waterGoal,2600);
});
test('Creatine preference is persisted and validated as a personal 300 ml addition rather than a medical requirement',()=>{
 const state=emptySnapshot();state.state.profile={...profile,creatine:true,waterGoalMode:'auto'};
 assert.equal(normalizeSnapshot(state).state.profile.creatine,true);assert.equal(profileEstimate(70,175).waterMl,2100);assert.equal(profileEstimate(70,175,{creatine:true}).waterMl,2400);
 state.state.profile.creatine='yes';assert.throws(()=>normalizeSnapshot(state));
});

test('Personal creatine addition is applied once and removed when unchecked',()=>{
 const state=emptySnapshot().state;state.profile={...profile,creatine:true,waterGoalMode:'auto'};
 syncProfileWaterGoal(state,'2026-11-02');assert.equal(state.waterGoal,2400);assert.equal(syncProfileWaterGoal(state,'2026-11-02'),false);assert.equal(state.waterGoal,2400);
 state.profile.creatine=false;syncProfileWaterGoal(state,'2026-11-02');assert.equal(state.waterGoal,2100);
});
