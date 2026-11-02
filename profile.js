import {validDate,validWeight} from './weight.js';
const sexes=['male','female','other','prefer_not'];
export function validProfile(p){return p!==null&&typeof p==='object'&&!Array.isArray(p)&&sexes.includes(p.sex)&&Number.isFinite(p.weightKg)&&p.weightKg>=20&&p.weightKg<=400&&Number.isFinite(p.heightCm)&&p.heightCm>=100&&p.heightCm<=250&&(p.creatine===undefined||typeof p.creatine==='boolean')&&(p.waterGoalMode===undefined||['auto','manual'].includes(p.waterGoalMode))&&Number.isSafeInteger(p.completedAt)&&p.completedAt>0&&p.completedAt<=4102444800000;}
export function cleanProfile(p){return validProfile(p)?{sex:p.sex,weightKg:p.weightKg,heightCm:p.heightCm,completedAt:p.completedAt,...(p.creatine!==undefined?{creatine:p.creatine}:{}),...(p.waterGoalMode!==undefined?{waterGoalMode:p.waterGoalMode}:{})}:null;}
export function profileEstimate(weightKg,heightCm,{creatine=false}={}){
 if(!Number.isFinite(weightKg)||weightKg<20||weightKg>400||!Number.isFinite(heightCm)||heightCm<100||heightCm>250)return null;
 return {bmi:Math.round(weightKg/((heightCm/100)**2)*10)/10,waterMl:Math.min(3000,Math.max(1500,Math.round(weightKg*30/100)*100))+(creatine?300:0)};
}

export function currentProfileWeight(state,today){
 const now=new Date();today??=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
 const date=Object.keys(state.weights||{}).filter(date=>validDate(date)&&date<=today&&validWeight(state.weights[date])).sort().at(-1);
 return date?{weightKg:state.weights[date],date}:state.profile?{weightKg:state.profile.weightKg,date:null}:null;
}
export function syncProfileWaterGoal(state,today){
 if(state.profile?.waterGoalMode!=='auto')return false;
 const current=currentProfileWeight(state,today),estimate=current&&profileEstimate(current.weightKg,state.profile.heightCm,{creatine:state.profile.creatine===true});
 if(!estimate||state.waterGoal===estimate.waterMl)return false;
 state.waterGoal=estimate.waterMl;return true;
}
