# Actualizar o Fantasy Redeiras en Cloudflare Workers

**Estado confirmado no 05/11/2026:** a web xa estaba publicada en Cloudflare Workers e a base Supabase xa tiña as migracións iniciais. A tempada segue desactivada. O panel de fase 2 e o control de lanzamento están no repositorio GitHub e en Supabase; **non se pode asegurar que a versión publicada en Cloudflare se actualizase automaticamente**.

URL do Worker actual: https://fantasy-cb-redeiras.cbaloncestoredeiras.workers.dev

## Para Emilio e Brais

- Os dous son administradores *dentro do Fantasy*; iso non outorga permisos de GitHub nin de Cloudflare. Para que Brais poida publicar código haberá que convidar a súa conta GitHub como colaborador e outorgar os permisos adecuados en Cloudflare, de ser necesario. Non compartir contrasinais nin tokens.
- O proxecto usa **Node.js 20 ou superior**, GitHub e o CLI de Cloudflare Wrangler. A aplicación real está en `site/`; `prototype/` é unha maqueta, non debe publicarse.
- Crear ramas de traballo e solicitudes de integración (Pull Request) para os cambios. Non introducir claves de servicio de Supabase nin credenciais privadas no repositorio, aínda que actualmente sexa público.

## Preparar unha versión no ordenador (Windows, PowerShell)

Desde a carpeta do repositorio, despois de actualizar `main`:

```powershell
node --version
npm test
npm run check
npm run build
```

Se as probas fallan, non publicar. O build crea `dist/`, que inclúe só datos públicos de conexión a Supabase. A chave `sb_publishable_...` non é secreta; unha chave `sb_secret_...` ou `service_role` nunca debe aparecer no navegador nin nos ficheiros estáticos.

Para despregar, só cando a persoa teña permisos de Cloudflare e as probas pasen:

```powershell
npx wrangler login
npm run deploy
```

**Este último comando publica unha nova versión da interface** no Worker configurado en `wrangler.jsonc`. Non activa a tempada. Verificar en Cloudflare o resultado e comprobar no navegador que o panel da fase 2 amosa 0/5 comprobacións pendentes.

## Comprobación posterior ao despregamento

1. Abrir a URL oficial en modo privado e confirmar que a pantalla de inicio de sesión aparece sen expoñer datos privados.
2. Entrar como admin e comprobar **Administración → Control previo ao lanzamento**. Deben aparecer 5 comprobacións pendentes e o botón `Activar tempada` desactivado.
3. Entrar como participante de proba e confirmar que non aparece o panel administrativo.
4. Verificar a navegación e os formularios nun móbil real e revisar os resultados de `Checks` e `Responsive Browser QA` en GitHub Actions.
5. Non marcar a recuperación de backup, as autorizacións, a entrega de emails nin as probas como realizadas ata completalas de verdade.

A fase 2 está documentada en [PHASE2_ROLLOUT.md](PHASE2_ROLLOUT.md) e os bloqueos actuais na [incidencia de peche #10](https://github.com/cbaloncestoredeiras-cmyk/Fantasy-CB-Redeiras/issues/10).

## Recuperación ante un erro

- Para unha regresión visual, reverter o commit na rama principal e volver despregar a versión anterior; isto non restaura os datos da base.
- Para un erro de datos ou permisos, deter a operación e usar un respaldo real probado e o plan de restauración. Non manipular a produción mediante SQL de simulación.
