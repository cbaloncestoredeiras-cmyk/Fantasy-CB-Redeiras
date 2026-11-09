// Reporte exclusivo para administradores con quintetos xa publicados.
// Nunca expón correos nin os quintetos de partidos aínda abertos.
export function uncalledAuditHtml(info,fixtures,selectedFixture,escapeHtml,option){
 const h=escapeHtml;
 const completed=(fixtures||[]).filter(f=>f.status==='finalized')
   .sort((a,b)=>Number(b.round_number)-Number(a.round_number));
 const f=completed.find(x=>x.id===selectedFixture)||completed[0];
 const title='<h2 id="admin-uncalled">Non convocados nos quintetos Fantasy</h2>'+
  '<p class="mini muted">Só administración. Comparamos a convocatoria coa aliñación que quedou pechada na xornada, non coas fichaxes posteriores. Escoller un non convocado non proba por si mesmo un despiste nin unha estratexia.</p>';
 if(!f)return title+'<p class="mini muted">Aínda non hai xornadas publicadas.</p>';
 const controls='<div class="row"><div class="field"><label for="admin-uncalled-fixture">Xornada publicada</label>'+
  '<select id="admin-uncalled-fixture">'+completed.map(row=>option(row.id,'X'+row.round_number+' · '+row.opponent,f.id)).join('')+
  '</select></div><button class="btn secondary" type="button" data-action="refresh-uncalled-audit">Actualizar seleccións</button></div>';
 if(!info||info.fixture_id!==f.id)return title+controls+'<p class="mini muted">A cargar os quintetos gardados…</p>';
 if(info.error)return title+controls+'<p class="notice">Non foi posible consultar as seleccións desta xornada. Proba con «Actualizar seleccións».</p>';
 const players=Array.isArray(info.players)?info.players:[];
 const selected=players.filter(p=>Number(p.pick_count)>0);
 const totals=selected.reduce((n,p)=>n+Number(p.pick_count),0);
 const table=players.map(p=>{
   const amount=Number(p.pick_count)||0;
   const teams=Array.isArray(p.teams)?p.teams:[];
   return '<tr><th scope="row">'+h(p.player_name||'Xogador')+'</th>'+
    '<td>'+amount+'</td><td>'+(teams.length?teams.map(t=>h(t.name)).join(', '):'—')+'</td></tr>';
 }).join('');
 return title+controls+
  '<p class="mini"><b>'+selected.length+' xogadores non convocados seleccionados</b> · '+totals+
  ' seleccións de non convocados · '+Number(info.total_teams||0)+' equipos Fantasy con quinteto gardado.</p>'+
  '<div class="tablewrap"><table class="table"><thead><tr><th scope="col">Xogador non convocado</th><th scope="col">Seleccións</th><th scope="col">Equipos Fantasy</th></tr></thead><tbody>'+
  table+'</tbody></table></div>';
}
