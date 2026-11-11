# UX v2 — competición antes que decoración

Reestruturación da interface pública e administrativa, mantendo o sistema visual Redeiras Workspace e todas as accións e regras de negocio.

## Inicio
Mostra a posición xeral, puntos publicados, patrimonio, número de cambios dispoñibles na xornada, seguinte rival e mercado aberto/pechado. Oculta métricas promocionais da parte superior. A guía do club permanece máis abaixo.

## Mercado
A busca, os filtros e a lista de xogadores aparecen **antes** do comparador/simulador/popularidade. O resumo do quinteto e as regras de fichaxes seguen visibles e o acceso móbil ao resumo permanece. As ferramentas pasan a tres separadores navegables sen renderizar de novo o borrador de cambios.

## O meu equipo
Media cancha de baloncesto FIBA orientativa (15 x 14 m), **unha canastra**, zona e liña de tiros libres, 6,75 m de tres, semicírculo restrinxido e liña central. As marcas non pretenden indicar tácticas nin posicións fixas. Cinco fichas tocables, cos prezos; abren o mesmo perfil de xogador de antes. As cinco fichas duplicadas pasan a unha lista despregable.

## Clasificación
Top 3 visual, equipo propio destacado, e frechas de posición baseadas **só en puntuacións agregadas de xornadas oficialmente publicadas**, tras polo menos dúas xornadas. Os empates poden producir diferenzas co criterio de desempate oficial, e así se informa. A clasificación completa permanece, incluída a vista móbil.

## Administración
Pestanas: Resumo, Partido, Convocatoria, Votación, Estatísticas, Publicación, Participantes. A xornada seleccionada queda por riba do menú. Todas as táboas e campos permanecen montados ao trocar de sección para **non perder estatísticas e cambios sen gardar**. A autorización no servidor non se modifica.

## Arquivos e seguridade
- Cambios: \`site/pages.js\`, \`site/analytics-view.js\`, \`site/admin.js\`, \`site/app.js\`
- Engadidos: \`site/ux-v2.css\`, \`site/ranking-trends.js\`
- CSS cargado despois de \`workspace.css\`.
- Sen novas dependencias, sen fontes de terceiros, sen cambios en Supabase nin en permisos, puntuacións, equipo, prezos, bróker ou fichaxes.
- Restaurar o commit anterior permite reverter visualmente a versión.

## QA
Node: \`npm test\`, \`npm run check\`, \`npm run build\`.
Chrome: 320, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920 px, incluíndo captura de media cancha e probas de navegación/administración.

**Esta revisión non desprega automaticamente a Cloudflare Workers; o servidor de publicación é separado de GitHub.**
