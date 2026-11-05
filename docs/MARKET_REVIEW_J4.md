# Mercado inicial · Revisión tras San José (X4)

Esta revisión é exclusivamente de **prezos de saída da X5**, non de puntuacións retroactivas.

## Fontes

- Foto de estatísticas achegada polo club: puntos, tiros e VAL individual. **Non usar os minutos da foto**, nin outros datos do PDF.
- PDF FEGABA do San José–Redeiras: **só tempos individuais de xogo**.
- Normalización: Yowi = Yoel, Lolo = Manuel, Yosu = Yosue, Pola = Edu. Non convocados: Manuel, Álex, Sergio, Diego, Iván e Luca.
- Non houbo votos 3-2-1 nesta xornada. Os premios Ledicia anteriores seguen sendo Yoel (2) e Mateo (1).

## Prezo revisado

A táboa de prezos anterior xa se calculou con medias provisionais das primeiras catro xornadas. Como non se conservan aquí os datos individuais fiables de X1-X3 e os antigos rexistros da X4, **non debemos volver engadir a X4 como unha quinta xornada**. En vez de afirmar que recalculamos as medias, facemos unha **reponderación do prezo**:

- Cotización X4 = 500.000 € + 40.000 €/minuto oficial + 80.000 €/punto da foto + 100.000 € por premio Ledicia anterior.
- Prezo proposto = arredondar a 50.000 € máis próximos o **75% do prezo anterior + 25% da cotización X4**.
- Ausentes/non convocados: conservar o prezo, sen sanción. A valoración VAL da foto queda identificada como dato útil para futuras calibracións, pero non se mestura coa fórmula actual baseada en minutos e puntos.
- Non crear resultados, fichaxes, equipos nin votos de X4 no Fantasy. A primeira xornada puntuable continúa sendo X5.

| Xogador | Antes | Proposta X5 |
|---|---:|---:|
| Juan | 2.300.000 | 2.300.000 |
| Yoel | 2.150.000 | 2.000.000 |
| Adri | 1.800.000 | 1.700.000 |
| Mario | 1.650.000 | 1.550.000 |
| Edu | 1.350.000 | 1.400.000 |
| Diego (non convocado) | 1.300.000 | 1.300.000 |
| Brais | 1.200.000 | 1.100.000 |
| Luca (non convocado) | 1.200.000 | 1.200.000 |
| Álvaro | 1.200.000 | 1.200.000 |
| Adán | 1.100.000 | 1.050.000 |
| Manuel (non convocado) | 1.100.000 | 1.100.000 |
| Gil | 1.050.000 | 1.200.000 |
| Mateo | 1.000.000 | 1.150.000 |
| Sergio (non convocado) | 900.000 | 900.000 |
| Iván (non convocado) | 850.000 | 850.000 |
| Yosue | 850.000 | 1.000.000 |
| Álex (non convocado) | 800.000 | 800.000 |
| Iago | 800.000 | 800.000 |

**Aplicación á base de datos:** só se a tempada segue inactiva, non hai equipos nin transaccións e os prezos coinciden co punto de partida. Sincronizar `market_prices` e a referencia inicial da `price_history` (rolda 0) de forma atómica e verificar os 18 prezos. Non publicar os documentos brutos nin fotos de menores no repositorio.
