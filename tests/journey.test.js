import test from 'node:test';
import assert from 'node:assert/strict';
import {journeyDay} from '../analytics.js';
import {load} from '../model.js';
test('Journey counts calendar days from earliest report and does not reset after gaps',()=>{
 const state=load(null);state.days={'2026-03-27':{'0-0':'done'},'2026-03-26':{'0-0':null}};
 assert.equal(journeyDay(state,'2026-03-30'),4);
 state.water['2026-03-25']={a:{kind:'water',ml:250,at:1}};
 assert.equal(journeyDay(state,'2026-03-30'),6);
 state.water['2026-03-25'].a=null;
 assert.equal(journeyDay(state,'2026-03-30'),4);
});
