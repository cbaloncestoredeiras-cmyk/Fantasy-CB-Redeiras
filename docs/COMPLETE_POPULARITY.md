# Popularidade completa e seleccións de non convocados

## Mercado (para participantes)

- «Popularidade do mercado» amosa **todos os xogadores do mercado**, non só os 10 primeiros.
- A convocatoria indicada é a do **último encontro publicado** (non a da seguinte xornada nin a dispoñibilidade de hoxe).
- A popularidade contabiliza as aliñacións **gardadas e bloqueadas para esa xornada**, non o plantel actual.
- Mantense o limiar de privacidade preexistente: con menos de 3 seleccións, a cifra e a porcentaxe amósanse como «Menos de 3 equipos», tamén para quen non tivo seleccións. Non se mostran equipos doutras persoas nin datos de xornadas sen publicar.

## Administración → Non convocados

- Función `fantasy_admin_uncalled_selections(p_fixture uuid)`, con comprobación do administrador e pertenza do partido ao club no servidor.
- Selección por **xornada publicada**, comezando pola última; botón para actualizar.
- Lista **todos** os xogadores non convocados: cero, unha ou máis seleccións; inclúe os nomes dos equipos Fantasy que os aliñaron.
- Non se mostran nomes reais, correos, directos dos usuarios nin aliñacións de partidos non publicados.
- A presenza dun non convocado nun quinteto é un feito rexistrado, **non permite concluír se foi un esquecemento ou unha elección estratéxica**.

A mudanza é de consulta e presentación: non se modifican aliñacións, clasificación, puntuacións nin prezos.
