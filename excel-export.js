import {waterDay,drinkTypes} from './hydration.js';
import {allHabits,activeHabits,dayKey,dailyScore,earnedPoints} from './model.js';
import {validDate} from './weight.js';
import {reminderTopic} from './reminder-settings.js';

const textEncoder=new TextEncoder();
const xml=value=>String(value??'').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const statusLabel=status=>status==='done'?'בוצע':status==='rest'?'מנוחה מתוכננת':'לא סומן';
const reflectionLabels={easy:'היה קל למצוא מקום להרגלים',busy:'יום עמוס',tired:'הייתי עייף',forgot:'שכחתי לסמן או לבצע',other:'משהו אחר'};
export function exportSheets(state,reminders=null,today=dayKey()){
 const catalog=allHabits(state),active=activeHabits(state);
 const dates=[...new Set([Object.keys(state.days),Object.keys(state.weights),Object.keys(state.reflections),Object.keys(state.workouts||{}),Object.keys(state.water||{})].flat())].filter(date=>validDate(date)&&date<=today).sort();
 const daily=[['תאריך','הרגלים פעילים שסומנו','מספר הרגלים פעילים','אחוז השלמה','נקודות','משקל בק״ג','מצב אימון','סוג אימון','סיכום היום','שתייה במ״ל','יעד שתייה במ״ל']];
 const journal=[['תאריך','מזהה הרגל','הרגל','חלק ביום','מצב','נקודות','סוג אימון','בארכיון כעת']];
 for(const date of dates){
  const marks=state.days[date]||{},completed=active.filter(h=>['done','rest'].includes(marks[h.id])).length;
  daily.push([date,completed,active.length,active.length?Math.round(completed/active.length*100):0,dailyScore(state,date),state.weights[date]??'',statusLabel(marks['1-2']),marks['1-2']==='done'?state.workouts?.[date]||'לא תועד':'',reflectionLabels[state.reflections[date]]||'',waterDay(state,date).total,state.waterGoal||2000]);
  for(const habit of catalog){if(habit.archived&&!Object.hasOwn(marks,habit.id))continue;const status=marks[habit.id];journal.push([date,habit.id,habit.name,habit.group,statusLabel(status),earnedPoints(habit,status),habit.exercise&&status==='done'?state.workouts?.[date]||'לא תועד':'',habit.archived?'כן':'לא']);}
 }
 const habits=[['מזהה','שם הרגל','חלק ביום','חשיבות','מאמץ','נקודות להשלמה','בארכיון','יעד שבועי'],...catalog.map(h=>[h.id,h.name,h.group,h.importance,h.effort,h.points,h.archived?'כן':'לא',h.exercise?state.weeklyWorkoutGoal||3:7])];
 const schedule=[['נושא','שעה','אזור זמן'],...(reminders?.reminders||[]).map(r=>[reminderTopic(r),r.time,reminders.timeZone])];
 const drinks=[['תאריך','סוג','כמות במ״ל','מקור']];for(const date of dates){const day=waterDay(state,date);for(const [,entry] of day.manual)drinks.push([date,drinkTypes[entry.kind],entry.ml,'הוספה ידנית']);for(const entry of day.automatic)drinks.push([date,entry.label,entry.ml,'מהרגל שסומן']);}
 return [{name:'סיכום יומי',rows:daily},{name:'יומן הרגלים',rows:journal},{name:'הגדרות הרגלים',rows:habits},{name:'תזכורות',rows:schedule},{name:'שתייה',rows:drinks},{name:'מידע',rows:[['פרט','ערך'],['עד לתאריך',today],['יעד נקודות יומי',state.dailyGoal],['יעד אימונים שבועי',state.weeklyWorkoutGoal||3],['יעד שתייה במ״ל',state.waterGoal||2000],['אופן חישוב','הנקודות מחושבות לפי הדירוגים הנוכחיים; הרגלי עבר מחושבים לפי הגדרות ההרגלים כיום.'],['פירוש נתונים חסרים','לא סומן אינו מעיד שההרגל לא בוצע.'],['מקור הנתונים','הנתונים הזמינים במכשיר בזמן הייצוא. בחשבון מחובר מומלץ לוודא שמופיע שמור בחשבון.']]}];
}
function column(index){let name='';for(let n=index+1;n;n=Math.floor((n-1)/26))name=String.fromCharCode(65+(n-1)%26)+name;return name;}
function worksheet(rows){
 const maxColumns=rows.reduce((max,row)=>Math.max(max,row.length),0);
 const data=rows.map((row,index)=>`<row r="${index+1}">${row.map((value,c)=>{const ref=column(c)+(index+1),style=index===0?' s="1"':'';return typeof value==='number'&&Number.isFinite(value)?`<c r="${ref}"${style}><v>${value}</v></c>`:`<c r="${ref}" t="inlineStr"${style}><is><t xml:space="preserve">${xml(value)}</t></is></c>`;}).join('')}</row>`).join('');
 return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0" rightToLeft="1"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols><col min="1" max="${maxColumns}" width="22" customWidth="1"/></cols><sheetData>${data}</sheetData><autoFilter ref="A1:${column(maxColumns-1)}${rows.length}"/></worksheet>`;
}
const crcTable=Array.from({length:256},(_,value)=>{for(let bit=0;bit<8;bit++)value=value&1?0xedb88320^(value>>>1):value>>>1;return value>>>0;});
function crc32(data){let value=0xffffffff;for(const byte of data)value=crcTable[(value^byte)&255]^(value>>>8);return (value^0xffffffff)>>>0;}
function header(size,values){const bytes=new Uint8Array(size),view=new DataView(bytes.buffer);for(const [offset,value,width] of values)width===4?view.setUint32(offset,value,true):view.setUint16(offset,value,true);return bytes;}
function join(parts){const result=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let offset=0;for(const part of parts){result.set(part,offset);offset+=part.length;}return result;}
// Uncompressed ZIP keeps export local and works offline without a third-party script.
function zip(files){
 const local=[],central=[];let offset=0,centralSize=0;
 for(const [path,content] of files){const name=textEncoder.encode(path),data=textEncoder.encode(content),crc=crc32(data);
  const entry=header(30,[[0,0x04034b50,4],[4,20,2],[6,0x800,2],[12,33,2],[14,crc,4],[18,data.length,4],[22,data.length,4],[26,name.length,2]]);
  const directory=header(46,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x800,2],[14,33,2],[16,crc,4],[20,data.length,4],[24,data.length,4],[28,name.length,2],[42,offset,4]]);
  local.push(entry,name,data);central.push(directory,name);offset+=entry.length+name.length+data.length;centralSize+=directory.length+name.length;
 }
 const end=header(22,[[0,0x06054b50,4],[8,files.length,2],[10,files.length,2],[12,centralSize,4],[16,offset,4]]);
 return join([...local,...central,end]);
}
export function excelWorkbook(state,reminders=null,today=dayKey()){
 const sheets=exportSheets(state,reminders,today),ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main';
 const files=[
  ['[Content_Types].xml',`<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`],
  ['_rels/.rels','<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'],
  ['xl/workbook.xml',`<?xml version="1.0" encoding="UTF-8"?><workbook xmlns="${ns}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets.map((sheet,i)=>`<sheet name="${xml(sheet.name)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`],
  ['xl/_rels/workbook.xml.rels',`<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`],
  ['xl/styles.xml',`<?xml version="1.0" encoding="UTF-8"?><styleSheet xmlns="${ns}"><fonts count="2"><font><sz val="11"/><name val="Arial"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Arial"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF3B5BA9"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"><alignment readingOrder="2"/></xf><xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"><alignment readingOrder="2"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`],
  ...sheets.map((sheet,i)=>[`xl/worksheets/sheet${i+1}.xml`,worksheet(sheet.rows)])
 ];return zip(files);
}
export function downloadExcel(state,reminders=null){
 const today=dayKey(),blob=new Blob([excelWorkbook(state,reminders,today)],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`silent-warrior-${today}.xlsx`;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
