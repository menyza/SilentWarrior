import test from 'node:test';
import assert from 'node:assert/strict';
import {profileEstimate,cleanProfile,validProfile} from '../profile.js';
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
