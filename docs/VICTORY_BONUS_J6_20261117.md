# Bonus por vitoria: cambio a partir da xornada 6 (2026-11-17)

A partir da X6, cando o CB Redeiras gaña, cada xogador que participou recibe un complemento sobre a súa VAL/PIR do boxscore:

- **VAL < 5** (inclúe VAL cero e negativa): **+1 punto fixo**.
- **VAL >= 5**: **+20 % da súa VAL** (por exemplo, VAL 6 => +1,2; VAL 10 => +2).
- En derrota non existe complemento por resultado.
- Quen non xogou non recibe complemento nin se lle imputan puntos Fantasy.
- O complemento do vestiario (votación 3-2-1) engádese despois, **sen multiplicarse pola vitoria**.
- Puntuación final = VAL + bonus de vitoria + bonus de voto, redondeada a dúas cifras decimais.
- Os CSV de estatísticas gardan a VAL orixinal, nunca a puntuación Fantasy calculada.
- O bróker usa os puntos Fantasy resultantes da xornada, coas súas regras V3 habituais.
- As xornadas xa publicadas non se recalculan nin se alteran. A X5 foi derrota, polo que o resultado coincide tamén coa regra antiga.

| VAL | Bonus vitoria | Antes de voto |
|---:|---:|---:|
| -10 | +1 | -9 |
| -5 | +1 | -4 |
| 0 | +1 | 1 |
| 3 | +1 | 4 |
| 5 | +1 | 6 |
| 6 | +1,2 | 7,2 |
| 10 | +2 | 12 |
| 20 | +4 | 24 |

O cálculo real está en `private.fantasy_calculate_fixture` (Supabase); o panel administrativo de vista previa expón agora separadamente o bonus de vitoria e o de voto. Non é necesario modificar `public.game_stats.pir`, `market_prices` nin as táboas históricas ao actualizar a función.

**Precaución**: para correccións de xornadas publicadas en temporadas futuras, cómpre manter unha versión histórica da regra por xornada. O cambio desta fase introdúcese cando a X6 está sen publicar e a X5 (derrota) xa pechada.
