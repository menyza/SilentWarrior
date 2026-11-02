import {validDate} from './weight.js';
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const validId=id=>/^(?:[012]-\d{1,2}|custom-[a-f0-9-]{36})$/.test(id);
const validStamp=v=>v===null||(Number.isSafeInteger(v)&&v>0&&v<=4102444800000);
export function validHabitTimes(value,ids){return object(value)&&Object.entries(value).every(([date,entries])=>validDate(date)&&object(entries)&&Object.entries(entries).every(([id,at])=>validId(id)&&(!ids||ids.has(id))&&validStamp(at)));}
export function cleanHabitTimes(value){
 if(!object(value))return {};
 return Object.fromEntries(Object.entries(value).filter(([date,entries])=>validDate(date)&&object(entries)).map(([date,entries])=>[date,Object.fromEntries(Object.entries(entries).filter(([id,at])=>validId(id)&&validStamp(at)))]));
}
// Only live changes on the device's current day are timed. Historical corrections
// cannot establish when a habit was performed or marked in the past.
export function recordHabitChanges(state,previous,today,now=Date.now()){
 state.habitTimes??={};
 for(const [id,status] of Object.entries(state.days[today]||{})){
  if(!validId(id)||status===previous?.days?.[today]?.[id])continue;
  if(status==='done'||previous?.days?.[today]?.[id]==='done'){
   state.habitTimes[today]??={};state.habitTimes[today][id]=status==='done'?now:null;
  }
 }
}
export function localTimingParts(now,timeZone){
 const p=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(p=>[p.type,p.value]));
 return {date:`${p.year}-${p.month}-${p.day}`,minute:Number(p.hour)*60+Number(p.minute)};
}
const clock=minute=>String(Math.floor(minute/60)).padStart(2,'0')+':'+String(minute%60).padStart(2,'0');
export function habitTiming(state,id,timeZone,now=new Date()){
 const {date}=localTimingParts(now,timeZone),start=new Date(Date.parse(date+'T12:00:00Z')-28*86400000).toISOString().slice(0,10),minutes=[];
 for(const [day,entries] of Object.entries(state?.habitTimes||{})){
  const at=entries[id];
  if(day<start||day>=date||!Number.isSafeInteger(at)||at>now.getTime()||state.days?.[day]?.[id]!=='done')continue;
  const parts=localTimingParts(new Date(at),timeZone);
  if(parts.date===day)minutes.push(parts.minute);
 }
 minutes.sort((a,b)=>a-b);const count=minutes.length;
 if(count<5)return {count,ready:false};
 const middle=count%2?minutes[(count-1)/2]:Math.round((minutes[count/2-1]+minutes[count/2])/2),spread=minutes[Math.floor((count-1)*.75)]-minutes[Math.floor((count-1)*.25)];
 if(spread>120)return {count,ready:false};
 // Keep the nudge on the same local date, including late-night habits.
 return {count,ready:true,usual:clock(middle),time:clock(Math.min(1439,middle+30))};
}
export function adaptiveSettings(settings,state,now=new Date()){
 return {...settings,reminders:settings.reminders.map(r=>{
  if(r.kind!=='habit'||!r.adaptive)return r;
  const timing=habitTiming(state,r.habitId,settings.timeZone,now);
  return timing.ready?{...r,time:timing.time}:r;
 })};
}
