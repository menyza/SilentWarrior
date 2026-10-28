import {dayKey,habits,dailyScore,earnedPoints} from './model.js';
export function shiftDay(key,amount){const d=new Date(key+'T12:00:00');d.setDate(d.getDate()+amount);return dayKey(d);}
export function periodDates(mode,anchor){const d=new Date(anchor+'T12:00:00');if(mode==='month')d.setDate(1);else d.setDate(d.getDate()-d.getDay());const start=dayKey(d),end=new Date(d);if(mode==='month')end.setMonth(end.getMonth()+1);else end.setDate(end.getDate()+7);const dates=[];for(let k=start;k<dayKey(end);k=shiftDay(k,1))dates.push(k);return dates;}
export function movePeriod(mode,anchor,amount){const d=new Date(anchor+'T12:00:00');if(mode==='month'){d.setDate(1);d.setMonth(d.getMonth()+amount);}else d.setDate(d.getDate()+amount*7);return dayKey(d);}
export function streaks(state,id,today=dayKey()){
 const keys=Object.keys(state.days).filter(k=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&k<=today&&['done','rest'].includes(state.days[k]?.[id])).sort();
 let best=0,run=0,previous;
 for(const k of keys){run=previous&&shiftDay(previous,1)===k?run+1:1;best=Math.max(best,run);previous=k;}
 let current=0,k=['done','rest'].includes(state.days[today]?.[id])?today:shiftDay(today,-1);
 const marked=new Set(keys);while(marked.has(k)){current++;k=shiftDay(k,-1);}
 return {current,best};
}
export function summary(state,dates,today=dayKey()){
 const elapsed=dates.filter(d=>d<=today),points=elapsed.reduce((n,d)=>n+dailyScore(state,d),0);
 const allKeys=Object.keys(state.days).filter(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&d<=today);
 return {points,total:allKeys.reduce((n,d)=>n+dailyScore(state,d),0),activeDays:elapsed.filter(d=>dailyScore(state,d)>0).length,
 rows:habits.map(h=>({...h,...streaks(state,h.id,today),pointsInPeriod:elapsed.reduce((n,d)=>n+earnedPoints(h,state.days[d]?.[h.id]),0)}))};
}
