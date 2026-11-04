import {state,rpc,admin,current,player,prices,h,dateText,panel,pageHeader,option,euroShort,toast} from './pages.js';
import {parseDelimited,rowsFromTable,pts} from './logic.js';

const localDateTime=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)).replace(' ','T'):'';
const selectedFixture=()=>state.data.fixtures.find(f=>f.id===state.adminFixture)||current().pending||state.data.fixtures[0];
const getStat=(id)=>state.importRows?.find(r=>r.player_id===id)||state.data.stats?.find(r=>r.player_id===id && r.fixture_id===selectedFixture()?.id)||{};
export function adminView(){
 const d=state.data,fixture=selectedFixture();if(!admin())return pageHeader('Administración','Acceso restrinxido.');
 const lines=[
 '<div class="grid four" style="margin-bottom:16px">'+[
 ['Participantes',d.metrics?.members||0],['Equipos Fantasy',d.metrics?.teams||0],
 ['Juniors',d.metrics?.juniors||0],['Xornadas publicadas',d.metrics?.finalized_rounds||0]
 ].map(x=>panel('<div class="kpi-label">'+x[0]+'</div><div class="kpi">'+x[1]+'</div>')).join('')+'</div>',
 '<div class="notice '+(d.season.active?'info':'')+'">'+(d.season.active?'Tempada activa. Revisa horarios e resultados antes de publicar.':'TEMPADA DESACTIVADA: o mercado non admite equipos. Actívaa só cando se completen as probas e haxa participantes preparados.')+'</div>',
 (!d.season.active?'<button class="btn primary" data-action="activate-season" style="margin:13px 0">Activar tempada</button>':''),
 '<div class="field" style="margin:17px 0"><label>Xornada de traballo</label><select id="admin-fixture">'+d.fixtures.map(f=>option(f.id,'X'+f.round_number+' · '+f.opponent,fixture?.id)).join('')+'</select></div>',
 '<div class="grid two">',
 panel('<h2>Horario do partido</h2><p>Os horarios publícanse normalmente cada martes ás 18:00. Non inventes unha hora se aínda non está confirmada.</p><div class="field"><label>Inicio · hora de Moaña</label><input type="datetime-local" id="kickoff-time" value="'+(fixture?localDateTime(fixture.starts_at):'')+'"></div><div class="field" style="margin:12px 0"><label>Motivo da actualización</label><input id="kickoff-reason" value="Horario confirmado"></div><button class="btn primary" data-action="update-kickoff">Gardar horario</button>'),
 panel('<h2>Final do partido</h2><p>Marca o final real para iniciar a votación de 72 horas. Este cambio queda no historial de auditoría.</p><div class="field"><label>Final · hora de Moaña</label><input type="datetime-local" id="end-time" value="'+(fixture?localDateTime(fixture.ended_at):'')+'"></div><div class="field" style="margin:12px 0"><label>Resultado</label><select id="end-won"><option value="true" '+(fixture?.team_won===true?'selected':'')+'>Vitoria</option><option value="false" '+(fixture?.team_won===false?'selected':'')+'>Derrota</option></select></div><button class="btn primary" data-action="update-end">Gardar final</button>')
 ,'</div>',
 panel('<h2>Convocatoria e votación</h2><p>Marca todos os xogadores convocados, tamén quen non participou no encontro. Só poderán votar os convocados con conta vinculada.</p><div class="grid four">'+d.players.map(p=>'<label class="playeritem" style="font-size:11px"><input type="checkbox" class="callup-box" value="'+p.id+'" '+(d.callups.some(c=>c.fixture_id===fixture?.id && c.player_id===p.id)?'checked':'')+'><span>'+h(p.name)+'</span></label>').join('')+'</div><button class="btn primary" data-action="save-callups" style="margin-top:15px">Gardar convocatoria</button>'),
 panel('<h2>Importar valoracións</h2><p>Aceptamos CSV, Excel e PDF. No caso do PDF extraemos texto como axuda, pero as cifras deben verificarse manualmente. A columna correcta é <b>PIR / Valoración</b>, non EFF.</p><div class="field"><label>Arquivo do Basketball Stats Assistant</label><input type="file" id="stats-file" accept=".csv,.tsv,.xls,.xlsx,.pdf"></div>'+(state.rawPdf?'<details open style="margin-top:12px"><summary>Texto extraído do PDF (revisar)</summary><pre class="file-preview">'+h(state.rawPdf.slice(0,11000))+'</pre></details>':'')+
 '<p class="mini muted">Rexistros preparados: '+(state.importRows?.length||'0')+'. Revisa a correspondencia dos xogadores antes de confirmar.</p>'+
 '<div class="tablewrap"><table class="table"><thead><tr><th>Xogador</th><th>Xogou?</th><th>Minutos</th><th>PIR (non EFF)</th><th>Puntos</th></tr></thead><tbody>'+
 d.players.map(p=>{const v=getStat(p.id),played=Boolean(v.played);return '<tr><td>'+h(p.name)+'</td><td><input type="checkbox" data-stat-played="'+p.id+'" '+(played?'checked':'')+'></td><td><input data-stat-min="'+p.id+'" type="number" step="0.01" min="0" max="60" value="'+h(v.minutes??0)+'" style="min-width:78px;width:96px"></td><td><input data-stat-pir="'+p.id+'" type="number" step="0.01" min="-100" max="100" value="'+h(v.pir??0)+'" style="min-width:78px;width:96px"></td><td><input data-stat-pts="'+p.id+'" type="number" step="1" value="'+h(v.points??0)+'" style="min-width:78px;width:96px"></td></tr>'}).join('')+'</tbody></table></div><button class="btn primary" data-action="save-stats" style="margin-top:14px">Gardar estatísticas revisadas</button>'),
 panel('<h2>Publicar xornada e Bróker</h2><p>A publicación calcula valoración + bonus de vitoria + votos, conxelando o quinteto, recalculando prezos e xerando a clasificación. Por seguridade só é posible 72 h despois do final real, con estatísticas gardadas.</p><div class="notice">Esta operación é definitiva. Verifica antes o PIR de cada xogador, a convocatoria, os resultados e a data real de finalización.</div><button class="btn primary" data-action="publish-round" style="margin-top:14px">Publicar xornada '+(fixture?.round_number||'')+'</button>'),
 '<div class="grid two">',
 panel('<h2>Engadir un junior</h2><div class="stack"><div class="field"><label>Nome</label><input id="junior-name" placeholder="Nome deportivo"></div><div class="field"><label>Posicións (separadas por coma)</label><input id="junior-positions" placeholder="BA, ES"></div><div class="field"><label>Prezo inicial virtual (€)</label><input id="junior-price" type="number" min="450000" max="5000000" step="50000" value="800000"></div><div class="field"><label>Dispoñible desde a xornada</label><input id="junior-round" type="number" min="5" value="'+(current().pending?.round_number||5)+'"></div><button class="btn primary" data-action="add-junior">Engadir ao mercado</button></div>'),
 panel('<h2>Invitar participantes</h2><p>Podes invitar usuarios desde o panel de autenticación de Supabase. A función automática de invitación require ter despregada a Edge Function correspondente.</p><div class="stack"><div class="field"><label>Correo</label><input id="invite-email" type="email" placeholder="correo@exemplo.com"></div><div class="field"><label>Rol</label><select id="invite-role"><option value="participant">Participante</option><option value="admin">Administrador</option></select></div><div class="field"><label>Vincular xogador para votar (opcional)</label><select id="invite-player">'+option('','Non vincular')+d.players.map(p=>option(p.id,p.name)).join('')+'</select></div><label class="mini"><input type="checkbox" id="invite-privacy"> Confirmo que o club verificou a autorización e información de privacidade necesarias para esta persoa (especialmente se é menor).</label><button class="btn primary" data-action="send-invite">Enviar invitación</button></div>')
 ,'</div>'
 ];
 return pageHeader('Panel de administración','Só persoas autorizadas. Todos os cambios sensibles rexístranse.')+lines.join('');
}
function val(id,selector){return document.getElementById(id)?.value??selector??''}
async function localToIso(v){if(!v)throw Error('Indica a data e a hora');return await rpc('fantasy_local_time',{p_clock:v});}
export async function adminAction(action){
 const f=selectedFixture();if(!f)return toast('Non hai xornada dispoñible',true);
 switch(action){
  case 'activate-season':await rpc('fantasy_activate_season',{p_season:state.data.season.id});break;
  case 'update-kickoff':await rpc('fantasy_set_kickoff',{p_fixture:f.id,p_time:await localToIso(val('kickoff-time')),p_reason:val('kickoff-reason')});break;
  case 'update-end':await rpc('fantasy_set_end',{p_fixture:f.id,p_time:await localToIso(val('end-time')),p_won:val('end-won')==='true'});break;
  case 'save-callups':await rpc('fantasy_set_callups',{p_fixture:f.id,p_players:[...document.querySelectorAll('.callup-box:checked')].map(x=>x.value)});break;
  case 'save-stats':{
    const rows=state.data.players.map(p=>{
      const played=document.querySelector('[data-stat-played="'+p.id+'"]')?.checked||false;
      const mins=Number(document.querySelector('[data-stat-min="'+p.id+'"]')?.value||0);
      const pir=Number(document.querySelector('[data-stat-pir="'+p.id+'"]')?.value||0);
      const points=Number(document.querySelector('[data-stat-pts="'+p.id+'"]')?.value||0);
      return {player_id:p.id,played,minutes:mins,pir,points,source_format:state.importRows?.find(r=>r.player_id===p.id)?.source_format||'manual'};
    });
    await rpc('fantasy_save_stats',{p_fixture:f.id,p_rows:rows});state.importRows=null;state.rawPdf='';break;
  }
  case 'publish-round':
    if(!confirm('Publicar definitivamente puntuacións, prezos e clasificación desta xornada?'))return false;
    await rpc('fantasy_publish_fixture',{p_fixture:f.id});break;
  case 'add-junior':await rpc('fantasy_add_junior',{p_season:state.data.season.id,p_name:val('junior-name'),p_positions:val('junior-positions').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean),p_price:Number(val('junior-price')),p_from_round:Number(val('junior-round'))});break;
  case 'send-invite':{
    const email=val('invite-email').trim(),role=val('invite-role'),linkedPlayer=val('invite-player')||null;const privacyVerified=!!document.getElementById('invite-privacy')?.checked; if(!privacyVerified)throw Error('Confirma a verificación de privacidade antes de invitar');
    const {data,error}=await state.client.functions.invoke('invite-user',{body:{clubId:state.data.club.id,email,role,linkedPlayer,privacyVerified}});
    if(error)throw Error('A función de invitación non está lista ou devolveu un erro: '+error.message);
    if(data?.error)throw Error(data.error);
    break;
  }
  default:return false;
 }
 return true;
}
const script=(url,globalName)=>new Promise((resolve,reject)=>{
 if(window[globalName])return resolve(window[globalName]);
 const el=document.createElement('script');el.src=url;el.async=true;
 el.onload=()=>window[globalName]?resolve(window[globalName]):reject(Error('Biblioteca non dispoñible'));
 el.onerror=()=>reject(Error('Non se puido cargar a biblioteca externa'));
 document.head.appendChild(el);
});
async function pdfText(file){
 const lib=await script('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js','pdfjsLib');
 lib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
 const doc=await lib.getDocument({data:new Uint8Array(await file.arrayBuffer())}).promise;
 const all=[];
 for(let p=1;p<=Math.min(doc.numPages,20);p++){
   const page=await doc.getPage(p),text=await page.getTextContent();
   const lines=new Map();
   text.items.forEach(item=>{
     const key=Math.round(item.transform[5]/3)*3;
     if(!lines.has(key))lines.set(key,[]);
     lines.get(key).push({x:item.transform[4],s:item.str});
   });
   all.push('PÁXINA '+p);
   [...lines].sort((a,b)=>b[0]-a[0]).forEach(([,parts])=>all.push(parts.sort((a,b)=>a.x-b.x).map(x=>x.s).join(' | ')));
 }
 return all.join('\n');
}
export async function handleStatsFile(file){
 if(!file)return;
 const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='pdf'){state.rawPdf=await pdfText(file);state.importRows=null;return 'PDF lido. Revisa o texto e introduce/corrixe as valoracións na táboa.';}
 let table;
 if(ext==='xlsx'||ext==='xls'){
   const xlsx=await script('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js','XLSX');
   const workbook=xlsx.read(await file.arrayBuffer(),{type:'array'});
   table=xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]],{header:1,defval:''});
 }else if(ext==='csv'||ext==='tsv'){
   table=parseDelimited(await file.text(),ext==='tsv'?'\t':undefined);
 }else throw Error('Formato non admitido');
 const rows=rowsFromTable(table,state.data.players);
 const matched=rows.filter(r=>r.player_id).length;
 if(!matched)throw Error('Non se recoñeceu ningún xogador: usa nomes completos ou introduce os valores manualmente.');
 state.importRows=rows.filter(r=>r.player_id).map(r=>({...r,source_format:ext==='xlsx'||ext==='xls'?'xlsx':'csv'}));
 state.rawPdf='';
 return matched+' xogadores recoñecidos de '+rows.length+'. Revisa PIR e minutos antes de gardar.';
}
