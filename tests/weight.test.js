import test from 'node:test';
import assert from 'node:assert/strict';
import {load,dailyScore} from '../model.js';
import {validDate,validWeight,weightRecords} from '../weight.js';
test('weight records survive reload without changing habits or points',()=>{let s=load(JSON.stringify({days:{'2026-10-28':{'0-0':'done'}}}));assert.deepEqual(s.weights,{});s.weights['2026-10-28']=75.5;s=load(JSON.stringify(s));assert.equal(s.weights['2026-10-28'],75.5);assert.equal(dailyScore(s,'2026-10-28'),10);s.weights['2026-10-28']=76;assert.equal(Object.keys(s.weights).length,1);delete s.weights['2026-10-28'];assert.deepEqual(load(JSON.stringify(s)).weights,{});});
test('validation rejects invalid records and sorts measurements newest first',()=>{assert.equal(validDate('2026-02-30'),false);assert.equal(validDate('2024-02-29'),true);for(const v of [0,-1,Infinity,NaN,'75.5',75.55])assert.equal(validWeight(v),false);const s=load(JSON.stringify({weights:{'2026-10-27':76,'2026-10-28':75.5,'bad':77,'2026-02-30':75,'2026-10-26':-1}}));assert.deepEqual(weightRecords(s.weights),[['2026-10-28',75.5],['2026-10-27',76]]);});
