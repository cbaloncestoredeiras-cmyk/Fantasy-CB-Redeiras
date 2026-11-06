import {euro,pts,escapeHtml as h,byId,validateLineup,transferPlan,brokerEstimate,pickUpcoming,parseDelimited,rowsFromTable} from './logic.js';
import {formBadge,compareButton,comparisonPanel} from './insights-view.js';
import {simulatorPanel,idealTeamPanel} from './strategy-view.js';
import {homeExperience,guidePage} from './experience.js';

const cfg=window.FANTASY_CONFIG||{};
const root=document.querySelector('#root');
const state={client:null,session:null,page:'home',data:null,draft:[],search:'',filter:'all',compareIds:[],rankRound:'general',guideStep:0,installHelp:false,modal:null,rawPdf:'',importRows:null,loading:false,authMode:'password',recoveringPassword:false,mobileMenuOpen:false};
const LOGO='<img class="brand-emblem" src="assets/redeiras-logo.webp" alt="Escudo do CB Redeiras">';
const NAV=[['home','⌂','Inicio'],['market','◫','Mercado'],['team','▣','O meu equipo'],['ranking','♛','Clasificación'],['calendar','▦','Calendario'],['vote','✦','Votación'],['guide','?','Guía'],['admin','⚙','Administración']];
function toast(message,error=false){document.querySelector('.toast')?.remove();const div=document.createElement('div');div.className='toast'+(error?' error':'');div.textContent=message;document.body.append(div);setTimeout(()=>div.remove(),6000);}
const dateText=(v,opts={day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})=>v?new Intl.DateTimeFormat('gl-ES',{timeZone:'Europe/Madrid',...opts}).format(new Date(v)):'Horario por confirmar';
const euroShort=n=>new Intl.NumberFormat('es-ES',{maximumFractionDigits:2}).format((n||0)/1000000)+' M€';
const admin=()=>state.data?.role==='admin';
const current=()=>{const result=pickUpcoming(state.data.fixtures,state.data.season);return {...result,open:Boolean(state.data.season?.active&&result.open)};};
const player=(id)=>state.data?.playerMap[id];
const prices=()=>state.data?.prices||{};
const option=(value,label,selected='')=>'<option value="'+h(value)+'"'+(String(value)===String(selected)?' selected':'')+'>'+h(label)+'</option>';
const pageHeader=(title,subtitle='',extras='')=>'<div class="heading"><div><span class="eyebrow">FANTASY CB REDEIRAS / 2026-27</span><h1>'+h(title)+'</h1><p>'+h(subtitle)+'</p></div>'+extras+'</div>';
const panel=(content,extra='')=>'<section class="panel '+extra+'">'+content+'</section>';
const empty=(message,emoji='◌')=>'<div class="empty-state"><div class="symbol">'+emoji+'</div>'+h(message)+'</div>';
const playerAvatar=(p,extra='')=>{
 const url=state.data?.photoUrls?.[p.id];
 return '<span class="playerlogo '+h(extra)+'">'+(url?'<img class="playerphoto" loading="lazy" alt="Foto de '+h(p.name)+'" src="'+h(url)+'">':h(p.name.slice(0,2).toUpperCase()))+'</span>';
};
const person=(p)=>'<div class="person">'+playerAvatar(p)+'<div><b>'+h(p.name)+'</b><div class="mini muted">'+h(p.positions.join(' · '))+'</div></div></div>';
const friendlyError=(error)=>error?.message||String(error||'Erro descoñecido');
async function rpc(name,args){const {data,error}=await state.client.rpc(name,args);if(error)throw error;return data;}
async function query(table,columns='*',filter=()=>{}){const r=await filter(state.client.from(table).select(columns));if(r.error)throw r.error;return r.data||[];}

