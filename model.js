import {cleanCustomHabits} from './habit-catalog.js';
import {cleanWeights} from './weight.js';
const groups = [
 ['בוקר', ['כוס מים מיד כשמתעורר','לשבת על המיטה 60 שניות','מוזיקה','מתיחות על המזרון 2–5 דקות','5 נשימות איטיות','לא לגעת בפלאפון כשקמים','צחצוח שיניים','קרם פנים / טיפוח קצר','לסדר מיטה (30–60 שניות)','לסדר קצת את הבית','ארוחת בוקר מזינה','לקחת תוספי תזונה','שקילת בוקר']],
 ['במהלך היום', ['שייק חלבון + קראטין','קריאה','אימון / יום מנוחה','הליכה יומית (אפילו 10 דקות)','לקום בשעה קבועה','לישון לפני 00:30','שתיית מים במהלך היום','ניקוי וסידור הבית']],
 ['ערב', ['מקלחת','קרם גוף + קרם פנים','ארוחת ערב מזינה','לקחת תוספי תזונה','מינוקסי','מתיחות 5–10 דקות','נשימה 4-7-8 / 2 דקות נשימה','הודעה קצרה לאדם קרוב','לשים מים ליד המיטה']]
];
// Starting personal priorities, not medical assessments. Levels: 1–3.
const ratings=[
 [[2,1],[1,1],[1,1],[2,2],[2,1],[2,2],[3,1],[1,1],[2,1],[2,2],[3,2],[1,1],[2,1]],
 [[2,1],[2,2],[3,3],[3,2],[3,2],[3,2],[3,1],[2,3]],
 [[2,2],[1,2],[3,2],[1,1],[1,1],[2,2],[2,1],[2,2],[1,1]]
];
export const habits = groups.flatMap(([group,names],g)=>names.map((name,i)=>{const [importance,effort]=ratings[g][i];return {id:`${g}-${i}`,name,group,exercise:g===1&&i===2,measurement:g===0&&i===12,importance,effort,frequency:g===1&&i===2?'weekly':'daily',target:g===1&&i===2?3:7,points:5*(importance+effort-1)};}));
export function allHabits(state){const removed=new Set(state.removedHabits||['0-1']);return [...habits,...(state.customHabits||[])].map(h=>({...h,archived:removed.has(h.id)}));}
export function activeHabits(state){return allHabits(state).filter(h=>!h.archived);}
export const maxDailyPoints=habits.reduce((sum,h)=>sum+h.points,0);
export function earnedPoints(h,status){return status==='rest'&&h.exercise?10:status==='done'?h.points:0;}
export function dailyScore(state,key){return allHabits(state).reduce((sum,h)=>sum+earnedPoints(h,state.days[key]?.[h.id]),0);}
export const defaultAnchors=['0-0','0-8','0-10'];
export function dayKey(date=new Date()){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function load(raw){try{const x=JSON.parse(raw);return {habitConfigVersion:1,customHabits:cleanCustomHabits(x?.customHabits),removedHabits:[...new Set([...(Array.isArray(x?.removedHabits)?x.removedHabits.filter(id=>typeof id==='string'):[]),...(x?.habitConfigVersion===1?[]:['0-1'])])],reflections:x?.reflections&&typeof x.reflections==='object'&&!Array.isArray(x.reflections)?Object.fromEntries(Object.entries(x.reflections).filter(([k,v])=>/^\d{4}-\d{2}-\d{2}$/.test(k)&&['easy','busy','tired','forgot','other'].includes(v))):{},weights:cleanWeights(x?.weights),goalCelebratedDays:Array.isArray(x?.goalCelebratedDays)?x.goalCelebratedDays.filter(k=>typeof k==='string'):[],days:x?.days&&typeof x.days==='object'&&!Array.isArray(x.days)?x.days:{},dailyGoal:Number.isInteger(x?.dailyGoal)&&x.dailyGoal>=10&&x.dailyGoal<=10000&&x.dailyGoal%5===0?x.dailyGoal:200,anchors:Array.isArray(x?.anchors)?x.anchors.filter(id=>habits.some(h=>h.id===id)):defaultAnchors};}catch{return {habitConfigVersion:1,customHabits:[],removedHabits:['0-1'],reflections:{},weights:{},goalCelebratedDays:[],days:{},dailyGoal:200,anchors:[...defaultAnchors]};}}
export function completed(state,key,activeOnly=false){return (activeOnly?activeHabits(state):allHabits(state)).filter(h=>['done','rest'].includes(state.days[key]?.[h.id])).length;}
export function toggle(state,key,id,value='done'){state.days[key]??={};state.days[key][id]=state.days[key][id]===value?null:value;}
