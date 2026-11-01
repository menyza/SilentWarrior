import {validDate} from './weight.js';
import {hasReport} from './hydration.js';
import {dayKey,habits,allHabits,dailyScore,earnedPoints} from './model.js';
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
 rows:allHabits(state).map(h=>({...h,...streaks(state,h.id,today),pointsInPeriod:elapsed.reduce((n,d)=>n+earnedPoints(h,state.days[d]?.[h.id]),0)}))};
}
export function weeklyReview(state,today=dayKey()){
 const dates=periodDates('week',today).filter(d=>d<=today),previous=dates.map(d=>shiftDay(d,-7));
 const count=(h,days)=>days.filter(d=>state.days[d]?.[h.id]==='done').length;
 const rows=allHabits(state).map(h=>({...h,count:count(h,dates),previous:count(h,previous),target:h.exercise?(state.weeklyWorkoutGoal||3):7}));
 return {dates,previous,rows,workouts:rows.find(h=>h.exercise).count,
  previousHasData:previous.some(d=>dailyScore(state,d)>0),
  actions:rows.reduce((sum,h)=>sum+h.count,0),previousActions:rows.reduce((sum,h)=>sum+h.previous,0)};
}

export function weeklyWorkoutProgress(state,today=dayKey()){
 const dates=periodDates('week',today),done=dates.filter(date=>date<=today&&state.days[date]?.['1-2']==='done').length;
 const total=state.weeklyWorkoutGoal||3;
 return {done,total,percent:Math.min(100,Math.round(done/total*100)),start:dates[0],end:dates[6]};
}

export function reportingStreak(state,today=dayKey()){
 const dates=[...new Set([...Object.keys(state.days),...Object.keys(state.weights),...Object.keys(state.reflections),...Object.keys(state.water||{})])].filter(date=>date<=today&&hasReport(state,date)).sort();
 let best=0,run=0,previous;for(const date of dates){run=previous&&shiftDay(previous,1)===date?run+1:1;best=Math.max(best,run);previous=date;}
 const set=new Set(dates);let current=0,date=set.has(today)?today:shiftDay(today,-1);while(set.has(date)){current++;date=shiftDay(date,-1);}return {current,best};
}

// Calendar days since the first actual report; empty or undone days do not start a journey.
export function journeyDay(state,date=dayKey()){
 const dates=[...new Set([...Object.keys(state.days||{}),...Object.keys(state.water||{}),...Object.keys(state.weights||{}),...Object.keys(state.reflections||{})])].filter(k=>validDate(k)&&k<=dayKey()&&hasReport(state,k)).sort();
 const start=dates[0]||dayKey();
 const utc=k=>Date.parse(k+'T00:00:00Z');
 return Math.max(1,Math.floor((utc(date)-utc(start))/86400000)+1);
}
