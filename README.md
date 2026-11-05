# Fantasy CB Redeiras · 2026/27

Aplicación Fantasy de baloncesto para el Club Baloncesto Redeiras, diseñada en gallego y adaptada a móviles. **Estado: web publicada en Cloudflare Workers, conexión con Supabase operativa y acceso del primer administrador verificado. La temporada está desactivada hasta completar las pruebas de integración, votaciones, fichajes, invitaciones y protección de menores. No abrir todavía a participantes reales.**

## Código del proyecto

- **\`site/\`**: aplicación web real, con login por invitación, inicio, mercado de 18 jugadores, quinteto flex, calendario, clasificación, votación del vestuario, perfiles de jugador y panel admin. Requiere una base de datos configurada para funcionar.
- **\`site/logic.js\`**: reglas y cálculos preliminares (el servidor realiza la validación real).
- **\`supabase/migrations/\`**: 10 migraciones SQL (estructura, 18 jugadores, 6 M€, fichajes, calendario, estadísticas, votación, Bróker, RLS). **Aplicadas a Supabase; pendientes de pruebas funcionales con dos cuentas**.
- **\`supabase/functions/invite-user/\`**: Edge Function protegida para invitar y vincular cuentas de jugadores. Desplegada, pendiente de prueba end-to-end.
- **\`tests/\`**: pruebas unitarias de reglas y lógica.
- **\`prototype/\`**: demostración HTML local V5 anterior, con datos ficticios. **No desplegar como app de producción**.
- **\`docs/GO_LIVE.md\`**: instrucciones completas de despliegue y configuración segura.

## Normas cerradas

- Presupuesto inicial **6.000.000 € virtuales**.
- 18 jugadores (15 sénior y 3 juniors), con posiciones dobles.
- Quinteto de 5: al menos un BA y un interior AP/P **distintos**, otras 3 posiciones libres.
- Tres transferencias por jornada, con validación en base de datos.
- Desde J5, **sábado 7 de noviembre de 2026, 20:00** (Europe/Madrid); horario de próximas jornadas editable por administración según confirmación semanal.
- Valoración ACB/PIR + bonus victoria del 20% solo si PIR positiva + bonus voto 3/2/1 del vestuario.
- Votan todos los convocados, hayan jugado o no, durante las 72 horas después del final real.
- Bróker basado en **media acumulada de puntos Fantasy en partidos disputados**: objetivo virtual = 450.000 € + 100.000 € × media; variación máxima ±15 % por jornada jugada, redondeo a 5.000 €, precio mínimo 450.000 €. Ausentes mantienen precio y no cuentan en la media. Un jugador puede subir incluso con valoración negativa si la media acumulada mantiene un objetivo superior al precio actual. Fórmula inspirada en el comportamiento de SuperManager, no idéntica ni oficial. Requiere calibración con datos reales.
- Mercado bloqueado al inicio y hasta publicación de estadísticas y precios de la jornada anterior.
- Un equipo por persona y temporada; acceso gratuito por invitación.

## Pendiente para lanzamiento

**Bloqueantes:** probar invitaciones reales y acceso de un usuario no admin, fichajes y bloqueo del mercado, congelación de quintetos al inicio, votos y bróker con una jornada simulada, y revisión de privacidad para menores. Consulta [la guía](docs/GO_LIVE.md).

**Mejoras siguientes, no prometer como presentes:** ligas privadas, duelos, pronósticos, notificaciones, juego multiclub operativo, comparación avanzada, equipo ideal automatizado, estadísticas de popularidad. La arquitectura está preparada para ampliarlas, pero estas funciones **no están implementadas aún**.

**No subir claves secretas ni contraseñas a GitHub.** Las claves publicables de Supabase pueden entrar en la compilación estática; las secret keys jamás.

## Fotos e identidade visual

- Escudo oficial do CB Redeiras no inicio de sesión, menú, portada e favicon; ficheiro optimizado en `site/assets/redeiras-logo.webp` (orixinal facilitado polo club).
- **Administración → Fotografías dos xogadores**: subir ou retirar retratos JPG/PNG/WebP (orixinais de ata 25 MB, convertidos no navegador a WebP e máximo 960 píxeles no lado longo).
- As fotos están gardadas no bucket **privado** `player-photos` de Supabase. Só as contas autenticadas do club poden obter unha URL asinada; só as administradoras poden subir ou retirar fotos.
- Comprobar consentimento/lexitimación antes de subir retratos, especialmente de menores. Non se gardan metadatos EXIF no ficheiro comprimido.
- Probas visuais e de subida pendentes de verificación desde un navegador real.
