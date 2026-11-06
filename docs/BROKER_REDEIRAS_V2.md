# Bróker Redeiras V2 · calibración para competición 2026/27
**Acordado 06/11/2026, antes de publicar a X5.**

## Referencia ACB
- SuperManager ACB calcula o prezo teórico da valoración media acumulada, aplica o bonus de vitoria e limita subidas e baixadas a un 15 % por xornada.
- As subidas con negativo na ACB adoitan ocorrer despois de anteriores puntuacións fortes: o prezo tarda en alcanzar o obxectivo teórico debido ao límite do 15 %.
- Fontes: https://acb.com/es/liga/noticias/supermanager-acb-para-novatos-25-26-como-funciona-el-broker-143456 e https://acb.com/es/liga/noticias/supermanager-26-27-claves-de-la-jornada-2-146182.

## Adaptación Redeiras
- **Non modificar** os 18 prezos xa publicados, nin os 6.000.000 € iniciais, nin as 3 fichaxes/xornada.
- Só a fórmula para *novos cambios de prezo*:
  1. Media de todos os puntos Fantasy (PIR, bonus de vitoria e voto) en xornadas **xogadas e publicadas**, excluídas as ausencias.
  2. Obxectivo teórico = max(450.000, 1.000.000 + 250.000 × media).
  3. Prezo provisional = prezo actual + 20 % × (obxectivo − prezo actual).
  4. Redondear a 5.000 € e limitar ao corredor de ±15 % por xornada e mínimo 450.000 €.
  5. Quen non xoga mantén o mesmo prezo e non engade partido á media.
- O **20 % de aproximación** é unha modificación propia de Redeiras, non o algoritmo da ACB: pretende preservar prezos diferenciados entre xogadores con experiencia federada e principiantes, facendo máis lento o crecemento do patrimonio Fantasy e a perda brusca de valor dos máis caros.
- Non se crean categorías distintas con normas diferentes: unha fórmula igual para todos, con diferentes prezos iniciais e rendementos.
- Os umbrais da páxina de perfil son aproximados por redondeos e o limiar de descenso total pode ser imposible para prezos baixos polo mínimo de 450.000 €.

## Exemplos da primeira xornada (puntos Fantasy, NON necesariamente PIR)
| Xogador | Antes | Puntos Fantasy | Despois |
|---|---:|---:|---:|
| Iago | 700.000 € | -1 | 710.000 € |
| Iago | 700.000 € | +1 | 805.000 € |
| Edu | 1.200.000 € | +2 | 1.260.000 € |
| Mario | 1.500.000 € | +3 | 1.550.000 € |
| Juan | 2.250.000 € | +3 | 2.150.000 € |
| Juan | 2.250.000 € | +5 | 2.250.000 € |

Aínda falta calibrar con datos reais de varias xornadas: estes exemplos son escenarios, non previsións nin estatísticas do equipo. Non modificar a fórmula unha vez publicadas xornadas sen avaliar a integridade histórica dos prezos e transferencias.
