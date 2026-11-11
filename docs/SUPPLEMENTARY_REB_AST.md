# REB e AST informativas · Fantasy Redeiras

## Regra
A puntuación Fantasy **non cambia**: segue calculándose desde PIR/VAL, bonus do vestiario e resultado do equipo.
REB e AST úsanse como información deportiva adicional nos perfís e rankings de estatísticas. A súa ausencia non significa cero. Un **0 explicitamente escrito no CSV** significa cero observado.

O servidor rexeita valores negativos, non enteiros e maiores de 100 para REB/AST. A información só aparece en xornadas xa publicadas, nunca nas previas privadas.

## Como importar desde a X6
1. En **Administración → Estatísticas**, escolle a xornada.
2. Adxunta o CSV / Excel do Basketball Stats Assistant con columnas `Jugador, MIN, VAL, REB, AST` (tamén admite `PIR` en vez de `VAL`, e `Rebotes/Asistencias`).
3. Revisa a correspondencia dos nomes e os campos. O sistema acepta `MIN=03:21` ou minutos decimais. Admite `Dunkos` como nome confirmado de Adán.
4. **Se aínda non publicaches** e estás gardando as estatísticas oficiais por primeira vez: preme «Gardar valoracións revisadas»; gardará tamén REB/AST.
5. **Se a xornada xa está publicada** ou vas cargar un CSV posterior só con detalles: preme «Gardar só REB e AST (sen recalcular Fantasy)». Isto funciona tamén co mercado da seguinte xornada aberto.
6. Se o vídeo é incompleto, indica unha nota de cobertura no campo «Fonte ou aviso sobre REB/AST». As medias de REB/AST só utilizan partidos con esas estatísticas rexistradas. O resto móstrase con «—», nunca como cero.

Ao gardar só as estatísticas informativas, a función `fantasy_save_observed_stats` verifica administrador, pertenza dos xogadores e existencia do boxscore; **non modifica** PIR, puntos Fantasy, minutos, prezos, clasificación nin mercado. Escribe un evento de auditoría.

## Importación parcial da X5 (11 xogadores)
A imaxe recibida suma 34 rebotes e 13 asistencias; **non é o boxscore completo**, porque o vídeo se interrompeu. A importación identifica 11 xogadores (31 rebotes e 13 asistencias). A fila **Pola (#30, 3 rebotes, 0 asistencias)** non coincide cun xogador do Fantasy, polo que se conserva a discrepancia na nota da xornada e **non se lle asigna arbitrariamente a Edu**.

| Xogador Fantasy | Rebotes | Asistencias |
|---|---:|---:|
| Brais | 0 | 1 |
| Iván | 1 | 0 |
| Juan | 10 | 1 |
| Yoel | 1 | 2 |
| Mario | 6 | 1 |
| Adán (Dunkos) | 0 | 0 |
| Luca | 1 | 2 |
| Álex | 1 | 0 |
| Álvaro | 2 | 3 |
| Diego | 0 | 1 |
| Adri | 9 | 2 |

**No se ha actualizado** ningún dato de puntuación, PIR, bróker, clasificación, votos nin os minutos/PTS oficiais da X5. As cifras de REB/AST son adicionais e parciais.
