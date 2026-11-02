const sexes=['male','female','other','prefer_not'];
export function validProfile(p){return p!==null&&typeof p==='object'&&!Array.isArray(p)&&sexes.includes(p.sex)&&Number.isFinite(p.weightKg)&&p.weightKg>=20&&p.weightKg<=400&&Number.isFinite(p.heightCm)&&p.heightCm>=100&&p.heightCm<=250&&Number.isSafeInteger(p.completedAt)&&p.completedAt>0&&p.completedAt<=4102444800000;}
export function cleanProfile(p){return validProfile(p)?{sex:p.sex,weightKg:p.weightKg,heightCm:p.heightCm,completedAt:p.completedAt}:null;}
export function profileEstimate(weightKg,heightCm){
 if(!Number.isFinite(weightKg)||weightKg<20||weightKg>400||!Number.isFinite(heightCm)||heightCm<100||heightCm>250)return null;
 return {bmi:Math.round(weightKg/((heightCm/100)**2)*10)/10,waterMl:Math.min(3000,Math.max(1500,Math.round(weightKg*30/100)*100))};
}
