import {state,rpc,admin,current,player,prices,h,dateText,panel,pageHeader,option,euroShort,toast,playerAvatar} from './pages.js';
import {parseDelimited,rowsFromTable,pts} from './logic.js';

const localDateTime=value=>value?new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(value)).replace(' ','T'):'';

// Downscale large camera photographs in the browser; remove EXIF by re-encoding.
async function optimizedPortrait(file){
 const supported=['image/jpeg','image/png','image/webp'];
 if(!supported.includes(file.type)||!file.size||file.size>25*1024*1024)
   throw Error('Escolle unha foto JPG, PNG ou WebP de ata 25 MB');
 let bitmap;
 try{bitmap=await createImageBitmap(file);}
 catch{throw Error('Non foi posible abrir a imaxe: proba cun arquivo JPG ou PNG');}
 try{
   const max=960,scale=Math.min(1,max/Math.max(bitmap.width,bitmap.height));
   const canvas=document.createElement('canvas');
   canvas.width=Math.max(1,Math.round(bitmap.width*scale));
   canvas.height=Math.max(1,Math.round(bitmap.height*scale));
   canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);
   const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.82));
   if(!blob||blob.type!=='image/webp'||blob.size>4*1024*1024)
     throw Error('Non se puido comprimir a foto: proba cun JPG máis pequeno');
   return blob;
 }finally{bitmap.close?.();}
}
const selectedFixture=()=>state.data.fixtures.find(f=>f.id===state.adminFixture)||current().pending||state.data.fixtures[0];
const getStat=(id)=>state.importRows?.find(r=>r.player_id===id)||state.data.stats?.find(r=>r.player_id===id && r.fixture_id===selectedFixture()?.id)||{};
export function adminView(){
 const d=state.data,fixture=selectedFixture();if(!admin())return pageHeader('Administración','Acceso restrinxido.');
 const photoPlayer=d.players.find(p=>p.id===state.adminPlayer)||d.players[0];
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
 ,'</div>',
 panel('<h2>Fotografías dos xogadores</h2><p>Sube un retrato para amosalo no mercado, no quinteto e na ficha do xogador. Só se pode ver desde unha conta autorizada do club. JPEG, PNG ou WebP, ata 25 MB; a app reduce a foto automaticamente e elimina os metadatos.</p>'+
 '<div class="grid two"><div class="stack"><div class="field"><label>Xogador</label><select id="admin-photo-player">'+d.players.map(p=>option(p.id,p.name,photoPlayer?.id)).join('')+'</select></div>'+
 '<div class="field"><label>Seleccionar foto</label><input id="admin-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></div>'+
 '<label class="mini"><input type="checkbox" id="admin-photo-consent"> Confirmo que o club dispón da autorización necesaria para utilizar esta fotografía no Fantasy, tamén se a persoa é menor.</label>'+
 '<div class="actions"><button class="btn primary" data-action="upload-player-photo">Gardar foto</button><button class="btn danger" data-action="remove-player-photo" '+(!photoPlayer?.photo_path?'disabled':'')+'>Retirar foto</button></div></div>'+
 '<div class="admin-photo-preview" id="admin-photo-preview">'+(photoPlayer?playerAvatar(photoPlayer,'admin-photo-avatar'):'')+'<p>'+h(photoPlayer?.photo_path?'Foto actual':'Sen foto cargada')+'</p></div></div>')
 ];
 return pageHeader('Panel de administración','Só persoas autorizadas. Todos os cambios sensibles rexístranse.')+lines.join('');
}
function val(id,selector){return document.getElementById(id)?.value??selector??''}
async function localToIso(v){if(!v)throw Error('Indica a data e a hora');return await rpc('fantasy_local_time',{p_clock:v});}
export async function adminAction(action){
 const f=selectedFixture();if(!f)return toast('Non hai xornada dispoñible',true);
 switch(action){
  case 'upload-player-photo':{
    const id=val('admin-photo-player'),p=state.data.players.find(x=>x.id===id);
    const file=document.getElementById('admin-photo-file')?.files?.[0];
    if(!p)throw Error('Selecciona un xogador');
    if(!file)throw Error('Selecciona unha foto');
    if(!document.getElementById('admin-photo-consent')?.checked)throw Error('Confirma a autorización da fotografía antes de subila');
    const optimized=await optimizedPortrait(file);
    const newPath=state.data.club.id+'/'+p.id+'/'+crypto.randomUUID()+'.webp';
    const store=state.client.storage.from('player-photos');
    const upload=await store.upload(newPath,optimized,{upsert:false,contentType:'image/webp',cacheControl:'3600'});
    if(upload.error)throw upload.error;
    try{await rpc('fantasy_set_player_photo',{p_player:p.id,p_path:newPath});}
    catch(error){await store.remove([newPath]);throw error;}
    if(p.photo_path){const cleanup=await store.remove([p.photo_path]);if(cleanup.error)console.warn('Foto antiga sen retirar:',cleanup.error.message);}
    state.adminPlayer=p.id;
    break;
  }
  case 'remove-player-photo':{
    const id=val('admin-photo-player'),p=state.data.players.find(x=>x.id===id);
    if(!p?.photo_path)return false;
    if(!confirm('Retirar a fotografía de '+p.name+' do Fantasy?'))return false;
    await rpc('fantasy_set_player_photo',{p_player:p.id,p_path:null});
    const cleanup=await state.client.storage.from('player-photos').remove([p.photo_path]);
    if(cleanup.error)console.warn('Non se puido eliminar o ficheiro anterior:',cleanup.error.message);
    state.adminPlayer=p.id;break;
  }
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
