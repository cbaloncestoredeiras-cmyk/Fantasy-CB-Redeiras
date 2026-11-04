# Despliegue: usa la guía actualizada

La guía de configuración vigente es **[GO_LIVE.md](GO_LIVE.md)**.

Estado actual: repo privado GitHub, sitio \`site/\`, migraciones SQL preparadas, app todavía NO publicada. No desplegar \`prototype/\`, que usa una simulación local de roles.

La aplicación real está preparada para compilarse con:
- \`npm run build\`
- Directorio de salida \`dist\`
- Variables públicas \`PUBLIC_SUPABASE_URL\`, \`PUBLIC_SUPABASE_PUBLISHABLE_KEY\`, \`NODE_VERSION=22\`.

**Sin SQL aplicado y probado, ni configuración de Cloudflare, el login no será funcional.**
