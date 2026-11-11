# Boxscore completo: J5 e importación CSV (11/11/2026)

## Estado confirmado

- GitHub: PR #36 integrada en main (5c95cb6b52c343f73a0df47bd33b3d6bee8ee6f5).
- Supabase: migración aplicada con nombre `full_boxscore_informative_j5_20261111`, versión consultada `20261111123158`.
- Antes de aplicar: ensaio transaccional `BEGIN ... ROLLBACK`, sen cambios persistentes.
- Despois de aplicar: 18 columnas informativas novas e 12 xogadores da J5 con datos.
- Hash de `market_prices` e `team_round_scores` idénticos antes/despois.
- GitHub Actions: npm test, npm run check, npm run build e Responsive Browser QA superados na PR.
- **Cloudflare:** publicación e revisión visual do Worker non verificadas neste corte; non afirmar que a web estea xa actualizada.

## Fonte e conciliación

Fonte base: boxscore parcial de Basketball Stats Assistant capturado durante J5 vs Baloncesto Nigrán (07/11/2026), vídeo interrompido pola lesión de Yoel. Os datos de REB, AST, STL, TOV, BLK, SR, +/- e EFF do vídeo son parciais.

Os PTS, MIN, VAL/PIR e PF oficiais previamente revisados non se substitúen por cifras incompletas do vídeo. Para reconciliar tiros anotados sen inventar tiros fallados:

- Juan: 7 → 9 PTS; +2 FTM, +2 FTA.
- Adán (Dunkos): 5 → 7 PTS; +2 FTM, +2 FTA.
- Adri: 2 → 6 PTS; +2 2PM e +2 2PA (tamén FGM/FGA).
- PF: utilízanse as correccións FEGABA xa acordadas; total 33 no arquivo conciliado.
- Pola (#30) = Edu; alias confirmado. O nome do xogador no Fantasy é Edu.
- Merlín entrou na J6 e NON figura nas estatísticas da J5.

Totais da J5 conciliada en Supabase (12 xogadores): 42 PTS; FGM/FGA 13/63; 2PM/2PA 10/45; 3PM/3PA 3/18; FTM/FTA 13/21; 34 REB, 13 AST, 17 STL, 11 TOV, 4 BLK, 3 SR, 33 PF, 5 PFD. Ningunha cifra suplementaria recalcula VAL, Fantasy nin o bróker.

## Arquitectura / contrato CSV

Campos CSV recoñecidos: `Jugador, MIN, PTS, VAL/PIR, REB, AST, FGM, FGA, 2PM, 2PA, 3PM, 3PA, FTM, FTA, OREB, DREB, STL, TOV, BLK, SR, PF, PFD, EFF, +/-`.

Os porcentaxes FG%, 2P%, 3P%, FT% calcúlanse como tiros anotados/intentos, non se gardan como input independente. Un campo baleiro é descoñecido; un cero explícito é unha medición válida. As estatísticas non dispoñibles de xornadas anteriores deben quedar sen rexistro, non como ceros ficticios. EFF é informativo e NON substitúe VAL/PIR.

O panel en `Administración → Estatísticas` admite cargar CSV ou XLSX e gardar complementarios (mesmo tras publicar) mediante `public.fantasy_save_boxscore`, con autorización admin no servidor e auditoría. Para gardar o acta oficial por primeira vez utilízase `fantasy_save_stats` antes da RPC informativa. O perfil e ordenación en Estatísticas reciben só partidos publicados.

O CSV J5 dispoñible na conversación é unha extracción para volver importar ou auditar, non un respaldo integral. Tras subir un CSV, revisar correspondencia de xogadores, mínimos, resultados e porcentaxes, antes de confirmar.

## Pendentes

1. Confirmar en Cloudflare que o Worker serve o código novo de main e probar carga CSV en Safari/Android/escritorio.
2. Revisar que o panel móbil permite desprazamento horizontal das columnas numerosas.
3. Incorporar esta actualización ao Documento Maestro 2.1 cando se revise a J6.
