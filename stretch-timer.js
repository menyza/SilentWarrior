import {validDate} from './weight.js';
export const STRETCH_MS=5*60*1000;
export function createStretchTimer(date,owner=null,now=Date.now()){return {date,owner,remainingMs:STRETCH_MS,endsAt:now+STRETCH_MS,running:true};}
export function stretchRemaining(timer,now=Date.now()){return Math.max(0,Math.min(STRETCH_MS,timer.running?timer.endsAt-now:timer.remainingMs));}
export function toggleStretchTimer(timer,now=Date.now()){
 const remaining=stretchRemaining(timer,now);return {...timer,remainingMs:remaining,running:remaining>0&&!timer.running,endsAt:remaining>0&&!timer.running?now+remaining:null};
}
export function restoreStretchTimer(raw,owner){
 try{const t=JSON.parse(raw);if(!t||t.owner!==owner||!validDate(t.date)||typeof t.running!=='boolean'||!Number.isFinite(t.remainingMs)||t.remainingMs<0||t.remainingMs>STRETCH_MS||(t.running&&!Number.isFinite(t.endsAt)))return null;return {date:t.date,owner:t.owner,remainingMs:t.remainingMs,endsAt:t.running?t.endsAt:null,running:t.running};}catch{return null;}
}
export function stretchClock(ms){const seconds=Math.ceil(ms/1000);return String(Math.floor(seconds/60)).padStart(2,'0')+':'+String(seconds%60).padStart(2,'0');}
