# Fantasy Redeiras · Actualización 2 (V1.2)

Implementación: 6 de novembro de 2026. O código está en GitHub; **a web de Cloudflare non se actualiza necesariamente ao fusionar cambios**, polo que cómpre comprobar o despregamento. Esta actualización non activa a tempada.

## 1. Simulador de fichaxes
- Novo panel en **Mercado** que mostra saídas, entradas, efectivo resultante, cambios simulados e cambios restantes.
- Usa as mesmas fórmulas de validación e saldos do frontend; a RPC de Supabase segue sendo a autoridade cando o usuario pulsa «Confirmar fichaxes».
- Compara a suma das medias recentes só cando **os cinco xogadores** teñen puntuacións Fantasy publicadas. A media histórica **non predí** o seguinte encontro.
- «Restaurar quinteto actual» descarta a proposta na pantalla, sen tocar a base de datos.
- Está dispoñible para calcular hipotéticos mesmo co mercado pechado, pero non permite gardar nin fichar ata que abra.

## 2. Clasificación por xornada
- En **Clasificación**, selector de vista **Xeral** ou calquera xornada **finalizada**.
- Nova RPC `public.fantasy_round_leaderboard(uuid)`: consulta exclusivamente `team_round_scores` asociados a partidos con `fixtures.status='finalized'`.
- Protegida mediante pertenza ao club, sesión `auth.uid()` e permisos `EXECUTE` só de `authenticated`. Non devolve correos, elencos privados nin borradores.
- Calcula unha orde reproducible por puntos da xornada, antigüidade da inscrición e ID. Non se recalcula empregando o quinteto actual.
- A migración `20261105235028_fantasy_round_leaderboard_read_only.sql` foi aplicada a Supabase. Comprobación posterior: RPC presente; `anon` non pode executala, `authenticated` si; usuario sen sesión rexeitado. Non se crearon equipos nin puntuacións.

## 3. Equipo ideal da xornada
- Visible baixo a clasificación unha vez publicada a xornada.
- Busca os **5 xogadores** que máis puntos oficiais conseguen dentro do **orzamento inicial (6 M€)** e coa regra de ter 1 BA e 1 AP/P **distintos**.
- Para cada xornada toma o **último prezo posterior a unha xornada anterior** (prezo válido antes do partido). Nunca usa a subida/baixada calculada tras a xornada que se está avaliando.
- Non usa estatísticas dun partido aínda sen publicar. Se non existen cinco candidatos legais con puntuación publicada, indica que non hai equipo ideal dispoñible.
- Mostra puntuación, custo daquela xornada e saldo remanente. O ideal é unha análise estatística, **non unha fichaxe real**.

## Probas e limitacións
- `tests/strategy.test.mjs` cobre simulación, límites de fichaxes, orzamento, posicións, bloqueo de datos non publicados, reconstrucción de prezos e clasificación semanal.
- CI `Checks` e `Responsive Browser QA` obrigatorias. Repetir tras fusionar.
- Non se alteran as regras da tempada nin a moeda virtual, nin se xeran datos falsos.
- Antes da primeira xornada publicada, a clasificación semanal e o equipo ideal mostrarán estados baleiros.
- Os xogadores do equipo ideal proceden do catálogo activo da aplicación no momento de consulta; a desactivación permanente de xogadores históricos poderá requirir conservar un catálogo arquivado para manter resultados retrospectivos completos.
- Aviso de linter Supabase: unha función `SECURITY DEFINER` visible a autenticados necesita ser revisada; nesta RPC hai unha comprobación explícita de usuario e pertenza, e o acceso anónimo está revogado. Ver https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable

## Publicación
1. Revisar CI e que a migración está aplicada.
2. Fusionar PR de V1.2 na rama `main`.
3. Executar `npm.cmd run deploy` no repositorio actualizado desde unha terminal con acceso Cloudflare.
4. Abrir a web e comprobar o panel «Simulador de fichaxes», a vista «Clasificación» e o estado baleiro do «Equipo ideal» antes de X5.
5. **Abrir o mercado é unha acción aparte** desde Administración e require autorización do responsable; instalar V1.2 non activa a tempada.
