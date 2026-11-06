# Fantasy CB Redeiras · Actualización V1.4 (seis melloras)

## Funcionalidades incluídas
1. **Popularidade de xogadores**: porcentaxe agregada dos cinco seleccionados entre equipos ao finalizar unha xornada. A RPC só devolve datos da **última xornada publicada**, con polo menos cinco equipos participantes; cando un xogador foi elixido por menos de tres equipos, ocúltanse o reconto e a porcentaxe. Nunca devolve equipos nin contas concretas.
2. **Perfís e historial**: medias e totais de puntos Fantasy, PIR, minutos, puntos reais, rebotes, asistencias, recuperacións, perdas e bonus. Inclúe detalle por cada xornada oficial e ignora os borradores.
3. **Logros e récords**: mellor xornada Fantasy dun equipo, récord individual por partido, maior número de xornadas gañadas e maior subida da clasificación entre xornadas consecutivas. Dependen de resultados publicados.
4. **Quinteto visual**: representación interactiva de cinco xogadores sobre unha pista de baloncesto con nomes, fotografías e ligazón ao perfil. Non modifica fichaxes nin posicións oficiais; é unha disposición orientativa.
5. **Estatísticas avanzadas**: nova sección co ranking de xogadores por medias Fantasy, PIR, rebotes, asistencias, valoracións e outras estatísticas dispoñibles. Só se contabilizan partidos disputados en xornadas finalizadas.
6. **Web Push con app pechada**: código de subscrición explícita, revogación, táboa privada, lote de envíos con marca antirrepetición, Edge Function con segredo de cron e receptor no service worker. **Non se considera operativo ata configurar as claves VAPID, publicar o frontend e habilitar o traballo programado; cómpre probar cun dispositivo real e permiso voluntario.**

## Estatísticas e privacidade
- Non publicar o mercado doutros usuarios, correos, datos de login nin fotos dos pais/menores. Popularidade só con agregación e umbral mínimo.
- A clasificación xeral e semanal seguen procedendo das RPCs xa existentes; non se recalculan segundo quintetos posteriores.
- Os datos anteriores ao comezo na xornada 5 non se inventan; aparecen estados baleiros ata pechar a primeira xornada.
- `public.push_subscriptions` contén endpoint e claves de cifrado da subscrición. Ten RLS habilitada, lectura de cada usuario só sobre os seus rexistros, e altas/baixas **só por RPC con sesión**. Os envíos só poden executarse co rol `service_role` e segredo de cron.
- `private.push_dispatches` rexistra os intentos e evita duplicacións, con reintentos limitados.
- Esta actualización non altera orzamento, puntuación, cambios, ranking, prezos nin estado da tempada.

## Publicación
- Migración en Supabase: `20261106010000_v14_popularity_push.sql` (aplicada e testada en produción). Proba SQL de alta e baixa executada dentro de `BEGIN ... ROLLBACK`.
- Edge Function: `supabase/functions/fantasy-push-send/index.ts`.
- Frontend `site/analytics.js`, `site/analytics-view.js`, `site/analytics.css`, `site/push.js`; actualizados `app.js`, `pages.js`, `experience.js`, `sw.js` e build.
- CI debe aprobar `Checks` e `Responsive Browser QA` antes de fusionar.
- Para publicar Cloudflare, actualizar `main` e executar `npm.cmd run deploy` (ou confirmar o despregamento automático).

## Activación das notificacións con aplicación pechada
Le o [procedemento completo de configuración segura](PUSH_SETUP_V14.md). Os outros cinco bloques funcionan sen esta configuración.
