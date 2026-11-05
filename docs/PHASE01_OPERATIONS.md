# Fases 0 y 1 · Seguridad, recuperación y control de competición

Fecha de revisión: 2026-11-05. Mantener **la temporada desactivada** hasta superar el control de salida.

## Qué implementan las migraciones

- `202611050003_preview_and_revisions.sql`: cálculo servidor común de puntuaciones, bonus de victoria y voto, Bróker y puntuaciones de equipos. `fantasy_preview_fixture` no modifica datos. `fantasy_publish_fixture` publica transaccionalmente, comprueba las 72 h y exige temporada activa. `fantasy_correct_fixture` rectifica con motivo e historial (`fantasy_revisions`).
- **Límite intencionado de correcciones:** rechaza la rectificación si hay una jornada posterior publicada o fichajes posteriores. No altera silenciosamente efectivo, operaciones cerradas o fichajes a precios históricos. Para correcciones antiguas con operaciones dependientes hará falta un procedimiento adicional de reconciliación económica, con aprobación expresa.
- `202611050004_admin_and_exports.sql`: panel restringido para ver el estado de cuentas y sus roles/vinculaciones, cambios auditados y exportación JSON.
- `202611050005_member_security.sql`: evita reasignar automáticamente la identidad de voto de un jugador o eliminar el último administrador por la vía de alta de miembros.

## Prueba de una jornada sin modificar datos reales

En Supabase, ejecutar los tests transaccionales `tests/phase01.smoke.sql` y `tests/phase01.market_vote.sql` usando una conexión de administración **solo en un entorno de prueba** o con las garantías de transacción/ROLLBACK correspondientes. Cubren mercado, fichajes, cierre, voto, publicación y rectificación con **ROLLBACK**. Los test unitarios y de navegador de GitHub no reemplazan esta prueba.

Para una simulación independiente, crear una rama/proyecto de Supabase **requiere aprobación del coste**. La rama debe poblarse con datos sintéticos: los usuarios de producción y sus fotografías no deben copiarse sin base jurídica.

Criterio de salida: probar con dos identidades distintas (admin y participante), verificación de límites temporales, fichajes, permisos RLS, resultados, Bróker, rectificaciones y recuperación de un respaldo en una base de datos aislada.

## Copias de seguridad: dos niveles distintos

**A. Exportación desde la aplicación (ya disponible al instalar migraciones):** Administración → Exportar datos → Descargar JSON. Incluye la competición, roles y vinculaciones (puede contener emails y votos privados). Guardar el archivo cifrado fuera del servidor y restringir acceso; no publicarlo en GitHub. **No basta para reconstruir todo el servicio**: no exporta contraseñas/sesiones, configuraciones externas de Auth, Edge Functions ni binarios de Storage.

**B. Copia de recuperación real (pendiente de habilitar y ensayar):** para el esquema y datos utilizar la herramienta oficial de Supabase. Los planes Free no tienen copias automáticas garantizadas y los backups de PostgreSQL no incluyen los objetos binarios de Storage. Consultar https://supabase.com/docs/guides/platform/backups y https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore .

1. Instalar Supabase CLI y Docker en un equipo seguro. Obtener la cadena de conexión en el dashboard de Supabase → Connect, sin enviarla por correo ni escribirla en chats.
2. Desde un terminal protegido, realizar una exportación antes de cambios críticos y, tras el lanzamiento, con una frecuencia programada:
   ```bash
   supabase db dump --db-url "$DATABASE_URL" -f roles.sql --role-only
   supabase db dump --db-url "$DATABASE_URL" -f schema.sql
   supabase db dump --db-url "$DATABASE_URL" -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
   ```
   `DATABASE_URL` contiene credenciales; conservarla solo en el entorno de ejecución, nunca en logs/repositorios.
3. Respaldar **por separado** todos los objetos de `storage/player-photos` (no solo las rutas del SQL); descargar los archivos con acceso autorizado y un manifiesto de nombres y sumas SHA-256.
4. Guardar conjuntamente SQL, ficheros, manifiesto, versión Git y registro de fecha en almacenamiento cifrado externo.
5. **Probar la restauración** en un proyecto/base aislados y verificar recuentos, permisos, logins de prueba, enlaces de fotografías, precios y clasificaciones. No restaurar sobre producción sin copia previa y ventana de mantenimiento.
6. Documentar el resultado y responsable de cada ensayo. Sin un ensayo real, el respaldo no se considera verificado.

## Seguridad y protección de menores

- La aplicación es **solo por invitación**. Los roles de administrador se verifican en el servidor; no confiar en controles visuales del navegador.
- La tabla de revisiones y la exportación son accesibles únicamente a administradores. No introducir claves de servicio o credenciales SMTP en frontend, archivos exportados o GitHub.
- Confirmar y registrar la información y autorización adecuada para fotos y datos de jugadores menores, incluida la edad y la base jurídica. Las casillas de la aplicación no sustituyen la verificación documental.
- Revisar explícitamente los roles administrativos y habilitar **Leaked Password Protection** en la configuración de Supabase Auth si está disponible en el plan contratado.
- El aviso de Supabase sobre funciones SECURITY DEFINER es un hallazgo de revisión: varias funciones requieren ejecutar como autenticado y validan explícitamente `private.is_admin` o el propietario de los datos. Auditoría manual obligatoria tras cada migración.
- **No activar la temporada** hasta que todas las comprobaciones de fase 0 y fase 1 tengan resultado documentado.

## Salida a producción

1. Verificar permisos de `public.fantasy_preview_fixture`, `public.fantasy_correct_fixture`, `public.fantasy_admin_participants` y `public.fantasy_admin_export`.
2. Confirmar la vista previa y la publicación producen exactamente los mismos puntos y precios.
3. Probar la rectificación más reciente y que se rechazan rectificaciones antiguas si hay movimientos posteriores.
4. Probar cambios de roles, previniendo suplantación, acceso a fotos de otros clubes, desactivación del último administrador y acceso de invitados no aceptados.
5. Realizar exportación administrativa y **copia de recuperación completa**; ensayar restauración.
6. Solo entonces autorizar explícitamente activar la temporada en producción.

