const groups = [
 ['בוקר', ['כוס מים מיד כשמתעורר','לשבת על המיטה 60 שניות','מוזיקה','מתיחות על המזרון 2–5 דקות','5 נשימות איטיות','לא לגעת בפלאפון כשקמים','צחצוח שיניים','קרם פנים / טיפוח קצר','לסדר מיטה (30–60 שניות)','לסדר קצת את הבית','ארוחת בוקר מזינה','לקחת תוספי תזונה']],
 ['במהלך היום', ['שייק חלבון + קראטין','קריאה','אימון / יום מנוחה','הליכה יומית (אפילו 10 דקות)','לקום בשעה קבועה','לישון לפני 00:30','שתיית מים במהלך היום','ניקוי וסידור הבית']],
 ['ערב', ['מקלחת','קרם גוף + קרם פנים','ארוחת ערב מזינה','לקחת תוספי תזונה','מינוקסי','מתיחות 5–10 דקות','נשימה 4-7-8 / 2 דקות נשימה','הודעה קצרה לאדם קרוב','לשים מים ליד המיטה']]
];
export const habits = groups.flatMap(([group,names],g)=>names.map((name,i)=>({id:`${g}-${i}`,name,group,exercise:g===1&&i===2})));
export const defaultAnchors=['0-0','0-8','0-10'];
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function load(raw){try{const x=JSON.parse(raw);return {days:x?.days&&typeof x.days==='object'&&!Array.isArray(x.days)?x.days:{},anchors:Array.isArray(x?.anchors)?x.anchors.filter(id=>habits.some(h=>h.id===id)):defaultAnchors};}catch{return {days:{},anchors:[...defaultAnchors]};}}
export function completed(state,key){return habits.filter(h=>['done','rest'].includes(state.days[key]?.[h.id])).length;}
export function toggle(state,key,id,value='done'){state.days[key]??={};state.days[key][id]=state.days[key][id]===value?null:value;}
