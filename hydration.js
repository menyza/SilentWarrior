import {validDate} from './weight.js';
export const drinkTypes={water:'מים',coffee:'קפה',tea:'תה',shake:'שייק',other:'משקה אחר'};
export const automaticDrinks=[{id:'0-0',ml:250,label:'כוס מים בבוקר'},{id:'1-0',ml:500,label:'שייק'},{id:'0-11',ml:250,label:'תוספי בוקר'},{id:'2-3',ml:250,label:'תוספי ערב'}];
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
export function validDrink(entry){return object(entry)&&Object.hasOwn(drinkTypes,entry.kind)&&Number.isInteger(entry.ml)&&entry.ml>=1&&entry.ml<=5000&&Number.isSafeInteger(entry.at)&&entry.at>=0;}
export function cleanWater(raw){if(!object(raw))return {};return Object.fromEntries(Object.entries(raw).filter(([date,entries])=>validDate(date)&&object(entries)).map(([date,entries])=>[date,Object.fromEntries(Object.entries(entries).filter(([id,entry])=>/^[a-f0-9-]{36}$/.test(id)&&(entry===null||validDrink(entry))).slice(0,500).map(([id,entry])=>[id,entry===null?null:{kind:entry.kind,ml:entry.ml,at:entry.at}]))]));}
export function validWater(raw){if(!object(raw))return false;return Object.entries(raw).every(([date,entries])=>validDate(date)&&object(entries)&&Object.keys(entries).length<=500&&Object.entries(entries).every(([id,entry])=>/^[a-f0-9-]{36}$/.test(id)&&(entry===null||validDrink(entry))));}
export function waterDay(state,date){const manual=Object.entries(state.water?.[date]||{}).filter(([,entry])=>entry!==null),automatic=automaticDrinks.filter(drink=>state.days[date]?.[drink.id]==='done');return {manual,automatic,total:manual.reduce((sum,[,entry])=>sum+entry.ml,0)+automatic.reduce((sum,entry)=>sum+entry.ml,0)};}
export function addDrink(state,date,kind,ml,at=Date.now(),id=crypto.randomUUID()){if(!validDate(date)||!validDrink({kind,ml,at}))throw new Error('יש לבחור משקה וכמות בין 1 ל־5000 מ״ל.');state.water??={};state.water[date]??={};if(Object.keys(state.water[date]).length>=500)throw new Error('הגעת למכסת הרשומות ליום הזה.');state.water[date][id]={kind,ml,at};completeWaterHabit(state,date);return id;}
export function removeDrink(state,date,id){if(state.water?.[date]?.[id])state.water[date][id]=null;}
export function hasReport(state,date){return Object.values(state.days[date]||{}).some(value=>value==='done'||value==='rest')||state.weights[date]!==undefined||state.reflections[date]!==undefined||waterDay(state,date).manual.length>0;}

// Reaching the target completes the daily habit; the habit itself adds no water.
export function completeWaterHabit(state,date){
 if((state.removedHabits||[]).includes('1-6')||waterDay(state,date).total<(state.waterGoal||2000))return false;
 state.days[date]??={};if(state.days[date]['1-6']==='done')return false;
 state.days[date]['1-6']='done';return true;
}
