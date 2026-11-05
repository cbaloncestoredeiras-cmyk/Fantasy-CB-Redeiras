# Guía histórica de puesta en marcha — Fantasy CB Redeiras (noviembre 2026)

> **ATENCIÓN: ARCHIVO HISTÓRICO.** La aplicación ya está desplegada en Cloudflare Workers y las migraciones iniciales ya se ejecutaron. No repitas estas instrucciones de instalación en la base de datos de producción. Para el estado real y los pasos pendientes de seguridad, consulta [Fases 0 y 1 · Operaciones](PHASE01_OPERATIONS.md).


> **Estado:** Código en GitHub, NO desplegado; migraciones sin ejecutar ni validar en Supabase. No invitar a menores ni publicar el enlace hasta completar pruebas de privacidad y seguridad. La creación de cuentas Cloudflare y Supabase por sí sola no publica nada.

## 1. Archivos ya preparados

- \`site/\`: frontend real conectado a Supabase (NO \`prototype/\`, que es una demo local).
- \`scripts/build.mjs\`: compilación para Cloudflare Pages; no necesita instalar dependencias npm.
- \`supabase/migrations/202611040001...\` a \`...0007...\`: tablas, datos iniciales, transacciones, votaciones, Bróker y permisos (pendientes de ejecución y test).
- \`supabase/functions/invite-user/index.ts\`: función de invitaciones protegida.
- \`tests/logic.test.mjs\`: pruebas del mercado y cálculos.
- \`.github/workflows/checks.yml\`: pruebas/build en cada actualización.

## 2. Supabase (proyecto que ya has creado)

Project ref: \`vfxazecrdxrtoqzdhclh\`  
Project URL: \`https://vfxazecrdxrtoqzdhclh.supabase.co\`

**La URL es pública; nunca compartas contraseñas ni \`sb_secret_\` ni \`service_role\`.**

### Instalar esquema en una base de datos de PRUEBAS

Esta instalación debe realizarse en un entorno sin datos reales, tras revisar la SQL y disponer de una copia de seguridad. Si la conexión de Supabase en ChatGPT permite operaciones SQL, se podrá automatizar desde una conversación con dicha conexión accesible.

En caso de ejecución manual, Supabase Dashboard → SQL Editor → New query. Ejecuta **por separado, en orden**, cada archivo de \`supabase/migrations/\`:

1. \`202611040001_core_schema.sql\`
2. \`202611040002_initial_club_and_market.sql\`
3. \`202611040003_transactions_and_roles.sql\`
4. \`202611040004_stats_votes_broker.sql\`
5. \`202611040005_remaining_fixtures.sql\`
6. \`202611040006_hardening.sql\`
7. \`202611040007_data_access_hardening.sql\`

**No ejecutar a ciegas**: antes de aplicar en un entorno compartido, se necesitan pruebas de SQL, RLS y transacciones reales. Un error parcial podría dejar la base de datos a medio configurar.

### Primer administrador

En Authentication → Users → Add user → Send invitation, envía una invitación al correo **emiliocarballo02@gmail.com**. Después de que exista el usuario en Auth, ejecuta el SQL de \`docs/ADMIN_BOOTSTRAP.sql\` desde SQL Editor, tras revisar que el correo coincide.

Esto otorga el papel admin únicamente a la cuenta indicada. No es necesario dar permisos de organización ni compartir secretos con ChatGPT.

### Autenticación

Supabase Dashboard → Authentication → URL Configuration: después de publicar la web de prueba, establece la **Site URL** a la URL de Cloudflare Pages (por ejemplo, \`https://fantasy-cb-redeiras.pages.dev\`) y añade esa misma URL en Redirect URLs. No inventes el subdominio: usa el asignado por Cloudflare.

Se recomienda restringir registros públicos: invitación administrada por el club. La aplicación envía magic links solamente a usuarios que ya existen (\`shouldCreateUser:false\`).

## 3. Cloudflare Pages

1. Abre https://dash.cloudflare.com/ → **Workers & Pages** → **Create application** → **Pages**.
2. Selecciona **Connect to Git** y autoriza el repositorio GitHub privado \`cbaloncestoredeiras-cmyk/Fantasy-CB-Redeiras\`.
3. Rama de producción: \`main\`. Framework: **None**.
4. **Build command:** \`npm run build\`.
5. **Build output directory:** \`dist\`.
6. **Root directory:** directorio raíz del repositorio (sin ruta especial).
7. **Variables de compilación**, en Production y Preview si procede:
   - \`PUBLIC_SUPABASE_URL\` = \`https://vfxazecrdxrtoqzdhclh.supabase.co\`
   - \`PUBLIC_SUPABASE_PUBLISHABLE_KEY\` = clave **publishable** (\`sb_publishable_...\`) obtenida en Supabase → Project Settings → API Keys.
   - \`NODE_VERSION\` = \`22\`
8. Guarda y despliega. El build crea \`dist/config.js\` solo con datos públicos.

**JAMÁS poner una secret key ni la contraseña de la base de datos en Cloudflare \`PUBLIC_*\` o en GitHub.** Una web desplegada puede ser pública aunque el repositorio GitHub sea privado. En el frontend todos los datos necesitan estar protegidos con login y RLS.

## 4. Invitaciones automáticas (opcional para pruebas iniciales)

Desplegar \`supabase/functions/invite-user/index.ts\` como Edge Function \`invite-user\` mediante Supabase CLI o su editor, manteniendo la verificación del JWT. Configurar su secreto/variable \`PUBLIC_APP_URL\` con el origen HTTPS exacto asignado por Cloudflare (sin barra al final). Los secretos de Supabase deben permanecer en Edge Functions, nunca en el sitio estático.

Mientras no se despliegue la función, el club puede enviar invitaciones desde **Supabase Auth Dashboard**. Para asociar una cuenta ya existente al club, usar el procedimiento autorizado \`fantasy_add_member\`; no crear políticas RLS que permitan a usuarios insertarse ellos mismos como administradores.

## 5. Pruebas antes de abrir la competición

- Comprobar que el proyecto ofrece datos solo a usuarios invitados del club; visitantes anónimos no obtienen registros de partidos, usuarios ni votaciones.
- Probar que un usuario no puede editar o ver el equipo privado de otro con la API REST.
- Crear un quinteto válido de 5 jugadores (mínimo 1 BA y 1 AP/P distintos) por ≤ 6M.
- Rechazar 5 jugadores demasiado caros, cuatro jugadores, jugadores duplicados y cambios superiores a tres.
- Verificar bloqueo exacto al inicio efectivo del partido y que no puedan confirmarse cambios mientras haya estadísticas pendientes.
- Comprobar acceso al voto solo de jugadores convocados (incluidos los que no juegan), sin autovoto y dentro de 72 h.
- Importar estadísticas de prueba y confirmar que los participantes NO ven PIR antes de publicar la jornada.
- Publicar jornada de prueba con bonus ACB, bonus de vitoria, votos, ranking y variación máxima ±15% (ausencia = precio intacto).
- Revisar permisos sobre datos e imágenes de menores, privacidad, copias de seguridad y plan de recuperación.
- Revisar estado de GitHub Actions y solucionar cualquier error.

**Solo después** permitir accesos reales.

## 6. Qué haría falta comunicar una vez desplegado

La URL real \`https://<tu-subdominio>.pages.dev\` (no es una clave secreta) y si el SQL de Supabase se ejecutó sin errores. Es lo único que no se conoce hasta que el titular configure Cloudflare y el proyecto Supabase.