function renderAuth(){
 const good=!!(cfg.url&&cfg.key);
 const mode=state.authMode||'password';
 const title=mode==='setup'?'Crear contrasinal':mode==='reset'?'Recuperar contrasinal':'Entra no Fantasy';
 const description=mode==='setup'?'Xa recibiches unha invitación? Solicita unha ligazón de correo para crear a túa primeira contrasinal.':mode==='reset'?'Enviarémosche unha ligazón para establecer unha contrasinal nova.':'Introduce o correo da túa invitación e a túa contrasinal para acceder.';
 const emailField='<div class="field"><label for="auth-email">Correo electrónico</label><input id="auth-email" name="email" type="email" required autocomplete="email" placeholder="nome@exemplo.com"></div>';
 const passwordField='<div class="field"><label for="auth-password-input">Contrasinal</label><input id="auth-password-input" name="password" type="password" required autocomplete="current-password" placeholder="A túa contrasinal" minlength="8"></div>';
 const primary=mode==='setup'?'Enviar ligazón para crear contrasinal':mode==='reset'?'Enviar correo de recuperación':'Iniciar sesión';
 const form=mode==='setup'?'auth-setup':mode==='reset'?'auth-reset':'auth-password';
 const extras=mode==='password'
   ?'<div class="auth-extras"><button type="button" class="auth-link" data-auth-mode="reset">Esqueciches a contrasinal?</button><button type="button" class="auth-link" data-auth-mode="setup">Primeiro acceso ou sen contrasinal?</button></div>'
   :'<div class="auth-extras"><button type="button" class="auth-link" data-auth-mode="password">Volver a iniciar sesión</button></div>';
 root.innerHTML='<div class="auth-page"><section class="auth-art"><div class="brand">'+LOGO+'<div><b>FANTASY REDEIRAS</b><small>O XOGO DO NOSO CLUB</small></div></div><h1>O teu quinteto.<br>A túa estratexia.</h1><p>Constrúe o teu equipo con 6 millóns virtuais, segue o bróker e compite cos demais redeiristas. Acceso gratuíto e por invitación.</p><div class="actions"><span class="tag">18 xogadores</span><span class="tag">5 no quinteto</span><span class="tag">3 cambios/xornada</span></div></section><section class="auth-form"><div class="panel"><span class="eyebrow">TEMPADA 2026/27</span><h2>'+title+'</h2><p>'+description+'</p>'+(!good?'<div class="notice">Falta configurar a conexión segura co servidor.</div>':'<form id="'+form+'" class="auth-fields">'+emailField+(mode==='password'?passwordField:'')+'<button class="btn primary full" type="submit">'+primary+' →</button><div class="auth-feedback" role="status" aria-live="polite" hidden></div></form>'+extras)+'<p class="mini">Só persoas invitadas polo CB Redeiras. Sen apostas nin premios económicos.</p><hr class="separator"><div class="actions"><a href="legal.html">Aviso legal e privacidade</a></div></div></section></div>';
}
function securityPage(){
 return pageHeader(state.recoveringPassword?'Recupera a contrasinal':'Contrasinal da conta',
   'Establece ou actualiza a túa contrasinal para poder iniciar sesión sen recibir unha ligazón cada vez.')+
 panel('<form id="auth-set-password" class="auth-fields" style="max-width:450px"><div class="field"><label for="security-new-password">Nova contrasinal</label><input id="security-new-password" type="password" name="password" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="Mínimo 10 caracteres"></div><div class="field"><label for="security-confirm-password">Confirmar contrasinal</label><input id="security-confirm-password" type="password" name="confirm" autocomplete="new-password" minlength="10" maxlength="128" required placeholder="Repite a contrasinal"></div><p class="help">Usa unha contrasinal única de polo menos 10 caracteres. Nunca compartas a túa contrasinal co club.</p><button class="btn primary" type="submit">Gardar contrasinal</button></form>');
}
function renderForbidden(){
 root.innerHTML='<div class="auth-page"><section class="auth-art"><div class="brand">'+LOGO+'<div><b>FANTASY REDEIRAS</b><small>ÁREA DE PARTICIPANTES</small></div></div><h1>Acceso por invitación.</h1><p>A túa conta está autenticada, pero aínda non está autorizada no club.</p></section><div class="auth-form"><div class="panel"><h2>Pendente de activación</h2><p>O administrador do CB Redeiras debe asociar a túa conta á competición. Contacta con cbaloncestoredeiras@gmail.com.</p><button class="btn full" data-action="logout">Saír</button></div></div></div>';
}
function shell(body){
 const d=state.data,{pending,open}=current(),hasTeam=!!d.team;
 const status=open?'Mercado aberto':'Mercado pechado';
 const nav=NAV.filter(n=>n[0]!=='admin'||admin());
 const mobilePrimary=nav.filter(n=>['home','market','team','ranking'].includes(n[0]));
 const mobileSecondary=nav.filter(n=>['calendar','vote','guide','admin'].includes(n[0]));
 const moreActive=['calendar','vote','guide','admin','security'].includes(state.page);
 const navButton=n=>'<button type="button" class="nav '+(state.page===n[0]?'active':'')+'" data-page="'+n[0]+'" aria-label="'+h(n[2])+'" title="'+h(n[2])+'" '+(state.page===n[0]?'aria-current="page"':'')+'><span class="sym" aria-hidden="true">'+n[1]+'</span><span class="nav-label">'+n[2]+'</span>'+(n[0]==='team'&&!hasTeam?'<span class="smallmark">NOVO</span>':'')+'</button>';
 const bottomButton=n=>'<button type="button" class="'+(state.page===n[0]?'active':'')+'" data-page="'+n[0]+'" '+(state.page===n[0]?'aria-current="page"':'')+'><span aria-hidden="true">'+n[1]+'</span>'+n[2]+'</button>';
 const moreMenu=
 '<div class="mobile-more-backdrop" data-overlay="mobile-more" '+(state.mobileMenuOpen?'':'hidden')+'><section class="mobile-more-sheet" role="dialog" aria-modal="true" aria-labelledby="mobile-more-title"><div class="row"><h2 id="mobile-more-title">Máis opcións</h2><button type="button" class="btn secondary menuclose" data-action="close-more" aria-label="Pechar menú">Pechar ×</button></div><nav class="mobile-more-links" aria-label="Outras seccións">'+mobileSecondary.map(n=>'<button type="button" data-page="'+n[0]+'" class="mobile-more-link '+(state.page===n[0]?'active':'')+'"><span aria-hidden="true">'+n[1]+'</span>'+n[2]+'</button>').join('')+'</nav><hr class="separator"><div class="mobile-account"><div><b>'+h(d.alias||'Participante')+'</b><small>'+h(state.session.user.email)+'</small></div><div class="actions"><button class="btn secondary" data-action="set-alias">Editar alias</button><button class="btn secondary" data-action="password-page">Contrasinal</button><button class="btn outline" data-action="logout">Saír</button></div></div></section></div>';
 root.innerHTML='<a href="#main-content" class="skip-link">Saltar ao contido principal</a><div class="layout"><aside class="sidebar"><div class="brand">'+LOGO+'<div class="brand-words"><b>FANTASY</b><small>CB REDEIRAS</small></div></div><div class="navgroup">COMPETICIÓN</div><nav class="sidebar-links" aria-label="Navegación principal">'+nav.map(navButton).join('')+'</nav><div class="sidefoot"><b>'+h(d.alias||'Participante')+'</b><small>'+h(state.session.user.email)+'</small><button data-action="set-alias" aria-label="Editar alias" title="Editar alias"><span aria-hidden="true">✎</span> <span class="side-action-label">Editar alias</span></button> <button data-action="password-page" aria-label="Configurar contrasinal" title="Contrasinal"><span aria-hidden="true">⚿</span> <span class="side-action-label">Contrasinal</span></button> <button data-action="logout" aria-label="Pechar sesión" title="Saír"><span aria-hidden="true">↪</span> <span class="side-action-label">Saír</span></button></div></aside><div class="content"><header class="topbar"><div class="topbar-match"><span class="eyebrow">XORNADA '+h(pending?.round_number||'—')+'</span><b>'+h(pending?.opponent||'CB Redeiras')+'</b></div><div class="topright"><span class="pill '+(open?'':'negative')+'">'+status+'</span><button type="button" class="avatar" data-action="password-page" title="Contrasinal da conta" aria-label="Abrir a configuración da conta">'+h((d.alias||'R').slice(0,1).toUpperCase())+'</button></div></header><main id="main-content" tabindex="-1" class="container">'+body+'<footer class="foot">© CB Redeiras · Competición gratuíta · Prezos virtuais <a href="legal.html">Legal e privacidade</a></footer></main></div><nav class="mobilebar" aria-label="Navegación móbil">'+mobilePrimary.map(bottomButton).join('')+'<button type="button" data-action="mobile-more" aria-haspopup="dialog" aria-expanded="'+(state.mobileMenuOpen?'true':'false')+'" class="'+(moreActive?'active':'')+'"><span aria-hidden="true">☰</span>Máis</button></nav>'+moreMenu+'</div>';
}

