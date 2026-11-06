import test from 'node:test';
import assert from 'node:assert/strict';
import {StretchAudio,stretchCues} from '../stretch-audio.js';
test('Cues follow active timer boundaries, including completion, without replaying missed intervals',()=>{
 assert.equal(stretchCues(300000).length,10);assert.deepEqual(stretchCues(274000)[0],{afterMs:4000,final:false});
 assert.equal(stretchCues(270000)[0].afterMs,30000);assert.deepEqual(stretchCues(1000),[{afterMs:1000,final:true}]);assert.deepEqual(stretchCues(0),[]);
});
class FakeContext{
 constructor(){this.state='suspended';this.currentTime=100;this.destination={};this.oscillators=[];}
 async resume(){this.state='running';}
 createOscillator(){const o={frequency:{setValueAtTime(value){o.frequencyValue=value;}},connect(){},disconnect(){},start(at){o.startAt=at;},stop(at){o.stopAt=at;if(at===undefined)o.cancelled=true;}};this.oscillators.push(o);return o;}
 createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){},disconnect(){}};}
}
test('Sound unlocks on demand, schedules short cues and cancels old sounds before resuming or resetting',async()=>{
 const audio=new StretchAudio({AudioContext:FakeContext});assert.equal(audio.ready,false);assert.equal(await audio.unlock(),true);
 audio.schedule(300000);assert.equal(audio.context.oscillators.length,10);assert.equal(audio.context.oscillators[0].startAt,130);assert.equal(audio.context.oscillators[9].frequencyValue,880);
 const old=[...audio.context.oscillators];audio.stop();assert.ok(old.every(o=>o.cancelled));
 audio.schedule(260000);assert.equal(audio.context.oscillators.at(-9).startAt,120);assert.equal(audio.nodes.size,9);
 audio.schedule(0);assert.equal(audio.nodes.size,0);
});
test('Unsupported audio is reported without stopping the timer',async()=>{const a=new StretchAudio({AudioContext:null});assert.equal(await a.unlock(),false);a.schedule(300000);assert.equal(a.nodes.size,0);});
