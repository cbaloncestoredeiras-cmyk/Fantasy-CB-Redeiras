# Preparación de infraestructura — Fantasy CB Redeiras

**Estado: preparación, no publicar todavía.**

## Tareas del titular del club (sin compartir contraseñas)
1. Crear cuenta Cloudflare en https://dash.cloudflare.com/sign-up (plan Free). No conectar el repositorio ni desplegar hasta tener un frontend que no exponga controles de demo.
2. Crear cuenta Supabase en https://supabase.com/dashboard. New Project, nombre `fantasy-cb-redeiras`, región EU Central (Frankfurt) si está disponible. Elegir contraseña fuerte para la base de datos y guardarla fuera del repositorio. Plan Free inicial.
3. Confirmar únicamente que ambas cuentas existen. Opcionalmente, compartir el identificador o URL pública del proyecto Supabase cuando se solicite. **Nunca facilitar contraseña, access token, service_role ni secret keys.**

## Tareas de desarrollo pendientes
1. Implementar frontend real, eliminando permisos simulados de `prototype/index.html`.
2. Diseñar migraciones PostgreSQL y ejecutar pruebas de RLS en Supabase aislado.
3. Registro por invitación, roles y administración autenticada.
4. Validar los fichajes por servidor: titularidad, cinco jugadores, BA + AP/P, presupuesto, tres cambios, fecha de cierre y ausencia de estadísticas pendientes.
5. Importar estadísticas CSV/XLSX y PDF (revisión antes de publicar).
6. Votaciones de convocados: una papeleta por convocado, 3/2/1, sin autovoto, durante 72 horas.
7. Actualizaciones atómicas de puntuaciones, precio Bróker y clasificaciones. Historial y auditoría.
8. Verificar privacidad de menores, derechos de interesados, información legal, plazos de retención y proveedores.
9. Pruebas multiusuario, de concurrencia, de bloqueo horario y restauración.

## Cuando esté listo el frontend real
- Cloudflare dashboard → Workers & Pages → Create application → Pages → Connect to Git.
- Conectar el GitHub del club y seleccionar `cbaloncestoredeiras-cmyk/Fantasy-CB-Redeiras`.
- Rama `main`; las opciones de build dependerán del frontend definitivo (no adivinar todavía).
- Supabase: configurar URL del proyecto y clave publicable en variables del frontend; **service_role solo en entorno servidor seguro**.
- Revisar antes de activar DNS o compartir el enlace. El repositorio privado no convierte una web desplegada en privada.

**No ejecutar SQL de prueba ni exponer formularios de acceso sin verificación técnica.**
