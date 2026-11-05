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

const number=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format(Number(n)||0);
const cash=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:0}).format(Number(n)||0)+' €';
function statsDraft(){
 return state.data.players.map(p=>({
  player_id:p.id,
  played:!!document.querySelector('[data-stat-played="'+p.id+'"]')?.checked,
  minutes:Number(document.querySelector('[data-stat-min="'+p.id+'"]')?.value||0),
  pir:Number(document.querySelector('[data-stat-pir="'+p.id+'"]')?.value||0),
  points:Number(document.querySelector('[data-stat-pts="'+p.id+'"]')?.value||0),
  source_format:state.importRows?.find(r=>r.player_id===p.id)?.source_format||'manual'
 }));
}
function previewHtml(pre){
 if(!pre)return '<p class="mini muted">Calcula a vista previa antes de publicar.</p>';
 const playerRows=(pre.players||[]).map(p=>'<tr><td>'+h(p.name)+'</td><td>'+number(p.pir)+'</td><td>+'+number(p.vote_bonus)+'</td><td><b>'+number(p.fantasy_points)+'</b></td><td>'+cash(p.price_before)+' → '+cash(p.price_after)+'</td></tr>').join('');
 const teamRows=(pre.teams||[]).map(t=>'<tr><td>'+h(t.team_name)+'</td><td>'+number(t.fantasy_points)+'</td></tr>').join('');
 return '<p class="mini">Vista previa calculada para a xornada '+number(pre.round)+'. '+number(pre.player_count)+' xogadores e '+number(pre.team_count)+' equipos. Non se modificaron datos.</p>'+
 '<div class="tablewrap"><table class="table"><thead><tr><th>Xogador</th><th>PIR</th><th>Votos</th><th>Fantasy</th><th>Bróker</th></tr></thead><tbody>'+playerRows+'</tbody></table></div>'+
 '<h3>Equipos Fantasy</h3><div class="tablewrap"><table class="table"><thead><tr><th>Equipo</th><th>Puntos</th></tr></thead><tbody>'+teamRows+'</tbody></table></div>';
}
function memberHtml(members){
 if(!members)return '<p class="mini muted">Pulsa «Cargar participantes» para consultar as contas do club.</p>';
 if(!members.length)return '<p class="mini muted">Non hai participantes asociados.</p>';
 const players=state.data.players;
 return '<p class="mini">Contas vinculadas: '+members.length+'. Só administración pode ver estes correos. Non se eliminan contas de Supabase desde este panel.</p>'+
 '<div class="tablewrap"><table class="table"><thead><tr><th>Correo / estado</th><th>Rol</th><th>Xogador</th><th>Accións</th></tr></thead><tbody>'+
 members.map(m=>'<tr><td><b>'+h(m.email)+'</b><small style="display:block">'+(m.confirmed?'Correo confirmado':'Invitación pendente')+'</small></td>'+
 '<td><select data-member-role="'+h(m.user_id)+'">'+option('participant','Participante',m.role)+option('admin','Administrador',m.role)+'</select></td>'+
 '<td><select data-member-player="'+h(m.user_id)+'">'+option('','Sen vinculación',m.linked_player)+players.map(p=>option(p.id,p.name,p.id===m.linked_player?m.linked_player:'')).join('')+'</select></td>'+
 '<td><div class="actions"><button class="btn secondary" data-action="update-member" data-user="'+h(m.user_id)+'">Gardar</button>'+
 '<button class="btn outline" data-action="revoke-member" data-user="'+h(m.user_id)+'">Retirar acceso</button></div></td></tr>').join('')+
 '</tbody></table></div>';
}

