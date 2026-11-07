# Bróker Redeiras V3 · aprobado o 07/11/2026

## Decisión deportiva
- Fórmula **igual para todos os 18 xogadores**, independentemente da experiencia federada.
- **Non cambiar** prezos iniciais ou actuais, equipos, saldos, orzamento inicial 6.000.000 €, tres fichaxes por xornada nin resultados anteriores.
- Media acumulada de **puntos Fantasy** nos encontros nos que se xogou (PIR, vitoria se corresponde e voto). A ausencia conserva o prezo e non engade partido ao promedio.
- **Prezo teórico = max(450.000 €, 1.080.000 € + 125.000 € × media Fantasy).**
- Tras cada xornada, o prezo cambia directamente cara ao teórico, pero nunca máis do **±15 %** do prezo anterior; valores arredondados a 5.000 €. O límite inferior é 450.000 €.
- O bróker é inspirado na **mecánica** do SuperManager ACB, **non copia a escala monetaria exacta**.
- Non existe o freo adicional do 20 % da V2. Ese freo impedía acadar os limiares do 15 %.

## Comportamentos da primeira xornada
| Xogador | Prezo inicial | Puntos Fantasy | Prezo seguinte |
|---|---:|---:|---:|
| Iago | 700.000 € | −1 | 805.000 € (+15 %) |
| Iago | 700.000 € | −5 | 595.000 € (−15 %) |
| Brais | 1.100.000 € | −1 | 955.000 € |
| Juan | 2.250.000 € | +3 | 1.915.000 € (−15 % arredondado) |
| Juan | 2.250.000 € | +13 | 2.585.000 € (+15 % arredondado) |

## Umbrales visibles no perfil
- **Manter o prezo**: puntuación teórica que dá lugar ao prezo actual antes dos arredondamentos.
- **Subir o 15 %**: mínima puntuación Fantasy (en centésimas) que chega ao tope arredondado.
- **Baixar o 15 %**: máxima puntuación Fantasy (en centésimas) que chega ao tope inferior arredondado.
- Os sinais **≥** e **≤** mostran o sentido dos limiares. Se o chan de 450.000 € impide o −15 %, indicar que é un limiar teórico e a porcentaxe real máxima.
- Non existe garantía de que a valoración PIR por si soa coincida co resultado Fantasy, pois hai bonificacións.

## Persistencia e cambios seguros
- `private.next_price(integer,numeric,boolean)` recolle o promedio acumulado calculado por `private.fantasy_calculate_fixture`; a función non almacena datos.
- Migra só a función pura SQL. Non altera `public.market_prices`, `public.price_history`, `public.fantasy_teams`, `public.team_rosters`, `public.transfers` nin `public.team_round_scores`.
- O cálculo posterior á migración só afecta a xornadas cando se previsualicen ou publiquen. Rectificacións dunha xornada xa finalizada deben tratarse coa regra histórica se se dera ese caso (non existían xornadas finalizadas ao activar V3).
- Testing SQL: `tests/broker.pacing.sql` (nome histórico), JS: `tests/logic.test.mjs` e `tests/broker-view.test.mjs`.
