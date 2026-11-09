// Seguimento de participación: datos agregados, nunca destinatarios dos votos.
// A API aplica comprobación de permisos no servidor; a UI só amosa o resultado.
export function voteTrackingHtml(info,fixture,escapeHtml,dateText){
 const h=escapeHtml;
 const heading='<div class="row"><h2 id="admin-votes">Seguimento da votación</h2>'+
   '<button type="button" class="btn secondary" data-action="refresh-vote-tracking">Actualizar votos</button></div>'+
   '<p class="mini muted">Só administración pode comprobar quen emitiu o voto. As eleccións son privadas.</p>';
 if(!fixture)return heading+'<p class="mini muted">Escolle unha xornada.</p>';
 if(info?.fixture_id!==fixture.id)return heading+'<p class="mini muted">A cargar a participación desta xornada…</p>';
 if(info.error)return heading+'<p class="notice">Non foi posible cargar a participación. Preme «Actualizar votos» para reintentar.</p>';
 const eligible=Math.max(0,Number(info.eligible)||0);
 const voted=Math.min(eligible,Math.max(0,Number(info.voted)||0));
 const pending=eligible-voted;
 const callups=Math.max(0,Number(info.callups)||0);
 const notLinked=Math.max(0,callups-eligible);
 const percentage=eligible?Math.round(voted/eligible*100):0;
 const deadline=fixture.ended_at?new Date(fixture.ended_at).getTime()+72*60*60*1000:null;
 const closed=Boolean(fixture.votes_finalized_at)||fixture.status==='finalized';
 const deadlineInfo=closed?'Votación pechada. Xa non se poden modificar as papeletas.'
   :deadline&&Number.isFinite(deadline)
   ?(Date.now()<deadline?'Prazo aberto ata o ':'Prazo rematado o ')+h(dateText(new Date(deadline).toISOString()))
   :'A votación comezará cando se rexistre o final do partido.';
 const coach=info.coach?.enabled===true?info.coach:null;
 const fullParticipation=eligible>0&&voted===eligible&&(!coach||coach.voted===true);
 const withinWindow=deadline&&Number.isFinite(deadline)&&Date.now()>=Date.parse(fixture.ended_at)&&Date.now()<deadline;
 const statsReady=Boolean(fixture.stats_finalized_at)&&fixture.team_won!==null&&fixture.team_won!==undefined;
 const closeAction=!closed&&withinWindow&&fullParticipation&&statsReady
   ?'<div class="notice" style="margin:12px 0">Votación completa (incluído o adestrador, se corresponde). Pódese pechar antes das 72 horas.</div>'+
    '<button type="button" class="btn primary" data-action="close-votes-early">Pechar votación e habilitar vista previa</button>'
   :(!closed&&withinWindow&&fullParticipation&&!statsReady
      ?'<p class="mini muted">Votación completa. Garda primeiro as estatísticas e o resultado para pechala.</p>':'');
 const coachHtml=coach?'<div class="playeritem" style="display:flex;align-items:center;justify-content:space-between;gap:10px;margin:12px 0">'+
   '<b>Voto do adestrador</b><span class="tag '+(coach.voted?'':'warn')+'">'+
   (coach.voted?'Votou':'Pendente')+'</span></div>':'';
 const rows=Array.isArray(info.voters)?info.voters:[];
 const participants=rows.map(v=>'<div class="playeritem" style="display:flex;align-items:center;justify-content:space-between;gap:10px">'+
   '<span>'+h(v.name||'Conta sen xogador asociado')+'</span>'+
   '<span class="tag '+(v.voted?'':'warn')+'">'+(v.voted?'Votou':'Pendente')+'</span></div>').join('');
 return heading+
   '<div class="grid four" style="margin:10px 0 12px">'+
   '<div><div class="kpi-label">Habilitados</div><div class="kpi">'+eligible+'</div></div>'+
   '<div><div class="kpi-label">Votaron</div><div class="kpi">'+voted+'</div></div>'+
   '<div><div class="kpi-label">Pendentes</div><div class="kpi">'+pending+'</div></div>'+
   '<div><div class="kpi-label">Participación</div><div class="kpi">'+percentage+' %</div></div></div>'+
   '<progress value="'+voted+'" max="'+Math.max(1,eligible)+'" style="width:100%" aria-label="Participación na votación"></progress>'+
   '<p class="mini muted">'+deadlineInfo+'</p>'+
   (notLinked?'<p class="mini muted">'+notLinked+' convocado'+(notLinked===1?'':'s')+' sen conta habilitada para votar (non conta'+(notLinked===1?'':'n')+' como pendente'+(notLinked===1?'':'s')+').</p>':'')+
   coachHtml+closeAction+
   (rows.length?'<div class="grid two" style="margin-top:12px">'+participants+'</div>':
    '<p class="mini muted">Aínda non hai contas habilitadas para votar nesta xornada.</p>');
}