function launchChecklistHtml(status){
 if(!status)return panel('<h2 id="admin-launch">Preparación do lanzamento</h2><p class="notice">Non foi posible cargar as comprobacións.</p>');
 const items=(status.checks||[]).map(c=>{
  const key=h(c.key),title=h(c.title),verified=!!c.verified;
  return '<div class="playeritem" style="display:block;margin:9px 0">'+
   '<div class="row"><b>'+(verified?'Confirmado · ':'Pendente · ')+title+'</b><span class="tag '+(verified?'':'warn')+'">'+(verified?'Feito':'Pendente')+'</span></div>'+
   (verified?'<p class="mini muted">Verificado o '+h(dateText(c.verified_at))+'. '+h(c.note||'')+'</p>':'')+
   '<div class="field"><label for="launch-note-'+key+'">'+(verified?'Motivo da revogación':'Referencia da evidencia ou comprobación realizada')+'</label>'+
   '<input id="launch-note-'+key+'" maxlength="1000" minlength="12" placeholder="Describe a evidencia; non inclúas datos persoais"></div>'+
   '<button class="btn '+(verified?'secondary':'primary')+'" style="margin-top:8px" data-action="set-launch-check" data-launch-key="'+key+'" data-launch-verified="'+(verified?'false':'true')+'" '+(state.data.season.active?'disabled':'')+'>'+
   (verified?'Revogar comprobación':'Confirmar comprobación')+'</button></div>';
 }).join('');
 return panel('<h2 id="admin-launch">Control previo ao lanzamento</h2>'+
  '<p><b>'+Number(status.completed_count||0)+' / '+Number(status.required_count||5)+' comprobacións</b>. A tempada só se pode activar cando todas estean confirmadas.</p>'+
  '<p class="mini muted">Marcar unha tarefa non substitúe a proba real: comproba a restauración, as autorizacións de menores e o acceso no navegador antes de confirmala. Non gardes datos persoais nas notas.</p>'+
  '<div class="stack">'+items+'</div>');
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
 launchChecklistHtml(d.launchStatus),
 (!d.season.active?'<button class="btn primary" data-action="activate-season" style="margin:13px 0" '+(d.launchStatus?.ready?'':'disabled title="Completa primeiro as cinco comprobacións"')+'>Activar tempada</button>':''),
 '<div class="field" style="margin:17px 0"><label>Xornada de traballo</label><select id="admin-fixture">'+d.fixtures.map(f=>option(f.id,'X'+f.round_number+' · '+f.opponent,fixture?.id)).join('')+'</select></div>',
 '<div class="grid two">',
 panel('<h2>Horario do partido</h2><p>Os horarios publícanse normalmente cada martes ás 18:00. Non inventes unha hora se aínda non está confirmada.</p><div class="field"><label>Inicio · hora de Moaña</label><input type="datetime-local" id="kickoff-time" value="'+(fixture?localDateTime(fixture.starts_at):'')+'"></div><div class="field" style="margin:12px 0"><label>Motivo da actualización</label><input id="kickoff-reason" value="Horario confirmado"></div><button class="btn primary" data-action="update-kickoff">Gardar horario</button>'),
 panel('<h2>Final do partido</h2><p>Marca o final real para iniciar a votación de 72 horas. Este cambio queda no historial de auditoría.</p><div class="field"><label>Final · hora de Moaña</label><input type="datetime-local" id="end-time" value="'+(fixture?localDateTime(fixture.ended_at):'')+'"></div><div class="field" style="margin:12px 0"><label>Resultado</label><select id="end-won"><option value="true" '+(fixture?.team_won===true?'selected':'')+'>Vitoria</option><option value="false" '+(fixture?.team_won===false?'selected':'')+'>Derrota</option></select></div><button class="btn primary" data-action="update-end">Gardar final</button>')
 ,'</div>',
 panel('<h2>Convocatoria e votación</h2><p>Marca todos os xogadores convocados, tamén quen non participou no encontro. Só poderán votar os convocados con conta vinculada.</p><div class="grid admin-callup-grid">'+d.players.map(p=>'<label class="playeritem callup-item"><input type="checkbox" class="callup-box" value="'+p.id+'" '+(d.callups.some(c=>c.fixture_id===fixture?.id && c.player_id===p.id)?'checked':'')+'><span>'+h(p.name)+'</span></label>').join('')+'</div><button class="btn primary" data-action="save-callups" style="margin-top:15px">Gardar convocatoria</button>'),
 panel('<h2>Importar valoracións</h2><p>Aceptamos CSV, Excel e PDF. No caso do PDF extraemos texto como axuda, pero as cifras deben verificarse manualmente. A columna correcta é <b>PIR / Valoración</b>, non EFF.</p><div class="field"><label>Arquivo do Basketball Stats Assistant</label><input type="file" id="stats-file" accept=".csv,.tsv,.xls,.xlsx,.pdf"></div>'+(state.rawPdf?'<details open style="margin-top:12px"><summary>Texto extraído do PDF (revisar)</summary><pre class="file-preview">'+h(state.rawPdf.slice(0,11000))+'</pre></details>':'')+
 '<p class="mini muted">Rexistros preparados: '+(state.importRows?.length||'0')+'. Revisa a correspondencia dos xogadores antes de confirmar.</p>'+
 '<div class="tablewrap admin-stats-wrap"><table class="table admin-stats-table"><thead><tr><th scope="col">Xogador</th><th scope="col">Xogou?</th><th scope="col">Minutos</th><th scope="col">PIR (non EFF)</th><th scope="col">Puntos</th></tr></thead><tbody>'+
 d.players.map(p=>{const v=getStat(p.id),played=Boolean(v.played);return '<tr><th scope="row">'+h(p.name)+'</th><td><label class="stat-input stat-check"><span class="stat-mobile-label">Xogou?</span><input type="checkbox" data-stat-played="'+p.id+'" '+(played?'checked':'')+' aria-label="Xogou '+h(p.name)+'"></label></td><td><label class="stat-input"><span class="stat-mobile-label">Minutos</span><input data-stat-min="'+p.id+'" type="number" inputmode="decimal" step="0.01" min="0" max="60" value="'+h(v.minutes??0)+'" aria-label="Minutos de '+h(p.name)+'"></label></td><td><label class="stat-input"><span class="stat-mobile-label">PIR</span><input data-stat-pir="'+p.id+'" type="number" inputmode="decimal" step="0.01" min="-100" max="100" value="'+h(v.pir??0)+'" aria-label="Valoración PIR de '+h(p.name)+'"></label></td><td><label class="stat-input"><span class="stat-mobile-label">Puntos</span><input data-stat-pts="'+p.id+'" type="number" inputmode="numeric" step="1" value="'+h(v.points??0)+'" aria-label="Puntos de '+h(p.name)+'"></label></td></tr>'}).join('')+'</tbody></table></div><button class="btn primary" data-action="save-stats" style="margin-top:14px">Gardar estatísticas revisadas</button>'),
 panel('<h2 id="admin-publication">Vista previa, publicación e rectificación</h2><p>A vista previa usa o mesmo cálculo servidor que a publicación. Debe transcorrer o prazo de votación de 72 horas e existir convocatoria e estatísticas completas.</p>'+
 '<div class="actions"><button class="btn secondary" data-action="preview-round">Calcular vista previa da xornada '+(fixture?.round_number||'')+'</button></div>'+
 '<div id="admin-preview-results" style="margin-top:14px">'+previewHtml(state.adminPreview?.fixture_id===fixture?.id?state.adminPreview:null)+'</div>'+
 (fixture?.status==='finalized'?'<div class="field" style="margin-top:14px"><label>Motivo da rectificación (obrigatorio, mínimo 10 caracteres)</label><textarea id="correction-reason" rows="2" placeholder="Explica que valoración foi corrixida e por que"></textarea></div>'+
 '<p class="mini muted">As rectificacións non poden modificar fichaxes nin xornadas posteriores xa pechadas.</p><button class="btn danger" data-action="correct-round">Rectificar xornada publicada</button>':
 '<div class="notice">Revisa todo antes de publicar. Esta operación será definitiva e auditada.</div><button class="btn primary" data-action="publish-round">Publicar xornada '+(fixture?.round_number||'')+'</button>')),
 '<div class="grid two">',
 panel('<h2>Engadir un junior</h2><div class="stack"><div class="field"><label>Nome</label><input id="junior-name" placeholder="Nome deportivo"></div><div class="field"><label>Posicións (separadas por coma)</label><input id="junior-positions" placeholder="BA, ES"></div><div class="field"><label>Prezo inicial virtual (€)</label><input id="junior-price" type="number" min="450000" max="5000000" step="50000" value="800000"></div><div class="field"><label>Dispoñible desde a xornada</label><input id="junior-round" type="number" min="5" value="'+(current().pending?.round_number||5)+'"></div><button class="btn primary" data-action="add-junior">Engadir ao mercado</button></div>'),
 panel('<h2>Invitar participantes</h2><p>Podes invitar usuarios desde o panel de autenticación de Supabase. A función automática de invitación require ter despregada a Edge Function correspondente.</p><div class="stack"><div class="field"><label>Correo</label><input id="invite-email" type="email" placeholder="correo@exemplo.com"></div><div class="field"><label>Rol</label><select id="invite-role"><option value="participant">Participante</option><option value="admin">Administrador</option></select></div><div class="field"><label>Vincular xogador para votar (opcional)</label><select id="invite-player">'+option('','Non vincular')+d.players.map(p=>option(p.id,p.name)).join('')+'</select></div><label class="mini"><input type="checkbox" id="invite-privacy"> Confirmo que o club verificou a autorización e información de privacidade necesarias para esta persoa (especialmente se é menor).</label><button class="btn primary" data-action="send-invite">Enviar invitación</button></div>')
 ,'</div>',
 panel('<h2 id="admin-members">Xestionar contas e permisos</h2><p>Consulta estados de invitación, permisos e vinculacións. Os cambios quedan rexistrados na auditoría.</p>'+
 '<button class="btn secondary" data-action="load-participants">Cargar participantes</button><div id="admin-participants-results" style="margin-top:12px">'+memberHtml(state.adminMembers)+'</div>'),
 panel('<h2 id="admin-backups">Exportar datos do club</h2><p>Garda unha copia administrativa JSON da tempada. Contén datos persoais, polo que debe almacenarse de forma segura. Esta exportación non substitúe unha copia completa de PostgreSQL nin dos arquivos de Storage.</p><button class="btn secondary" data-action="export-snapshot">Descargar exportación JSON</button>'),
 panel('<h2>Fotografías dos xogadores</h2><p>Sube un retrato para amosalo no mercado, no quinteto e na ficha do xogador. Só se pode ver desde unha conta autorizada do club. JPEG, PNG ou WebP, ata 25 MB; a app reduce a foto automaticamente e elimina os metadatos.</p>'+
 '<div class="grid two"><div class="stack"><div class="field"><label>Xogador</label><select id="admin-photo-player">'+d.players.map(p=>option(p.id,p.name,photoPlayer?.id)).join('')+'</select></div>'+
 '<div class="field"><label>Seleccionar foto</label><input id="admin-photo-file" type="file" accept="image/jpeg,image/png,image/webp"></div>'+
 '<label class="mini"><input type="checkbox" id="admin-photo-consent"> Confirmo que o club dispón da autorización necesaria para utilizar esta fotografía no Fantasy, tamén se a persoa é menor.</label>'+
 '<div class="actions"><button class="btn primary" data-action="upload-player-photo">Gardar foto</button><button class="btn danger" data-action="remove-player-photo" '+(!photoPlayer?.photo_path?'disabled':'')+'>Retirar foto</button></div></div>'+
 '<div class="admin-photo-preview" id="admin-photo-preview">'+(photoPlayer?playerAvatar(photoPlayer,'admin-photo-avatar'):'')+'<p>'+h(photoPlayer?.photo_path?'Foto actual':'Sen foto cargada')+'</p></div></div>')
 ];
 const sections=lines.join('')
  .replace('<h2>Convocatoria e votación</h2>','<h2 id="admin-callups">Convocatoria e votación</h2>')
  .replace('<h2>Importar valoracións</h2>','<h2 id="admin-stats">Importar valoracións</h2>')
  .replace('<h2>Invitar participantes</h2>','<h2 id="admin-invites">Invitar participantes</h2>')
  .replace('<h2>Fotografías dos xogadores</h2>','<h2 id="admin-photos">Fotografías dos xogadores</h2>');
 const jumps='<nav class="admin-jumps" aria-label="Ir á sección de administración"><a href="#admin-launch">Lanzamento</a><a href="#admin-callups">Convocatoria</a><a href="#admin-stats">Estatísticas</a><a href="#admin-invites">Invitacións</a><a href="#admin-members">Contas</a><a href="#admin-publication">Publicación</a><a href="#admin-backups">Exportación</a><a href="#admin-photos">Fotos</a></nav>';
 return pageHeader('Panel de administración','Só persoas autorizadas. Todos os cambios sensibles rexístranse.')+jumps+sections;
}
function val(id,selector){return document.getElementById(id)?.value??selector??''}
async function localToIso(v){if(!v)throw Error('Indica a data e a hora');return await rpc('fantasy_local_time',{p_clock:v});}
export async function adminAction(action,element){
 const f=selectedFixture();if(!f)return toast('Non hai xornada dispoñible',true);
 // A change to the fixture, its data or its participants invalidates any older preview.
 if(['update-kickoff','update-end','save-callups','add-junior'].includes(action)){
   state.adminPreview=null;state.adminPreviewRows=null;
 }
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
  case 'set-launch-check':{
    const key=element?.dataset.launchKey,verified=element?.dataset.launchVerified==='true';
    const note=val('launch-note-'+key).trim();
    if(!key)throw Error('Non se seleccionou ningunha comprobación');
    if(note.length<12)throw Error('Explica a verificación ou a revogación (mínimo 12 caracteres)');
    if(!verified&&!confirm('Revogar esta comprobación do lanzamento?'))return false;
    await rpc('fantasy_set_launch_check',{
      p_season:state.data.season.id,p_key:key,p_verified:verified,p_note:note
    });
    break;
   }
  case 'activate-season':await rpc('fantasy_activate_season',{p_season:state.data.season.id});break;
  case 'update-kickoff':await rpc('fantasy_set_kickoff',{p_fixture:f.id,p_time:await localToIso(val('kickoff-time')),p_reason:val('kickoff-reason')});break;
  case 'update-end':await rpc('fantasy_set_end',{p_fixture:f.id,p_time:await localToIso(val('end-time')),p_won:val('end-won')==='true'});break;
  case 'save-callups':await rpc('fantasy_set_callups',{p_fixture:f.id,p_players:[...document.querySelectorAll('.callup-box:checked')].map(x=>x.value)});break;
  case 'save-stats':{
    const rows=statsDraft();
    await rpc('fantasy_save_stats',{p_fixture:f.id,p_rows:rows});
    state.importRows=null;state.rawPdf='';state.adminPreview=null;state.adminPreviewRows=null;break;
  }
  case 'preview-round':{
    const rows=f.status==='finalized'?statsDraft():null;
    const preview=await rpc('fantasy_preview_fixture',{p_fixture:f.id,p_rows:rows});
    state.adminPreview=preview;state.adminPreviewRows=rows;
    const holder=document.getElementById('admin-preview-results');
    if(holder)holder.innerHTML=previewHtml(preview);
    toast('Vista previa calculada: revisa puntuacións e prezos');return false;
  }
  case 'publish-round':
    if(state.adminPreview?.fixture_id!==f.id||state.adminPreviewRows!==null)
      throw Error('Primeiro debes calcular e revisar a vista previa desta xornada');
    if(!confirm('Publicar definitivamente os puntos, prezos e clasificación da xornada?'))return false;
    await rpc('fantasy_publish_fixture',{p_fixture:f.id});
    state.adminPreview=null;state.adminPreviewRows=null;break;
  case 'correct-round':{
    const rows=statsDraft(),reason=val('correction-reason').trim();
    if(f.status!=='finalized')throw Error('Esta xornada non está publicada');
    if(state.adminPreview?.fixture_id!==f.id||JSON.stringify(rows)!==JSON.stringify(state.adminPreviewRows))
      throw Error('Calcula primeiro a vista previa cos mesmos datos que queres rectificar');
    if(reason.length<10)throw Error('Indica un motivo de polo menos 10 caracteres');
    if(!confirm('Rectificar definitivamente a xornada '+f.round_number+' e rexistrar os cambios?'))return false;
    await rpc('fantasy_correct_fixture',{p_fixture:f.id,p_rows:rows,p_reason:reason});
    state.adminPreview=null;state.adminPreviewRows=null;break;
  }
  case 'load-participants':{
    state.adminMembers=await rpc('fantasy_admin_participants',{p_club:state.data.club.id});
    const holder=document.getElementById('admin-participants-results');
    if(holder)holder.innerHTML=memberHtml(state.adminMembers);
    return false;
  }
  case 'update-member':{
    const uid=element?.dataset.user,role=document.querySelector('[data-member-role="'+uid+'"]')?.value,
      linked=document.querySelector('[data-member-player="'+uid+'"]')?.value||null;
    if(!uid||!role)throw Error('Selecciona un participante');
    if(!confirm('Gardar o rol e a vinculación desta conta?'))return false;
    await rpc('fantasy_admin_update_participant',{p_club:state.data.club.id,p_user:uid,p_role:role,p_player:linked});
    state.adminMembers=null;break;
  }
  case 'revoke-member':{
    const uid=element?.dataset.user,m=state.adminMembers?.find(x=>x.user_id===uid);
    if(!uid||!m)throw Error('Selecciona unha conta');
    if(!confirm('Retirar a '+m.email+' o acceso ao club? A conta de autenticación non será eliminada.'))return false;
    await rpc('fantasy_admin_revoke_participant',{p_club:state.data.club.id,p_user:uid});
    state.adminMembers=null;break;
  }
  case 'export-snapshot':{
    const data=await rpc('fantasy_admin_export',{p_club:state.data.club.id});
    const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob);
    const link=document.createElement('a');
    link.href=url;link.download='fantasy-redeiras-export-'+new Date().toISOString().slice(0,10)+'.json';
    document.body.appendChild(link);link.click();link.remove();
    setTimeout(()=>URL.revokeObjectURL(url),5000);
    toast('Exportación descargada. Gárdaa nun lugar seguro.');return false;
  }
  case 'add-junior':await rpc('fantasy_add_junior',{p_season:state.data.season.id,p_name:val('junior-name'),p_positions:val('junior-positions').split(',').map(x=>x.trim().toUpperCase()).filter(Boolean),p_price:Number(val('junior-price')),p_from_round:Number(val('junior-round'))});break;
  case 'send-invite':{
    const email=val('invite-email').trim(),role=val('invite-role'),linkedPlayer=val('invite-player')||null;const privacyVerified=!!document.getElementById('invite-privacy')?.checked; if(!privacyVerified)throw Error('Confirma a verificación de privacidade antes de invitar');
    const {data,error}=await state.client.functions.invoke('invite-user',{body:{clubId:state.data.club.id,email,role,linkedPlayer,privacyVerified}});
    if(error){
      // Supabase FunctionsHttpError wraps a non-2xx JSON body. Surface the
      // server's actionable message rather than a generic HTTP error.
      let details=null;
      try{details=await error.context?.clone?.().json();}catch{}
      const message=typeof details?.error==='string'?details.error:null;
      throw Error(message||'Non se puido enviar a invitación: '+error.message);
    }
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
