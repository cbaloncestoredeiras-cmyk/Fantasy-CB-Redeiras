# Seguimento administrativo da votación

A sección «Administración → Seguimento da votación» mostra por xornada:
- Convocados con dereito a votar e conta vinculada.
- Votos completos emitidos (tres eleccións por persoa) e votantes pendentes.
- Porcentaxe de participación, prazo de 72 horas e diferenza respecto aos convocados sen conta habilitada.
- Nome deportivo e estado «Votou» ou «Pendente», nunca destinatarios dos votos, puntos atribuídos nin emails.
- Botón «Actualizar votos» para consultar o dato en directo e refresco ao cambiar de xornada.

A API `fantasy_admin_vote_participation(p_fixture uuid)` é `security definer` con `search_path` fixado,
prohibe o acceso sen sesión ou sen rol `admin` no club propietario da xornada e concede execución
só a usuarios `authenticated`. A consulta lee `eligible_voters`, `player_accounts`, `players`,
`fixture_callups` e `locker_votes`; só conta papeletas completas de tres votos.
A interface non le `locker_votes` directamente. Non se modifican as normas de voto nin
os datos existentes. Un erro da consulta non impide entrar ao Fantasy.

Probas: `node --test tests/vote-tracking.test.mjs` e comprobación da función con
identidade administrativa e participante (proba negativa). As eleccións son privadas.

## Voto do adestrador

- O voto só se habilita para unha conta explicitamente designada na táboa privada
  `private.coach_voters`; **o rol admin por si só non permite votar**.
- A interface chama `fantasy_coach_vote_access` para saber se a sesión actual é o adestrador habilitado.
  A conta autorizada ve «Voto do adestrador» durante as mesmas 72 horas que os xogadores.
- A papeleta é 3, 2 e 1 para tres xogadores diferentes que estiveron convocados,
  pode substituírse antes do prazo e non altera datos históricos.
- `fantasy_vote` verifica no servidor a condición de xogador convocado ou adestrador
  autorizado, e insire a habilitación do adestrador en `eligible_voters` no momento do voto
  para cumprir a chave foránea de `locker_votes`.
- No seguimento, o voto do adestrador aparece por separado e **non infla o contador
  de xogadores habilitados**. Non se amosan os destinatarios dos votos.
- A fórmula de puntuación conserva o mesmo tratamento por papeleta para todos:
  suma os votos recibidos e aplica a normalización xa existente segundo convocados;
  o voto do adestrador non recibe un multiplicador.
- A designación da conta autorizada efectúase en Supabase de xeito privado;
  non se publican correos, UUIDs nin outros identificadores persoais no repositorio.
- Tests en `tests/vote-access.test.mjs`, `tests/vote-tracking.test.mjs` e unha proba
  SQL reversible que comproba unha papeleta de adestrador completa, a súa visibilidade
  na administración, o contador de xogadores e a falta de privilexio doutros administradores.
