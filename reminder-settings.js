export const MAX_REMINDERS=20;
export function reminderSettings(value){
 if(!value||typeof value.timeZone!=='string'||value.timeZone.length>80||!Array.isArray(value.reminders)||value.reminders.length>MAX_REMINDERS)throw new Error('invalid_settings');
 try{new Intl.DateTimeFormat('en',{timeZone:value.timeZone}).format();}catch{throw new Error('invalid_timezone');}
 const seen=new Set();
 const reminders=value.reminders.map(r=>{
  if(!r||!/^([01]\d|2[0-3]):[0-5]\d$/.test(r.time))throw new Error('invalid_reminder');
  const legacy=['morning','evening'].includes(r.kind)&&r.id===undefined;
  const id=legacy?r.kind:r.id;
  if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(id)||seen.has(id))throw new Error('invalid_reminder');
  seen.add(id);
  if(r.days!==undefined){
   if(!Array.isArray(r.days)||r.days.length===0||r.days.length>7||r.days.some(d=>!Number.isInteger(d)||d<0||d>6)||new Set(r.days).size!==r.days.length)throw new Error('invalid_reminder');
  }
  if(legacy)return {kind:r.kind,time:r.time};
  if(typeof r.topic!=='string'||!r.topic.trim()||r.topic.trim().length>100)throw new Error('invalid_reminder');
  return {id,kind:'custom',time:r.time,topic:r.topic.trim()};
 });
 return {timeZone:value.timeZone,reminders};
}
export function reminderTopic(r){return r.topic||(r.kind==='morning'?'שגרת בוקר':'שגרת ערב');}
