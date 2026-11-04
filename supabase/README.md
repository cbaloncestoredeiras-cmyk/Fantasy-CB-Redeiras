# Estado del backend — NO ejecutar aún en producción

Los archivos en `supabase/migrations` son **borradores iniciales**, pendientes de revisión y pruebas de base de datos.

- `202611040001_core_schema.sql`: tablas y políticas de lectura Row Level Security (RLS). No ofrece permisos de escritura desde el navegador.
- `202611040002_initial_club_and_market.sql`: datos legales del club, temporada 2026/27, 18 jugadores, posiciones, precios **provisionales** y J5 sábado 7/11/2026 a las 20:00 horario de España peninsular.

## Pendientes antes de ejecutar/migrar
- Definir e implementar invitaciones, alta de perfiles y asignación segura del administrador (no por comparación de emails en JS).
- Implementar transacciones atómicas de alta de equipo y fichajes validadas por servidor, sin atajos RLS.
- Añadir pruebas automatizadas de RLS, de aislamiento entre usuarios, de presupuesto de 6M, de 1 BA + 1 AP/P, y límite 3 fichajes.
- Permitir convocados juniors, pausas y aplazamientos, cierre al inicio real, voto 72 horas tras final real y auditoría.
- Importación de estadísticas con comprobación de PIR distinto de EFF.
- Revisar el tratamiento de datos y textos legales antes de admitir usuarios menores.

## Supabase
1. Crear proyecto del club en región europea.
2. Copiar solo la **Project URL** para coordinar la conexión; no se necesita la contraseña de la base de datos, ni una secret key.
3. El frontend utilizará una **publishable key** pública (`sb_publishable_...`), almacenada como variable de entorno de Cloudflare cuando llegue el momento. Las claves `sb_secret_...` son solo para servidores y nunca se comparten por chat ni repositorio.
4. Crear cuentas e invitaciones desde procedimientos controlados; no ejecutar scripts de prueba en una base compartida con usuarios reales.

## Cloudflare
Iniciar sesión con GitHub no equivale a conectar un repositorio a Cloudflare Pages. Esperar al frontend seguro para crear y conectar el proyecto Pages. La integración Git puede habilitar despliegues automáticos a partir de cada push.
