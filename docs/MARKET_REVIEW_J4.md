# Mercado inicial X5 · Corrección por valoración da X4

## Criterio de valoración

O dato que mellor anticipa a puntuación Fantasy é a **VAL/PIR** da foto do club. Os minutos oficiais da FEGABA serven para interpretar a participación, non como fonte alternativa da valoración. Non se usa EFF nin se recalculan as medias históricas anteriores sen os seus datos completos.

A X4 rematou en derrota e non tivo votación 3-2-1 do vestiario. Para comparar o posible rendemento Fantasy da X4, non habería bonificación por vitoria nin por votos. Por iso, a VAL é o mellor indicador nesta revisión; **a X4 non se incorpora á competición Fantasy nin se publica unha puntuación retroactiva**.

Os prezos anteriores xa incorporan as estimacións de varias xornadas e os premios Ledicia previos. Para non facer depender o mercado dun só encontro, aplícase unha **revisión conservadora do prezo de saída**, non a fórmula automática do bróker:
- Se participou e a VAL é positiva: subir **100.000 € por punto VAL**, máximo +300.000 €.
- Se participou e a VAL é negativa: baixar **50.000 € por punto negativo**, máximo −150.000 €.
- VAL = 0: manter o prezo.
- Non convocado: manter o prezo, sen prexuízo por non xogar.
- Manter os premios Ledicia previamente considerados; non engadir votos da X4 que non existiron.

A asimetría protexe fronte a penalizacións excesivas nun partido de derrota ampla, e permítelle ao mercado recoñecer os xogadores infravalorados que rendiron mellor. **Estes coeficientes son unha decisión de calibración inicial, non a fórmula oficial do bróker.**

## Prezos revisados

| Xogador | Antes | Novo prezo |
|---|---:|---:|
| Juan | 2,30 M | 2,25 M |
| Yoel | 2,15 M | 2,05 M |
| Adri | 1,80 M | 1,70 M |
| Mario | 1,65 M | 1,50 M |
| Edu | 1,35 M | 1,20 M |
| Diego | 1,30 M | 1,30 M |
| Álvaro | 1,20 M | 1,05 M |
| Brais | 1,20 M | 1,10 M |
| Luca | 1,20 M | 1,20 M |
| Adán | 1,10 M | 1,30 M |
| Manuel | 1,10 M | 1,10 M |
| Gil | 1,05 M | 1,35 M |
| Mateo | 1,00 M | 0,90 M |
| Sergio | 0,90 M | 0,90 M |
| Iván | 0,85 M | 0,85 M |
| Yosue | 0,85 M | 1,15 M |
| Álex | 0,80 M | 0,80 M |
| Iago | 0,80 M | 0,70 M |

## Execución responsable

Esta táboa é unha proposta de prezos previos á primeira xornada puntuable. Actualizar unicamente a referencia de apertura do mercado (`market_prices`, `price_history` da rolda 0) e a listaxe de apoio `data/jugadores.json`, sen alterar as valoracións históricas, resultados nin votos. Antes de cambiar Supabase comprobar tempada inactiva, ausencia de equipos, fichaxes e puntuacións, e coincidencia cos prezos anteriores; operación atómica e verificable.

A documentación pública **non inclúe nin publica** a folla de estatísticas ou o PDF da federación, nin desagrega estatísticas individuais de menores. Fontes da revisión: foto subministrada polo club para a VAL; PDF FEGABA exclusivamente para minutos.
