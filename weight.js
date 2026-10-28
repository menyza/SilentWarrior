export function validDate(key){if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return false;const d=new Date(key+'T12:00:00');return !Number.isNaN(d.valueOf())&&d.getFullYear()===Number(key.slice(0,4))&&d.getMonth()+1===Number(key.slice(5,7))&&d.getDate()===Number(key.slice(8,10));}
export function validWeight(value){return typeof value==='number'&&Number.isFinite(value)&&value>0&&value<=1000&&Math.abs(value*10-Math.round(value*10))<1e-8;}
export function cleanWeights(raw){return raw&&typeof raw==='object'&&!Array.isArray(raw)?Object.fromEntries(Object.entries(raw).filter(([date,value])=>validDate(date)&&validWeight(value))):{};}
export function weightRecords(weights){return Object.entries(weights).sort(([a],[b])=>b.localeCompare(a));}
