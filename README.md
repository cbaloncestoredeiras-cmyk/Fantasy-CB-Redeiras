# Fantasy CB Redeiras · 2026/27

Aplicación Fantasy de baloncesto para el Club Baloncesto Redeiras, diseñada en gallego y adaptada a móviles. **Estado: web publicada en Cloudflare Workers, con 12 cuentas del club y 12 fotografías cargadas en la revisión del 5 de noviembre. Las fases 0/1 incluyen simulaciones transaccionales de mercado, votos, publicación y rectificaciones, junto con un panel administrativo ampliado. La temporada sigue desactivada: todavía es necesario verificar un respaldo externo restaurable y la privacidad/consentimientos de menores antes de abrir la competición oficialmente.**

## Código del proyecto

- **\`site/\`**: aplicación web real, con login por invitación, inicio, mercado de 18 jugadores, quinteto flex, calendario, clasificación, votación del vestuario, perfiles de jugador y panel admin. Requiere una base de datos configurada para funcionar.
- **\`site/logic.js\`**: reglas y cálculos preliminares (el servidor realiza la validación real).
- **\`supabase/migrations/\`**: migraciones SQL versionadas (estructura, 18 jugadores, 6 M€, fichajes, calendario, estadísticas, votación, Bróker, RLS). **Aplicadas a Supabase; pruebas de SQL/RLS ejecutadas con transacciones reversibles**.
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

## Fase 2 — lanzamento controlado

- **Backend despregado en Supabase:** 5 verificaciones obrigatorias (`backup_restore`, `minor_privacy`, `browser_e2e`, `email_invites`, `security_review`), con trazabilidade de responsable, data e nota. A RPC de activación **rexeita o lanzamento ata completar as cinco**.
- **Panel implementado no código:** administración amosa as tarefas e mantén desactivado o botón de activar a tempada cando faltan comprobacións. A publicación da versión visual en Cloudflare Workers aínda debe verificarse por separado.
- **Prueba SQL reversible superada:** `tests/phase2.launch.sql` comprobou acceso de admin/participante e activación protexida sen deixar datos de simulación.
- **Administradores confirmados:** Emilio e Brais, con permisos dentro do Fantasy. Colaboración en GitHub/Cloudflare require permisos separados.
- **O inicio oficial segue bloqueado** pola restauración do backup, información/consentimento de menores, probas reais de navegador e email, e revisión final de seguridade.

Guías: [fase 2](docs/PHASE2_ROLLOUT.md), [despregamento de Workers](docs/despliegue.md), [incidencia #10](https://github.com/cbaloncestoredeiras-cmyk/Fantasy-CB-Redeiras/issues/10).

## Pendiente para lanzamiento

**Bloqueantes restantes:** comprobación manual de invitaciones y accesos reales, revisión documental de privacidad y consentimiento de menores, y **copia de seguridad completa con restauración probada** (la exportación JSON de la web es parcial). Las pruebas SQL reversibles cubren mercado, 3 fichajes, votos, publicación, cálculo y rectificación; no reemplazan un ensayo independiente. Consulta [operaciones fases 0/1](docs/PHASE01_OPERATIONS.md).

**Mejoras siguientes, no prometer como presentes:** ligas privadas, duelos, pronósticos, notificaciones, juego multiclub operativo, comparación avanzada, equipo ideal automatizado, estadísticas de popularidad. La arquitectura está preparada para ampliarlas, pero estas funciones **no están implementadas aún**.

**No subir claves secretas ni contraseñas a GitHub.** Las claves publicables de Supabase pueden entrar en la compilación estática; las secret keys jamás.

## Fotos e identidade visual

- Escudo oficial do CB Redeiras no inicio de sesión, menú, portada e favicon; ficheiro optimizado en `site/assets/redeiras-logo.webp` (orixinal facilitado polo club).
- **Administración → Fotografías dos xogadores**: subir ou retirar retratos JPG/PNG/WebP (orixinais de ata 25 MB, convertidos no navegador a WebP e máximo 960 píxeles no lado longo).
- As fotos están gardadas no bucket **privado** `player-photos` de Supabase. Só as contas autenticadas do club poden obter unha URL asinada; só as administradoras poden subir ou retirar fotos.
- Comprobar consentimento/lexitimación antes de subir retratos, especialmente de menores. Non se gardan metadatos EXIF no ficheiro comprimido.
- Probas visuais e de subida pendentes de verificación desde un navegador real.

## Control de publicación y rectificaciones (fase 1)

- Administración permite vista previa del cálculo **antes de publicar** y registro de corrección con motivo.
- La corrección de una jornada publicada se bloquea si ya existen jornadas, fichajes o equipos creados después que dependan de los precios históricos; no se reescriben operaciones pasadas.
- La exportación administrativa es un **respaldo parcial**, no una restauración completa. Consulta [el plan de backup y seguridad](docs/PHASE01_OPERATIONS.md).
