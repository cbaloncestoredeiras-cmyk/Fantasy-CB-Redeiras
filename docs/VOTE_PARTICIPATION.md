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