function home(){
 const d=state.data,{pending,open}=current();
 const total=d.team?Number(d.leaderboard.find(t=>t.team_id===d.team.id)?.total_points||0):0;
 const budget=d.team?d.team.cash:6000000;
 return pageHeader('Benvido ao Fantasy','Toda a competición do CB Redeiras nun só lugar.',
 '<div class="actions"><button class="btn primary" data-page="market">Ir ao mercado →</button></div>')+
 '<div class="hero"><div><span class="eyebrow" style="color:#9bdcff">TEMPADA 26/27 · XORNADA '+h(pending?.round_number||5)+'</span><h2>Non se gaña só cos nomes.</h2><p>Constrúe o teu quinteto con cabeza, atopa xogadores infravalorados e fai crecer o teu equipo co bróker.</p><button class="btn primary" data-page="'+(d.team?'team':'market')+'">'+(d.team?'Ver o meu quinteto':'Crear o meu quinteto')+' →</button></div><div class="hero-graphic"><img class="hero-emblem" src="assets/redeiras-logo.webp" alt=""></div></div>'+
 '<div class="grid four" style="margin:18px 0">'+[
 ['Orzamento inicial','6 M€','Por equipo'],['O teu efectivo',euroShort(budget),'Dispoñible para fichar'],['Puntuación total',pts(total),'Puntos Fantasy'],['Xogadores no mercado',String(d.players.length),'Inclúe juniors']
 ].map(k=>panel('<div class="kpi-label">'+k[0]+'</div><div class="kpi">'+k[1]+'</div><div class="kpi-caption">'+k[2]+'</div>')).join('')+'</div>'+
 '<div class="grid two">'+panel('<h2>Próximo partido</h2>'+(pending?'<div class="row"><div><span class="tag">'+(pending.is_home?'NA CASA':'FÓRA')+'</span><h2 style="margin:12px 0 6px">CB Redeiras · '+h(pending.opponent)+'</h2><p>'+dateText(pending.starts_at)+'</p></div><span class="pill '+(open?'':'negative')+'">'+(open?'Fichaxes dispoñibles':'Agarda aos resultados')+'</span></div>':empty('Non hai xornadas pendentes')))+
 panel('<h2>Clasificación · Top 5</h2>'+(d.leaderboard.length?d.leaderboard.slice(0,5).map(x=>'<div class="row" style="padding:9px 0;border-bottom:1px solid #edf2f5"><b>'+x.position+'. '+h(x.team_name)+'</b><span>'+pts(x.total_points)+' pts</span></div>').join(''):empty('Aínda non hai equipos inscritos','♙'))+'<button class="btn secondary" data-page="ranking" style="margin-top:14px">Ver toda a clasificación</button>')+'</div>'+homeExperience(state);
}
function marketTable(){
 const d=state.data,round=current().pending?.round_number||5;
 const list=d.players.filter(p=>(state.filter==='all'||p.positions.includes(state.filter)||(state.filter==='junior'&&p.category==='junior'))&&p.name.toLowerCase().includes(state.search.toLowerCase())).sort((a,b)=>(prices()[b.id]||0)-(prices()[a.id]||0));
 const draft=state.draft;
 const controls=(p)=>p.available_from_round>round
  ?'<span class="tag warn">Desde X'+p.available_from_round+'</span>'
  :'<button type="button" class="btn small '+(draft.includes(p.id)?'danger':'primary')+'" data-action="toggle" data-id="'+p.id+'" aria-label="'+(draft.includes(p.id)?'Quitar ':'Fichar ')+h(p.name)+'">'+(draft.includes(p.id)?'Quitar':'Fichar')+'</button>';
 if(!list.length)return empty('Non se atoparon xogadores cos filtros seleccionados.','⌕');
 const table='<div class="tablewrap market-tablewrap"><table class="table"><thead><tr><th scope="col">Xogador</th><th scope="col">Posicións</th><th scope="col" class="num">Prezo</th><th scope="col">Forma (3P)</th><th scope="col" class="num">Acción</th></tr></thead><tbody>'+
 list.map(p=>'<tr><td>'+person(p)+'</td><td><span class="tag '+(p.category==='junior'?'junior':'')+'">'+(p.category==='junior'?'JÚNIOR · ':'')+h(p.positions.join(' / '))+'</span></td><td class="num"><b>'+euroShort(prices()[p.id])+'</b></td><td>'+formBadge(d,p.id)+'</td><td class="num"><div class="actions action-right"><button type="button" class="btn small secondary" data-player="'+p.id+'">Detalles</button>'+compareButton(p.id,state.compareIds)+controls(p)+'</div></td></tr>').join('')+'</tbody></table></div>';
 const cards='<ul class="market-cards" aria-label="Xogadores dispoñibles">'+list.map(p=>
 '<li class="market-player-card"><div class="market-player-top">'+person(p)+'<span class="tag '+(p.category==='junior'?'junior':'')+'">'+(p.category==='junior'?'JÚNIOR · ':'')+h(p.positions.join(' / '))+'</span></div>'+
 '<div class="market-player-bottom"><div><span class="kpi-label">Prezo</span><strong>'+euroShort(prices()[p.id])+'</strong>'+formBadge(d,p.id)+'</div><div class="actions"><button type="button" class="btn small secondary" data-player="'+p.id+'">Detalles</button>'+compareButton(p.id,state.compareIds)+controls(p)+'</div></div></li>'
 ).join('')+'</ul>';
 return '<div class="market-results">'+table+cards+'</div>';
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
 '<a class="mobile-draft-link" href="#draft-summary"><span>◫ Ver o teu quinteto</span><strong>'+state.draft.length+' / 5 · '+euroShort(summary.cost)+'</strong></a>'+
 comparisonPanel(d,state.compareIds,person)+simulatorPanel(d,state.draft,pending?.round_number||d.season.start_round,open)+'<div class="grid two market-layout"><section class="panel market-panel"><div class="row"><h2>Plantel de xogadores</h2><span class="tag">'+d.players.length+' dispoñibles</span></div><div class="toolbar"><input id="search" placeholder="Buscar xogador…" value="'+h(state.search)+'"/><select id="pos-filter">'+[['all','Todas as posicións'],['BA','Bases'],['ES','Escoltas'],['AL','Aleros'],['AP','Ala-pivotes'],['P','Pivotes'],['junior','Juniors']].map(v=>option(...v,state.filter)).join('')+'</select></div><div id="market-table">'+marketTable()+'</div></section>'+
 '<aside id="draft-summary" class="panel draft-panel" tabindex="-1"><h2>O teu quinteto</h2><div class="stack">'+state.draft.map(id=>{const p=player(id);return p?'<div class="playeritem">'+person(p)+'<div class="actions"><b>'+euroShort(prices()[id])+'</b><button class="btn small secondary" data-action="toggle" data-id="'+id+'">×</button></div></div>':''}).join('')+Array.from({length:Math.max(0,5-state.draft.length)},()=>'<div class="playeritem" style="color:#a0b1ba;border-style:dashed">＋ Praza libre</div>').join('')+'</div><hr class="separator">'+
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
 panel('<h2>O meu quinteto</h2><div class="roster-list">'+roster.map(p=>'<div class="roster-card">'+playerAvatar(p)+'<b>'+h(p.name)+'</b><div class="small">'+h(p.positions.join(' / '))+'</div><div class="small" style="color:#146f94;font-weight:800">'+euroShort(prices()[p.id])+'</div><button class="btn small secondary" data-player="'+p.id+'" style="margin-top:12px">Perfil</button></div>').join('')+'</div>')+
 '<div class="grid two" style="margin-top:17px">'+panel('<h2>Normas</h2><p>Cinco xogadores · Mínimo un base e un interior · Tres transferencias por xornada. Os cambios confírmanse só co mercado aberto.</p>')+
 panel('<h2>Historial de fichaxes</h2>'+(d.transfers.length?d.transfers.slice().reverse().slice(0,8).map(t=>'<div class="mini" style="margin:8px 0">X'+t.round_number+': '+h(player(t.sold_player_id)?.name||'?')+' → '+h(player(t.bought_player_id)?.name||'?')+'</div>').join(''):empty('Aínda non fixeches transferencias','⇄')))+'</div>';
}
function ranking(){
 const d=state.data;
 const finished=d.fixtures.filter(f=>f.status==='finalized').slice().sort((a,b)=>b.round_number-a.round_number);
 const requested=String(state.rankRound||'general');
 const selected=requested==='general'||!finished.some(f=>String(f.round_number)===requested)?'general':requested;
 const weekly=selected!=='general';
 const rows=weekly?(d.weeklyRanking||[]).filter(t=>String(t.round_number)===selected).map(t=>({
   position:t.position,team_id:t.team_id,team_name:t.team_name,manager_alias:t.manager_alias,total_points:t.round_points
 })):d.leaderboard;
 const table='<div class="tablewrap ranking-tablewrap"><table class="table"><thead><tr><th scope="col">#</th><th scope="col">Equipo Fantasy</th><th scope="col">Mánager</th><th scope="col" class="num">Puntos</th></tr></thead><tbody>'+
  rows.map(t=>'<tr><td><b>'+t.position+'</b></td><td><b>'+h(t.team_name)+'</b>'+(d.team?.id===t.team_id?' <span class="tag good">TI</span>':'')+'</td><td>'+h(t.manager_alias)+'</td><td class="num"><b>'+pts(t.total_points)+'</b></td></tr>').join('')+'</tbody></table></div>';
 const cards='<ol class="ranking-cards" aria-label="Clasificación de equipos">'+rows.map(t=>
  '<li class="ranking-card"><span class="ranking-position">'+t.position+'</span><div class="ranking-names"><b>'+h(t.team_name)+'</b>'+(d.team?.id===t.team_id?' <span class="tag good">TI</span>':'')+'<small>'+h(t.manager_alias)+'</small></div><strong class="ranking-points">'+pts(t.total_points)+'<small>pts</small></strong></li>'
 ).join('')+'</ol>';
 const choose='<div class="ranking-selector"><label for="ranking-round">Ver clasificación</label><select id="ranking-round">'+
  option('general','Xeral',selected)+finished.map(f=>option(String(f.round_number),'X'+f.round_number+' · '+f.opponent,selected)).join('')+'</select></div>';
 const noRows=weekly?'Aínda non hai puntuacións rexistradas para esta xornada.':'Aínda non hai puntuacións nin equipos';
 const error=weekly&&d.weeklyRankingError?'<div class="notice error">Non foi posible cargar a clasificación semanal. Revisa a conexión e actualiza a páxina.</div>':'';
 const idealRound=weekly?Number(selected):finished[0]?.round_number;
 return pageHeader(weekly?'Clasificación · X'+selected:'Clasificación xeral',
  weekly?'Puntos oficiais desta xornada; non dependen do quinteto actual.':'Puntos acumulados de todas as xornadas publicadas.')+
  panel(choose+error+(rows.length?'<div class="ranking-results">'+table+cards+'</div>':empty(noRows,'♛')))+
  idealTeamPanel(d,idealRound,person);
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

export {guidePage,state,renderAuth,renderForbidden,securityPage,shell,home,market,marketTable,team,ranking,calendar,voting,toast,rpc,query,admin,current,player,prices,h,dateText,panel,pageHeader,person,playerAvatar,option,euroShort};
