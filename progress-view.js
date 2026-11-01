import {activeHabits,allHabits,dayKey} from './model.js';
import {periodDates,shiftDay,summary} from './analytics.js';
import {escapeHtml as escape} from './habit-catalog.js';

const completion=value=>value==='done'||value==='rest';
const dateLabel=date=>new Date(date+'T12:00:00').toLocaleDateString('he-IL',{day:'numeric',month:'short'});
function tinyStep(habit){
 if(/נשימ/.test(habit.name))return 'להתחיל בנשימה איטית אחת אחרי פעולה קבועה, למשל צחצוח שיניים.';
 if(/קריאה/.test(habit.name))return 'להשאיר ספר פתוח ולקרוא עמוד אחד אחרי ארוחה קבועה.';
 if(/תוספ/.test(habit.name))return 'לקשר את התזכורת לזמן שמתאים להנחיות הנטילה שלך.';
 if(/לישון|שינה/.test(habit.name))return 'לקבוע תזכורת להתחלת ההתארגנות לשינה, במקום לחכות לשעת השינה עצמה.';
 if(/לקום|יקיצה/.test(habit.name))return 'לבחור שעת קימה מציאותית ולהכין בערב את הפעולה הראשונה של הבוקר.';
 if(/מים/.test(habit.name))return 'להניח כוס מים ליד פעולה שכבר מתרחשת מדי יום.';
 return 'לבחור גרסה קטנה של ההרגל ולחבר אותה לפעולה קבועה שכבר קיימת ביום שלך.';
}
export function reviewData(state,mode='week',anchor=dayKey(),today=dayKey()){
 const dates=periodDates(mode,anchor),elapsed=dates.filter(date=>date<=today);
 const previous=mode==='week'?elapsed.map(date=>shiftDay(date,-7)):[];
 if(mode==='month'){
  const d=new Date(dates[0]+'T12:00:00');d.setMonth(d.getMonth()-1);previous.splice(0,previous.length,...periodDates('month',dayKey(d)).slice(0,elapsed.length));
 }
 const tracked=elapsed.filter(date=>Object.values(state.days[date]||{}).some(completion));
 const previousTracked=previous.filter(date=>Object.values(state.days[date]||{}).some(completion));
 const active=activeHabits(state);
 const count=(habit,list)=>list.filter(date=>habit.exercise?state.days[date]?.[habit.id]==='done':completion(state.days[date]?.[habit.id])).length;
 const rows=active.map(habit=>({...habit,count:count(habit,elapsed),comparisonCount:count(habit,elapsed.slice(0,previous.length)),previousCount:count(habit,previous)}));
 const actions=elapsed.reduce((total,date)=>total+allHabits(state).filter(h=>completion(state.days[date]?.[h.id])).length,0);
 const improved=previousTracked.length?rows.filter(h=>!h.exercise&&h.comparisonCount>h.previousCount).sort((a,b)=>(b.comparisonCount-b.previousCount)-(a.comparisonCount-a.previousCount))[0]||null:null;
 const strongest=tracked.length>=3?rows.filter(h=>!h.exercise&&h.count>=2).sort((a,b)=>b.count-a.count)[0]||null:null;
 const needsAttention=tracked.length>=3?rows.filter(h=>!h.exercise&&h.count<tracked.length).sort((a,b)=>a.count-b.count||b.importance-a.importance)[0]||null:null;
 const pending=active.filter(h=>!completion(state.days[today]?.[h.id]));
 const next=needsAttention&&pending.some(h=>h.id===needsAttention.id)?needsAttention:pending.find(h=>/נשימ|קריאה|מים/.test(h.name))||pending[0]||null;
 const totals=summary(state,dates,today);
 return {dates,elapsed,tracked,previousTracked,rows,actions,improved,strongest,needsAttention,next,workouts:rows.find(h=>h.exercise)?.count||0,totals};
}
function detailedTable(state,data,today){
 const dates=data.dates;
 return `<details class="review-table"><summary>פתיחת טבלת הפירוט</summary><p class="hint">לבדיקת רשומות בודדות. לחיצה על תאריך פותחת אותו לתיקון.</p><div class="review-table-scroll" tabindex="0"><table class="progress-table"><thead><tr><th scope="col" class="habit-column">הרגל</th>${dates.map(date=>`<th scope="col"><button data-report-day="${date}" ${date>today?'disabled':''}>${dateLabel(date)}</button></th>`).join('')}</tr></thead><tbody>${data.totals.rows.map(habit=>`<tr><th scope="row" class="habit-column">${escape(habit.name)}${habit.archived?'<small>בארכיון</small>':''}</th>${dates.map(date=>{const value=state.days[date]?.[habit.id];return `<td class="${completion(value)?'marked':''}">${date>today?'·':value==='rest'?'מנוחה':value==='done'?'✓':'—'}</td>`;}).join('')}</tr>`).join('')}</tbody></table></div></details>`;
}
export function reviewScreen(state,{mode='week',anchor=dayKey(),today=dayKey()}={}){
 const data=reviewData(state,mode,anchor,today),current=data.dates.includes(today),label=mode==='week'?`${dateLabel(data.dates[0])} – ${dateLabel(data.dates.at(-1))}`:new Date(data.dates[0]+'T12:00:00').toLocaleDateString('he-IL',{month:'long',year:'numeric'});
 const period=mode==='week'?'השבוע':'החודש',previous=mode==='week'?'בשבוע הקודם':'בחודש הקודם';
 const insight=data.improved?`<article class="review-card insight-positive"><span class="review-kicker">מה השתפר</span><h2>${escape(data.improved.name)}</h2><p>סומן ${data.improved.comparisonCount} פעמים בימים המקבילים בתקופה, לעומת ${data.improved.previousCount} בימים המקבילים ${previous}.</p></article>`:data.strongest?`<article class="review-card insight-positive"><span class="review-kicker">מה עובד</span><h2>${escape(data.strongest.name)}</h2><p>סומן ב־${data.strongest.count} מתוך ${data.tracked.length} ימים שבהם תיעדת הרגלים בתקופה.</p></article>`:`<article class="review-card"><span class="review-kicker">בונים תמונה</span><h2>${data.tracked.length?'כל תיעוד עוזר להבין מה מתאים לך':'מתחילים בלי לחץ'}</h2><p>${data.tracked.length?'נדרשים לפחות שלושה ימי תיעוד לסיכום עקביות. השוואה תופיע כשיהיו גם נתונים מהתקופה הקודמת.':'אפשר להתחיל בהרגל אחד קטן ולסמן אותו. לא צריך למלא את כל היום כדי להתחיל.'}</p></article>`;
 const attention=data.needsAttention?`<article class="review-card insight-attention"><span class="review-kicker">מה כדאי לפשט</span><h2>${escape(data.needsAttention.name)}</h2><p>סומן ${data.needsAttention.count} פעמים ב־${data.tracked.length} ימי תיעוד בתקופה. אולי כדאי לנסות גרסה קטנה יותר.</p><p>${escape(tinyStep(data.needsAttention))}</p></article>`:'';
 const next=data.next?`<article class="review-card next-step"><span class="review-kicker">צעד קטן להיום</span><h2>${escape(data.next.name)}</h2><p>${escape(tinyStep(data.next))}</p><button data-review-habit="${data.next.id}">פתיחה במסך היום</button></article>`:`<article class="review-card next-step"><h2>כל ההרגלים הפעילים להיום סומנו</h2><p>אפשר לעצור כאן. מחר מתחילים מחדש.</p></article>`;
 const daily=data.dates.map(date=>{const count=allHabits(state).filter(h=>completion(state.days[date]?.[h.id])).length,future=date>today;return `<button data-report-day="${date}" class="review-day ${count?'has-activity':''} ${date===today?'is-today':''}" ${future?'disabled':''} aria-label="${dateLabel(date)}: ${future?'יום עתידי':count?count+' סימונים':'ללא סימונים'}"><small>${new Date(date+'T12:00:00').toLocaleDateString('he-IL',{weekday:'short'})}</small><b>${Number(date.slice(-2))}</b><span>${future?'·':count?'✓ '+count:'—'}</span></button>`;}).join('');
 return `<div class="screen-top report-top review-top"><div class="review-heading"><div><div class="eyebrow">משוב שיעזור לבחור את הצעד הבא</div><h1>${mode==='week'?'השבוע שלי':'החודש שלי'}</h1></div><button id="export-excel">ייצוא לאקסל</button></div><div class="tabs report-tabs" role="group" aria-label="טווח התקדמות">${[['week','שבוע'],['month','חודש']].map(([key,text])=>`<button data-period="${key}" aria-pressed="${mode===key}" class="${mode===key?'selected':''}">${text}</button>`).join('')}</div><div class="period-picker"><button data-shift="-1" aria-label="תקופה קודמת">→</button><strong>${label}</strong><button data-shift="1" aria-label="תקופה הבאה" ${current?'disabled':''}>←</button></div></div><section class="report-scroll review-scroll" aria-label="סיכום התקדמות"><div class="review-stats"><div><b>${data.tracked.length}</b><span>ימים עם תיעוד</span></div><div><b>${data.actions}</b><span>סימוני הרגלים</span></div><div><b>${data.workouts}${mode==='week'?`<small> / ${state.weeklyWorkoutGoal||3}</small>`:''}</b><span>${mode==='week'?'אימונים מול היעד':'אימונים בתקופה'}</span></div></div><section class="review-card days-card"><h2>${period}, יום אחרי יום</h2><div class="review-days">${daily}</div><p class="hint">לחיצה על יום פותחת אותו לתיקון. — פירושו שלא נרשמו סימונים.</p></section>${insight}${attention}${next}<p class="review-data-note">הסיכום מחושב מהסימונים שלך. ״לא סומן״ אינו בהכרח ״לא בוצע״. ההצעה להיום מתייחסת להיום הנוכחי, גם בצפייה בשבוע קודם.</p><p class="review-points"><span class="period-points">${data.totals.points}</span> נקודות בתקופה · <span class="total-points">${data.totals.total}</span> מאז ההתחלה</p>${detailedTable(state,data,today)}</section>`;
}
