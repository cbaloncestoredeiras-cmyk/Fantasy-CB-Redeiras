# Fantasy CB Redeiras · cambio por xogador e acabado visual

## Regra vinculante: 3 xogadores orixinais, non 3 xanelas
Cada equipo pode confirmar operacións de mercado tantas veces como queira, sempre que o mercado estea aberto e o quinteto resultante cumpra as regras e o orzamento.

Ao comezo de cada xornada fíxanse os **cinco xogadores orixinais**. Os tres cambios permitidos refírense a **tres xogadores distintos dese quinteto orixinal** que saíron polo menos unha vez durante a xornada. Non se contan as veces que se preme «Confirmar fichaxes», nin se aumenta o contador por substituír un xogador que se acaba de fichar. Volver fichar un orixinal xa cambiado non recupera o cambio utilizado.

Exemplo real da X6: Adán → Mateo e Brais → Gil, nunha soa confirmación = **2/3**; queda dispoñible substituír un orixinal máis. O usuario poderá volver modificar Mateo e Gil noutras confirmacións mentres non cambie un cuarto xogador orixinal.

**Validación obrigatoria no servidor**: migración `20261111120000_transfer_original_players_per_round.sql` en `private.fantasy_round_originals`. A función `fantasy_change_lineup` mantén os bloqueos, o custo e a comprobación de autorización, grava vendas/compras coas súas facturas virtuais e só denega un cuarto orixinal. A función `fantasy_transfer_status` devolve ao propietario o contador coherente para Inicio, Mercado e Simulador. As operacións xa gardadas reconstrúense a partir da convocatoria bloqueada da xornada anterior ou, cando non existe, do historial de fichaxes invertido.

As tres prazas **non se reinician** ao enviar varias operacións de mercado na mesma xornada, e si o fan automaticamente ao pasar á seguinte xornada.

## Acabado visual aplicado
1. Fotografías máis grandes en listas e na ficha de xogador.
2. Perfil de xogador con cabecera deportiva, prezo, forma e partidos publicados.
3. Resumo de puntos recentes e posición na tarxeta escura de Inicio.
4. Podio de clasificación máis diferenciado.
5. Mellora da lexibilidade das tarxetas sobre pista FIBA, con distinción do mellor xogador da última xornada publicada cando hai datos.
6. Filtros rápidos e ordenación do mercado: prezo, forma e popularidade; só estados de convocatoria confirmados.
7. Estilo unificado das gráficas e métricas.
8. Estados de lesión e convocatoria con texto e indicador, nunca só cor.
9. Navegación móbil depurada e indicadores de procesos en curso.
10. Carga inicial con esqueleto decorativo, transiciones discretas e respecto por `prefers-reduced-motion`.

No se alteran as valoracións, puntos, límites de orzamento, 5 titulares, seguridade, votos nin as jornadas xa publicadas. A migración non modifica plantillas: prepara o contador e validación de cambios futuros.

## Verificación
- CI: `npm test`, `npm run check` e `npm run build`.
- Browser QA responsive: 320, 375, 390, 430, 768, 820, 1024, 1280, 1440, 1920 px.
- Test SQL reversible: comprobar X6 de Tomic Fan Account = 2 cambios, queda 1; verificación de función e autorización. Non executar cambios de xogadores reais durante as probas.
- Actualizar o Worker de Cloudflare separadamente se non hai despliegue automático.
