import test from 'node:test';
import assert from 'node:assert/strict';
import {load,workoutTypes,availableWorkoutTypes,cleanCustomWorkoutTypes} from '../model.js';
import {emptySnapshot,normalizeSnapshot,mergeSnapshots} from '../account-data.js';
test('New exercise types and personal workout history survive load and account validation',()=>{
 for(const type of ['יוגה','הליכה','שחייה'])assert.ok(workoutTypes.includes(type));
 const snapshot=emptySnapshot();snapshot.state.customWorkoutTypes=['פילאטיס'];snapshot.state.workouts['2026-11-01']='פילאטיס';
 const saved=normalizeSnapshot(snapshot);assert.equal(load(JSON.stringify(saved.state)).workouts['2026-11-01'],'פילאטיס');assert.ok(availableWorkoutTypes(saved.state).includes('פילאטיס'));
 const invalid=structuredClone(saved);invalid.state.customWorkoutTypes=[];assert.throws(()=>normalizeSnapshot(invalid));
});
test('Personal workout names are validated and independent additions merge',()=>{
 assert.deepEqual(cleanCustomWorkoutTypes([' פילאטיס ','פילאטיס','יוגה','יום מנוחה','','a'.repeat(41)]),['פילאטיס']);
 const base=emptySnapshot(),local=structuredClone(base),remote=structuredClone(base);local.state.customWorkoutTypes=['פילאטיס'];remote.state.customWorkoutTypes=['ריצה'];
 const merged=mergeSnapshots(base,local,remote);assert.equal(merged.conflicts.length,0);assert.deepEqual(new Set(merged.snapshot.state.customWorkoutTypes),new Set(['פילאטיס','ריצה']));
});
