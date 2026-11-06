import {STRETCH_MS} from './stretch-timer.js';
export const STRETCH_CUE_MS=30000;
export function stretchCues(remainingMs){
 const elapsed=STRETCH_MS-Math.max(0,Math.min(STRETCH_MS,remainingMs)),cues=[];
 for(let boundary=STRETCH_CUE_MS;boundary<=STRETCH_MS;boundary+=STRETCH_CUE_MS)if(boundary>elapsed)cues.push({afterMs:boundary-elapsed,final:boundary===STRETCH_MS});
 return cues;
}
export class StretchAudio{
 constructor({AudioContext=globalThis.AudioContext||globalThis.webkitAudioContext,onState=()=>{}}={}){this.AudioContext=AudioContext;this.onState=onState;this.context=null;this.nodes=new Set();}
 get ready(){return this.context?.state==='running';}
 async unlock(){
  try{if(!this.AudioContext)return false;if(!this.context||this.context.state==='closed'){this.context=new this.AudioContext();this.context.onstatechange=()=>this.onState();}if(!this.ready)await this.context.resume();this.onState();return this.ready;}catch{return false;}
 }
 stop(){for(const node of this.nodes){try{node.stop();}catch{}}this.nodes.clear();}
 schedule(remainingMs){
  this.stop();if(!this.ready)return;
  const context=this.context;
  for(const cue of stretchCues(remainingMs)){
   const when=context.currentTime+cue.afterMs/1000,oscillator=context.createOscillator(),gain=context.createGain();
   oscillator.type='sine';oscillator.frequency.setValueAtTime(cue.final?880:660,when);
   gain.gain.setValueAtTime(0,when);gain.gain.linearRampToValueAtTime(.12,when+.012);gain.gain.linearRampToValueAtTime(0,when+.17);
   oscillator.connect(gain);gain.connect(context.destination);oscillator.onended=()=>{this.nodes.delete(oscillator);oscillator.disconnect();gain.disconnect();};
   this.nodes.add(oscillator);oscillator.start(when);oscillator.stop(when+.18);
  }
 }
}
