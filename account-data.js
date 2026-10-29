import {load,habits} from './model.js';
import {validDate,validWeight} from './weight.js';
import {cleanCustomHabits} from './habit-catalog.js';
const object=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const invalid=()=>{throw new Error('invalid_snapshot');};
export function normalizeSnapshot(raw){
 if(!object(raw)||raw.schemaVersion!==1||!object(raw.state)||!Array.isArray(raw.order))invalid();
 if(JSON.stringify(raw).length>900000)invalid();
 const input=raw.state,custom=cleanCustomHabits(input.customHabits||[]);
 if(!Array.isArray(input.customHabits||[])||custom.length!==(input.customHabits||[]).length)invalid();
 const ids=new Set([...habits,...custom].map(h=>h.id));
 if(!object(input.days||{})||!object(input.weights||{})||!object(input.reflections||{}))invalid();
 for(const [date,marks] of Object.entries(input.days||{})){if(!validDate(date)||!object(marks))invalid();for(const [id,status] of Object.entries(marks)){if(!ids.has(id)||!['done','rest',null].includes(status))invalid();}}
 for(const [date,value] of Object.entries(input.weights||{}))if(!validDate(date)||!validWeight(value))invalid();
 for(const [date,value] of Object.entries(input.reflections||{}))if(!validDate(date)||!['easy','busy','tired','forgot','other'].includes(value))invalid();
 if(!Number.isInteger(input.dailyGoal)||input.dailyGoal<10||input.dailyGoal>10000||input.dailyGoal%5)invalid();
 if(!Array.isArray(input.removedHabits||[])||(input.removedHabits||[]).some(id=>!ids.has(id)))invalid();
 if(raw.order.length>300||raw.order.some(id=>!ids.has(id)))invalid();
 let reminders=null;if(raw.reminders!==null&&raw.reminders!==undefined){const p=raw.reminders;if(!object(p)||typeof p.timeZone!=='string'||!Array.isArray(p.reminders)||p.reminders.length>2)invalid();try{new Intl.DateTimeFormat('en',{timeZone:p.timeZone});}catch{invalid();}const kinds=new Set();for(const r of p.reminders){if(!object(r)||!['morning','evening'].includes(r.kind)||kinds.has(r.kind)||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))invalid();kinds.add(r.kind);}reminders={timeZone:p.timeZone,reminders:p.reminders.map(({kind,time})=>({kind,time}))};}
 const state=load(JSON.stringify({...input,customHabits:custom}));
 return {schemaVersion:1,state,order:[...new Set(raw.order)],reminders};
}
export function emptySnapshot(){return {schemaVersion:1,state:load(null),order:[],reminders:null};}
export function meaningful(snapshot){const s=snapshot.state;return Object.values(s.days).some(m=>Object.values(m).some(v=>v==='done'||v==='rest'))||Object.keys(s.weights).length>0||Object.keys(s.reflections).length>0||s.customHabits.length>0||!equal(s.removedHabits,['0-1'])||s.dailyGoal!==200||snapshot.order.length>0||snapshot.reminders!==null;}
// Three-way merge. Independent edits merge; conflicting values require an explicit choice.
export function mergeSnapshots(base,local,remote,prefer='remote'){
 const conflicts=[];
 function merge(b,l,r,path){
  if(equal(l,r))return structuredClone(l);
  if(equal(l,b))return structuredClone(r);
  if(equal(r,b))return structuredClone(l);
  if(path==='state.customHabits'){
   const map=arr=>Object.fromEntries((arr||[]).map(h=>[h.id,h]));
   return Object.values(merge(map(b),map(l),map(r),'customHabitsById'));
  }
  if(['state.removedHabits','state.goalCelebratedDays'].includes(path)){
   const ids=new Set([...(b||[]),...(l||[]),...(r||[])]);return [...ids].filter(id=>merge((b||[]).includes(id),(l||[]).includes(id),(r||[]).includes(id),path+'.'+id));
  }
  if(object(l)&&object(r)&&(b===undefined||object(b))){const out={};for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){if(['__proto__','constructor','prototype'].includes(key))continue;const value=merge(b?.[key],l[key],r[key],path?path+'.'+key:key);if(value!==undefined)out[key]=value;}return out;}
  conflicts.push(path);return structuredClone(prefer==='local'?l:r);
 }
 return {snapshot:normalizeSnapshot(merge(base,local,remote,'')),conflicts};
}
