import test from 'node:test';
import assert from 'node:assert/strict';
import {orderedHabits} from '../reorder.js';
test('saved order persists independently of day and appends new habits safely',()=>{const list=[{id:'a'},{id:'b'},{id:'c'}];assert.deepEqual(orderedHabits(list,'["c","a","c","missing"]'),[list[2],list[0],list[1]]);assert.deepEqual(orderedHabits(list,'broken'),list);assert.deepEqual(orderedHabits(list,'{}'),list);});
