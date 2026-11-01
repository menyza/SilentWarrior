import {load,allHabits} from '../../model.js';
import {waterDay} from '../../hydration.js';
export function contextual(reminder){return reminder.kind==='habit'||reminder.kind==='water';}
export async function reminderState(db,subscriptionId){
 const row=await db.prepare('SELECT d.data FROM subscription_owners o LEFT JOIN account_documents d ON d.user_id=o.user_id WHERE o.subscription_id=?').bind(subscriptionId).first();
 if(!row)return null;
 const document=row.data?JSON.parse(row.data):null;return load(JSON.stringify(document?.state||{}));
}
export function reminderMessage(reminder,state){
 if(reminder.kind==='habit'){
  if(!state)return null;
  const habit=allHabits(state).find(h=>h.id===reminder.habitId);
  if(!habit||habit.archived||['done','rest'].includes(state.days[reminder.date]?.[habit.id]))return null;
  return {title:habit.name,body:'עוד לא סימנת היום: '+habit.name+'. מתאים לך צעד קטן עכשיו?'};
 }
 if(reminder.kind==='water'){
  if(!state||waterDay(state,reminder.date).total>=(state.waterGoal||2000))return null;
  return {title:'זמן לשתות מים',body:'אפשר לקחת רגע לשתייה ולתעד את הכמות באפליקציה.'};
 }
 return {title:reminder.topic||(reminder.kind==='morning'?'בוקר טוב, הלוחם השקט':'רגע לשגרת הערב'),body:'זמן לפעולה קטנה בשבילך. פותחים ובוחרים מה מתאים עכשיו.'};
}
