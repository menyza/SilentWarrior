import {load,allHabits} from '../../model.js';
import {waterDay} from '../../hydration.js';
export function contextual(reminder){return reminder.kind==='habit'||reminder.kind==='water';}
export async function reminderState(db,subscriptionId){
 const row=await db.prepare('SELECT d.data FROM subscription_owners o LEFT JOIN account_documents d ON d.user_id=o.user_id WHERE o.subscription_id=?').bind(subscriptionId).first();
 if(!row)return null;
 const document=row.data?JSON.parse(row.data):null;return load(JSON.stringify(document?.state||{}));
}
function choose(reminder,messages){
 const day=Math.floor(Date.parse((reminder.date||'2000-01-01')+'T12:00:00Z')/86400000);
 const salt=[...(reminder.id||reminder.habitId||reminder.kind)].reduce((n,c)=>(n*31+c.codePointAt(0))>>>0,0);
 const slot=reminder.slot?Number(reminder.slot.slice(0,2))*60+Number(reminder.slot.slice(3)):0;
 return messages[(day+salt+Math.floor(slot/(reminder.intervalMinutes||60)))%messages.length];
}
export function reminderMessage(reminder,state){
 if(reminder.kind==='habit'){
  if(!state)return null;
  const habit=allHabits(state).find(h=>h.id===reminder.habitId);
  if(!habit||habit.archived||['done','rest'].includes(state.days[reminder.date]?.[habit.id]))return null;
  return {title:habit.name,body:choose(reminder,[`עוד לא סימנת היום: ${habit.name}. מתאים לך צעד קטן עכשיו?`,`רגע בשבילך: ${habit.name}. אם כבר ביצעת, אפשר לסמן באפליקציה.`,`מקום קטן בשגרה ל${habit.name}. אפשר להתחיל בקטן.`,`תזכורת עדינה ל${habit.name}. הסימון של היום עדיין מחכה.`,`מה מתאים לך עכשיו? ${habit.name} הוא צעד אפשרי אחד.`])};
 }
 if(reminder.kind==='water'){
  if(!state||waterDay(state,reminder.date).total>=(state.waterGoal||2000))return null;
  const remaining=Math.max(0,(state.waterGoal||2000)-waterDay(state,reminder.date).total);
  return {title:'זמן לשתות מים',body:choose(reminder,[`הפסקת שתייה קטנה? נותרו ${remaining} מ״ל ליעד שהגדרת.`,`אפשר לקחת רגע לשתייה ולתעד את הכמות באפליקציה.`,`עוד לגימה בקצב שלך. נותרו ${remaining} מ״ל ליעד היומי.`,`כוס מים לידך יכולה לעזור לזכור. אפשר להוסיף את מה ששתית.`,`רגע של התרעננות: שתייה ותיעוד קצר באפליקציה.`])};
 }
 return {title:reminder.topic||(reminder.kind==='morning'?'בוקר טוב, הלוחם השקט':'רגע לשגרת הערב'),body:choose(reminder,['זמן לפעולה קטנה בשבילך. פותחים ובוחרים מה מתאים עכשיו.','רגע לעצור ולבדוק מה מתאים לשגרה שלך היום.','תזכורת קטנה למה שחשוב לך. אפשר להתחיל בצעד אחד.','אם כבר ביצעת, אפשר לעדכן את הסימון באפליקציה.'])};
}
