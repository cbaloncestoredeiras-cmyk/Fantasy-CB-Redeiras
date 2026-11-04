import {euro,pts,escapeHtml as h,byId,validateLineup,transferPlan,brokerEstimate,pickUpcoming,parseDelimited,rowsFromTable} from './logic.js';

const cfg=window.FANTASY_CONFIG||{};
const root=document.querySelector('#root');
const state={client:null,session:null,page:'home',data:null,draft:[],search:'',filter:'all',modal:null,rawPdf:'',importRows:null,loading:false};
const LOGO='<span class="brand-icon">R<span>.</span></span>';
const NAV=[['home','⌂','Inicio'],['market','◫','Mercado'],['team','▣','O meu equipo'],['ranking','♛','Clasificación'],['calendar','▦','Calendario'],['vote','✦','Votación'],['admin','⚙','Administración']];
function toast(message,error=false){document.querySelector('.toast')?.remove();const div=document.createElement('div');div.className='toast'+(error?' error':'');div.textContent=message;document.body.append(div);setTimeout(()=>div.remove(),6000);}
const dateText=(v,opts={day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})=>v?new Intl.DateTimeFormat('gl-ES',{timeZone:'Europe/Madrid',...opts}).format(new Date(v)):'Horario por confirmar';
const euroShort=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format((n||0)/1000000)+' M€';
const admin=()=>state.data?.role==='admin';
const current=()=>pickUpcoming(state.data.fixtures,state.data.season);
const player=(id)=>state.data?.playerMap[id];
const prices=()=>state.data?.prices||{};
const option=(value,label,selected='')=>'<option value="'+h(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+h(label)+'</option>';
const pageHeader=(title,subtitle='',extras='')=>'<div class="heading"><div><span class="eyebrow">FANTASY CB REDEIRAS / 2026-27</span><h1>'+h(title)+'</h1><p>'+h(subtitle)+'</p></div>'+extras+'</div>';
const panel=(content,extra='')=>'<section class="panel '+extra+'">'+content+'</section>';
const empty=(message,emoji='◌')=>'<div class="empty-state"><div class="symbol">'+emoji+'</div>'+h(message)+'</div>';
const person=(p)=>'<div class="person"><span class="playerlogo">'+h(p.name.slice(0,2).toUpperCase())+'</span><div><b>'+h(p.name)+'</b><div class="mini muted">'+h(p.positions.join(' · '))+'</div></div></div>';
const friendlyError=(error)=>error?.message||String(error||'Erro descoñecido');
async function rpc(name,args){const {data,error}=await state.client.rpc(name,args);if(error)throw error;return data;}
async function query(table,columns='*',filter=()=>{}){const r=await filter(state.client.from(table).select(columns));if(r.error)throw r.error;return r.data||[];}

function renderAuth(){
 const good=!!(cfg.url&&cfg.key);
 root.innerHTML='<div class="auth-page"><section class="auth-art"><div class="brand">'+LOGO+'<div><b>FANTASY REDEIRAS</b><small>O XOGO DO NOSO CLUB</small></div></div><h1>O teu quinteto.<br>A túa estratexia.</h1><p>Constrúe o teu equipo con 6 millóns virtuais, segue o bróker e compite cos demais redeiristas. Acceso gratuíto e por invitación.</p><div class="actions"><span class="tag">18 xogadores</span><span class="tag">5 no quinteto</span><span class="tag">3 cambios/xornada</span></div></section><section class="auth-form"><div class="panel"><span class="eyebrow">TEMPADA 2026/27</span><h2>Entra no Fantasy</h2><p>Usa o correo ao que recibiches a invitación. Enviaremos unha ligazón de acceso segura.</p>'+(!good?'<div class="notice">Infraestrutura preparada, pero falta configurar a clave pública de Supabase en Cloudflare. O rexistro aínda non está operativo.</div>':'<form id="auth"><div class="field"><label>Correo electrónico</label><input name="email" type="email" required autocomplete="email" placeholder="nome@exemplo.com"></div><button class="btn primary full" type="submit">Enviar ligazón de acceso →</button></form>')+'<p class="mini">Só persoas invitadas polo CB Redeiras. Sen apostas nin premios económicos.</p><hr class="separator"><div class="actions"><a href="legal.html">Aviso legal e privacidade</a></div></div></section></div>';
}
function renderForbidden(){
 root.innerHTML='<div class="auth-page"><section class="auth-art"><div class="brand">'+LOGO+'<div><b>FANTASY REDEIRAS</b><small>ÁREA DE PARTICIPANTES</small></div></div><h1>Acceso por invitación.</h1><p>A túa conta está autenticada, pero aínda non está autorizada no club.</p></section><div class="auth-form"><div class="panel"><h2>Pendente de activación</h2><p>O administrador do CB Redeiras debe asociar a túa conta á competición. Contacta con cbaloncestoredeiras@gmail.com.</p><button class="btn full" data-action="logout">Saír</button></div></div></div>';
}
function shell(body){
 const d=state.data,{pending,open}=current(),hasTeam=!!d.team;
 const status=open?'Mercado aberto':'Mercado pechado';
 const nav= NAV.filter(n=>n[0]!=='admin'||admin());
 root.innerHTML='<div class="layout"><aside class="sidebar"><div class="brand">'+LOGO+'<div><b>FANTASY</b><small>CB REDEIRAS</small></div></div><div class="navgroup">COMPETICIÓN</div>'+nav.map(n=>'<button class="nav '+(state.page===n[0]?'active':'')+'" data-page="'+n[0]+'"><span class="sym">'+n[1]+'</span>'+n[2]+(n[0]==='team'&&!hasTeam?'<span class="smallmark">NOVO</span>':'')+'</button>').join('')+'<div class="sidefoot"><b>'+h(d.alias||'Participante')+'</b><small>'+h(state.session.user.email)+'</small><button data-action="logout">Pechar sesión</button></div></aside><div class="content"><header class="topbar"><div><span class="eyebrow">XORNADA '+h(pending?.round_number||'—')+'</span><b>'+h(pending?.opponent||'CB Redeiras')+'</b></div><div class="topright"><span class="pill '+(open?'':'negative')+'">'+status+'</span><span class="avatar">'+h((d.alias||'R').slice(0,1).toUpperCase())+'</span></div></header><main class="container">'+body+'<footer class="foot">© CB Redeiras · Competición gratuíta · Prezos virtuais <a href="legal.html">Legal e privacidade</a></footer></main></div><nav class="mobilebar">'+nav.filter(x=>x[0]!=='vote'&&x[0]!=='admin').map(n=>'<button class="'+(state.page===n[0]?'active':'')+'" data-page="'+n[0]+'"><span>'+n[1]+'</span>'+n[2]+'</button>').join('')+'</nav></div>';
}

function home(){
 const d=state.data,{pending,open}=current();
 const total=d.team?Number(d.leaderboard.find(t=>t.team_id===d.team.id)?.total_points||0):0;
 const budget=d.team?d.team.cash:6000000;
 return pageHeader('Benvido ao Fantasy','Toda a competición do CB Redeiras nun só lugar.',
 '<div class="actions"><button class="btn primary" data-page="market">Ir ao mercado →</button></div>')+
 '<div class="hero"><div><span class="eyebrow" style="color:#9bdcff">TEMPADA 26/27 · XORNADA '+h(pending?.round_number||5)+'</span><h2>Non se gaña só cos nomes.</h2><p>Constrúe o teu quinteto con cabeza, atopa xogadores infravalorados e fai crecer o teu equipo co bróker.</p><button class="btn primary" data-page="'+(d.team?'team':'market')+'">'+(d.team?'Ver o meu quinteto':'Crear o meu quinteto')+' →</button></div><div class="hero-graphic">◉</div></div>'+
 '<div class="grid four" style="margin:18px 0">'+[
 ['Orzamento inicial','6 M€','Por equipo'],['O teu efectivo',euroShort(budget),'Dispoñible para fichar'],['Puntuación total',pts(total),'Puntos Fantasy'],['Xogadores no mercado',String(d.players.length),'Inclúe juniors']
 ].map(k=>panel('<div class="kpi-label">'+k[0]+'</div><div class="kpi">'+k[1]+'</div><div class="kpi-caption">'+k[2]+'</div>')).join('')+'</div>'+
 '<div class="grid two">'+panel('<h2>Próximo partido</h2>'+(pending?'<div class="row"><div><span class="tag">'+(pending.is_home?'NA CASA':'FÓRA')+'</span><h2 style="margin:12px 0 6px">CB Redeiras · '+h(pending.opponent)+'</h2><p>'+dateText(pending.starts_at)+'</p></div><span class="pill '+(open?'':'negative')+'">'+(open?'Fichaxes dispoñibles':'Agarda aos resultados')+'</span></div>':empty('Non hai xornadas pendentes')))+
 panel('<h2>Clasificación · Top 5</h2>'+(d.leaderboard.length?d.leaderboard.slice(0,5).map(x=>'<div class="row" style="padding:9px 0;border-bottom:1px solid #edf2f5"><b>'+x.position+'. '+h(x.team_name)+'</b><span>'+pts(x.total_points)+' pts</span></div>').join(''):empty('Aínda non hai equipos inscritos','♙'))+'<button class="btn secondary" data-page="ranking" style="margin-top:14px">Ver toda a clasificación</button>')+'</div>';
}
function marketTable(){
 const d=state.data;
 const list=d.players.filter(p=>(state.filter==='all'||p.positions.includes(state.filter)||(state.filter==='junior'&&p.category==='junior'))&&p.name.toLowerCase().includes(state.search.toLowerCase())).sort((a,b)=>(prices()[b.id]||0)-(prices()[a.id]||0));
 const draft=state.draft;
 return '<div class="tablewrap"><table class="table"><thead><tr><th>Xogador</th><th>Posicións</th><th class="num">Prezo</th><th class="num">Acción</th></tr></thead><tbody>'+list.map(p=>'<tr><td>'+person(p)+'</td><td><span class="tag '+(p.category==='junior'?'junior':'')+'">'+(p.category==='junior'?'JÚNIOR · ':'')+h(p.positions.join(' / '))+'</span></td><td class="num"><b>'+euroShort(prices()[p.id])+'</b></td><td class="num"><div class="actions" style="justify-content:flex-end"><button class="btn small secondary" data-player="'+p.id+'">Detalles</button><button class="btn small '+(draft.includes(p.id)?'danger':'primary')+'" data-action="toggle" data-id="'+p.id+'">'+(draft.includes(p.id)?'Quitar':'Fichar')+'</button></div></td></tr>').join('')+'</tbody></table></div>';
}
function market(){
 const d=state.data,{pending,open}=current();
 const isFirst=!d.team, summary=validateLineup(state.draft,d.playerMap,prices());
 const plan=d.team?transferPlan(d.roster,state.draft,d.team.cash,prices()):{cashAfter:6000000-summary.cost,changes:0};
 const used=d.transfers.filter(t=>t.round_number===pending?.round_number).length;
 const remaining=3-used-plan.changes;
 const legal=summary.valid&&plan.cashAfter>=0&&(!d.team||remaining>=0);
 return pageHeader('Mercado de fichaxes','Compara prezos, elixe cinco xogadores e xestiona o teu bróker.')+
 '<div class="grid three" style="margin-bottom:17px">'+[
 ['Orzamento dispoñible',euroShort(isFirst?6000000:d.team.cash),'Saldo antes dos cambios'],
 ['Quinteto seleccionado',state.draft.length+' / 5','Mínimo 1 BA e 1 AP/P'],
 ['Cambios restantes',isFirst?'3':String(Math.max(0,3-used)),'Por xornada']
 ].map(k=>panel('<div class="kpi-label">'+k[0]+'</div><div class="kpi">'+k[1]+'</div><div class="kpi-caption">'+k[2]+'</div>')).join('')+'</div>'+
 '<div class="grid two" style="grid-template-columns:minmax(0,1.7fr) minmax(280px,.9fr)"><section class="panel"><div class="row"><h2>Plantel de xogadores</h2><span class="tag">'+d.players.length+' dispoñibles</span></div><div class="toolbar"><input id="search" placeholder="Buscar xogador…" value="'+h(state.search)+'"/><select id="pos-filter">'+[['all','Todas as posicións'],['BA','Bases'],['ES','Escoltas'],['AL','Aleros'],['AP','Ala-pivotes'],['P','Pivotes'],['junior','Juniors']].map(v=>option(...v,state.filter)).join('')+'</select></div><div id="market-table">'+marketTable()+'</div></section>'+
 '<aside class="panel"><h2>O teu quinteto</h2><div class="stack">'+state.draft.map(id=>{const p=player(id);return p?'<div class="playeritem">'+person(p)+'<div class="actions"><b>'+euroShort(prices()[id])+'</b><button class="btn small secondary" data-action="toggle" data-id="'+id+'">×</button></div></div>':''}).join('')+Array.from({length:Math.max(0,5-state.draft.length)},()=>'<div class="playeritem" style="color:#a0b1ba;border-style:dashed">＋ Praza libre</div>').join('')+'</div><hr class="separator">'+
 '<div class="row"><span class="muted mini">Custo de selección</span><b>'+euroShort(summary.cost)+'</b></div><div class="row" style="margin-top:10px"><span class="muted mini">Efectivo tras confirmar</span><b style="color:'+(plan.cashAfter<0?'var(--bad)':'var(--good)')+'">'+euroShort(plan.cashAfter)+'</b></div>'+
 '<div class="metricbar" style="margin-top:12px"><span style="width:'+Math.min(100,summary.cost/(isFirst?6000000:(d.team.cash+ d.roster.reduce((n,id)=>n+(prices()[id]||0),0)))*100)+'%"></span></div>'+
 '<p class="help">Un BA e un interior AP/P en dous xogadores diferentes. Máximo 3 fichaxes por xornada.</p>'+
 (summary.errors.length?'<div class="notice">'+summary.errors.map(h).join(' · ')+'</div>':'')+
 (plan.cashAfter<0?'<div class="notice error">Fáltanche '+euro(-plan.cashAfter)+'</div>':'')+
 (!open?'<div class="notice">Mercado pechado. Podes simular o quinteto, pero non confirmar fichaxes ata que se publiquen as estatísticas e os prezos.</div>':'')+
 (isFirst?'<div class="field" style="margin:17px 0"><label>Nome do teu equipo</label><input id="team-name" maxlength="40" placeholder="Ex.: Redeiras de Ouro" autocomplete="off"></div>':'<p class="mini muted">Cambios novos nesta simulación: '+plan.changes+' · Xa gastados: '+used+'</p>')+
 '<button class="btn primary full" data-action="save-lineup" '+(!legal||!open?'disabled':'')+'>'+ (isFirst?'Crear equipo':'Confirmar fichaxes')+' →</button></aside></div>';
}
function team(){
 const d=state.data;if(!d.team)return pageHeader('O meu equipo','Prepara o teu primeiro quinteto.')+panel(empty('Aínda non creaches un equipo. Vai ao mercado para escoller os teus cinco xogadores.','♙')+'<button class="btn primary" data-page="market">Abrir mercado</button>');
 const roster=d.roster.map(x=>player(x)).filter(Boolean),sum=roster.reduce((n,p)=>n+(prices()[p.id]||0),0);
 return pageHeader(d.team.name,'O teu cinco inicial, o efectivo e a evolución do equipo.','<button class="btn primary" data-page="market">Facer cambios →</button>')+
 '<div class="grid three" style="margin-bottom:17px">'+[
 ['Valor de mercado',euroShort(sum),'Valor actual do teu quinteto'],['Efectivo',euroShort(d.team.cash),'Dispoñible para fichaxes'],['Patrimonio total',euroShort(sum+d.team.cash),'Valor do equipo + saldo']
 ].map(k=>panel('<div class="kpi-label">'+k[0]+'</div><div class="kpi">'+k[1]+'</div><div class="kpi-caption">'+k[2]+'</div>')).join('')+'</div>'+
 panel('<h2>O meu quinteto</h2><div class="roster-list">'+roster.map(p=>'<div class="roster-card"><div class="playerlogo">'+h(p.name.slice(0,2).toUpperCase())+'</div><b>'+h(p.name)+'</b><div class="small">'+h(p.positions.join(' / '))+'</div><div class="small" style="color:#146f94;font-weight:800">'+euroShort(prices()[p.id])+'</div><button class="btn small secondary" data-player="'+p.id+'" style="margin-top:12px">Perfil</button></div>').join('')+'</div>')+
 '<div class="grid two" style="margin-top:17px">'+panel('<h2>Normas</h2><p>Cinco xogadores · Mínimo un base e un interior · Tres transferencias por xornada. Os cambios confírmanse só co mercado aberto.</p>')+
 panel('<h2>Historial de fichaxes</h2>'+(d.transfers.length?d.transfers.slice().reverse().slice(0,8).map(t=>'<div class="mini" style="margin:8px 0">X'+t.round_number+': '+h(player(t.sold_player_id)?.name||'?')+' → '+h(player(t.bought_player_id)?.name||'?')+'</div>').join(''):empty('Aínda non fixeches transferencias','⇄'))+'</div>';
}
function ranking(){
 const d=state.data;return pageHeader('Clasificación xeral','A puntuación acumúlase coas valoracións publicadas de cada xornada.')+
 panel('<h2>Equipos participantes</h2><div class="tablewrap"><table class="table"><thead><tr><th>#</th><th>Equipo Fantasy</th><th>Mánager</th><th class="num">Puntos</th></tr></thead><tbody>'+d.leaderboard.map(t=>'<tr><td><b>'+t.position+'</b></td><td><b>'+h(t.team_name)+'</b>'+(d.team?.id===t.team_id?' <span class="tag good">TI</span>':'')+'</td><td>'+h(t.manager_alias)+'</td><td class="num"><b>'+pts(t.total_points)+'</b></td></tr>').join('')+'</tbody></table></div>'+(d.leaderboard.length?'':empty('Aínda non hai puntuacións nin equipos','♛')) );
}
function calendar(){
 const d=state.data,{pending}=current();return pageHeader('Calendario de partidos','Os horarios definitivos confírmanse cada martes e poden cambiar.')+
 panel('<h2>Primeira fase · 2026/27</h2><div class="schedule">'+d.fixtures.map(f=>'<div class="match"><div class="date">X'+f.round_number+'</div><div style="flex:1"><strong>CB Redeiras · '+h(f.opponent)+'</strong><small>'+(f.is_home?'Na casa':'Fóra')+' · '+h(f.status.replaceAll('_',' '))+'</small></div><div><b class="mini">'+dateText(f.starts_at)+'</b>'+(f.id===pending?.id?' <span class="tag">PRÓXIMA</span>':'')+'</div></div>').join('')+'</div>');
}
function voting(){
 const d=state.data,usable=d.fixtures.filter(f=>f.ended_at&&new Date(f.ended_at).getTime()<Date.now()+1000&&new Date(f.ended_at).getTime()+72*3600e3>Date.now()&&d.eligibleFixtures.includes(f.id));
 return pageHeader('Votación do vestiario','Os convocados poden dar 3, 2 e 1 punto a tres compañeiros. Non se permite o autovoto.')+
 (usable.length?usable.map(f=>panel('<h2>Votación · Xornada '+f.round_number+'</h2><p>Prazo ata '+dateText(new Date(new Date(f.ended_at).getTime()+72*3600e3).toISOString())+'. Os votos permanecen privados ata pechar.</p><div class="vote-grid">'+[3,2,1].map(w=>'<div class="field"><label>'+w+' puntos</label><select id="vote-'+w+'">'+option('','Escoller xogador')+d.callups.filter(c=>c.fixture_id===f.id&&c.player_id!==d.linkedPlayer).map(c=>option(c.player_id,player(c.player_id)?.name||'?')).join('')+'</select></div>').join('')+'</div><button class="btn primary" data-action="vote" data-fixture="'+f.id+'" style="margin-top:18px">Enviar votación</button>') ).join(''):panel(empty('Non tes votacións abertas. Só os xogadores convocados poden votar durante as 72 h posteriores ao partido.','✦')));
}

export {state,renderAuth,renderForbidden,shell,home,market,marketTable,team,ranking,calendar,voting,toast,rpc,query,admin,current,player,prices,h,dateText,panel,pageHeader,person,option,euroShort};
