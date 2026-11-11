import {BOX_FIELDS,BOX_PCT,boxPercentage} from './boxscore.js';

export const hasInformative=row=>!!(row.rebounds_recorded||row.assists_recorded||
  BOX_FIELDS.some(f=>row[f.key]!==null&&row[f.key]!==undefined));

export function boxDraft(p,optionalInt){
 const fields=Object.fromEntries(BOX_FIELDS.map(f=>[
  f.key,optionalInt(p.id,f.key,f.label,f.key==='eff'||f.key==='plus_minus')
 ]));
 return {...fields,steals_recorded:fields.steals!==null,
  blocks_recorded:fields.blocks!==null,turnovers_recorded:fields.turnovers!==null};
}
export function boxHeaders(h){
 return BOX_FIELDS.map(f=>'<th scope="col">'+h(f.label)+'</th>').join('')+
 BOX_PCT.map(f=>'<th scope="col">'+h(f.label)+'</th>').join('');
}
export function boxRow(p,v,h,number){
 const cells=BOX_FIELDS.map(f=>{
  const legacy=['steals','blocks','turnovers'].includes(f.key);
  const value=v[f.key]!=null&&(!legacy||v[f.key+'_recorded']===true)?v[f.key]:'';
  return '<td><label class="stat-input"><span class="stat-mobile-label">'+h(f.label)+'</span>'+
    '<input data-stat-'+f.key+'="'+p.id+'" type="number" inputmode="numeric" step="1"'+
    ' min="'+(f.key==='eff'||f.key==='plus_minus'?'-200':'0')+'" max="'+(f.key==='eff'||f.key==='plus_minus'?'200':'100')+'"'+
    ' placeholder="—" value="'+h(value)+'" aria-label="'+h(f.label)+' de '+h(p.name)+'"></label></td>';
 }).join('');
 const pct=BOX_PCT.map(f=>{
  const n=boxPercentage(v[f.made],v[f.attempted]);
  return '<td class="num">'+(n===null?'—':number(n)+' %')+'</td>';
 }).join('');
 return cells+pct;
}
