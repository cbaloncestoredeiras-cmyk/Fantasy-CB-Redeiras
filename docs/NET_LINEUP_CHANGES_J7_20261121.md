# Fantasy CB Redeiras · tres diferenzas netas entre quintetos (desde X7)

## Regra en vigor

Os tres cambios contabilízanse **comparando o quinteto que iniciou a xornada co quinteto que se quere confirmar**. O número de cambios é a cantidade de xogadores dese quinteto orixinal que xa non están presentes. É indiferente cantas veces se confirmou o mercado ou cantos intercambios quedaron no historial de compra/venda.

- Máximo **3 de 5 xogadores diferentes** respecto ao quinteto orixinal da xornada.
- Se se volve fichar un orixinal vendido, **libérase a praza** que ocupaba no contador.
- Os xogadores fichados durante a xornada poden cambiarse de novo sen contar como orixinais adicionais. En cada confirmación, o quinteto final debe cumprir a regra.
- Manteñense os límites de saldo, cinco titulares, combinación BA + AP/P e peche do mercado. As lesións non dan cambios extra.
- As transaccións e prezos **seguen rexistrados**: recuperar unha praza non devolve diñeiro nin borra operacións.

## Exemplo real da X7

| | Xogadores |
| --- | --- |
| Quinteto orixinal (X6) | Mateo, Álvaro, Luca, Mario, Diego |
| Primeira confirmación X7 | Alex, Álvaro, Sergio, Iago, Diego |
| Nova confirmación X7 | Alex, Mateo, Sergio, Iago, Diego |

En ambas as dúas confirmacións hai **3/3 diferenzas netas**. Na segunda, a volta de Mateo libera a súa praza mentres a saída de Álvaro ocupa outra. O intercambio queda permitido se hai saldo, posicións válidas e mercado aberto. Un quinteto con catro orixinais ausentes continúa bloqueado.

## Implementación

- Servidor: `20261121153835_net_lineup_changes_j7.sql` preserva o quinteto orixinal inmóbil de cada xornada e recalcula os ausentes reais na lectura de estado e na confirmación. A autorización por usuario e as comprobacións de mercado e saldo seguen no servidor.
- Datos: só se sincroniza o contador da xornada programada; non se reescriben quintetos de xornadas finalizadas nin resultados deportivos.
- Interface: Inicio, Mercado e Simulador empregan a mesma diferenza neta, tanto na selección actual como no borrador.
- Probas: caso Mateo/Álvaro explícito, cambios en varias confirmacións, devolución de praza e cuarto cambio bloqueado.
