const KEY='silent-warrior-theme';
const media=matchMedia('(prefers-color-scheme: dark)');
export function themePreference(){try{const v=localStorage.getItem(KEY);return ['light','dark','auto'].includes(v)?v:'auto';}catch{return 'auto';}}
function apply(){const preference=themePreference(),dark=preference==='dark'||preference==='auto'&&media.matches;document.documentElement.dataset.theme=dark?'dark':'light';document.documentElement.style.colorScheme=dark?'dark':'light';document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#141c2e':'#f5f7fc');}
export function setTheme(value){if(!['light','dark','auto'].includes(value))return;localStorage.setItem(KEY,value);apply();}
media.addEventListener('change',apply);window.addEventListener('storage',e=>{if(e.key===KEY)apply();});apply();
