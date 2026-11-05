# Fases 0/1 · revisión de cierre (5 noviembre 2026)

## Verificación real realizada
- CI de GitHub para la rama main: `Checks` correcto el 05/11/2026.
- Proyecto Supabase `vfxazecrdxrtoqzdhclh`: activo y saludable; 21 tablas públicas con RLS y políticas de lectura.
- Estado de competición: temporada no activada; 18 jugadores; 12 miembros; 12 retratos almacenados.
- Prueba de permisos (transacción de solo lectura): el rol `anon` no pudo leer clubes/jugadores; un miembro participante únicamente pudo leer su membresía y fue rechazado por los RPC de exportación y vista previa exclusivos del admin.
- Migraciones existentes de cálculo, publicación, rectificación, auditoría, exportación y gestión de participantes: presentes en Supabase.
- Refuerzo añadido: trigger atómico que impide degradar/borrar el último administrador incluso ante cambios concurrentes (`202611050007_atomic_admin_guard.sql`); test transaccional en `tests/phase01.last_admin.sql`.

## Bloqueantes para considerar la fase 0 completamente terminada
1. **Copia completa y restauración**: la exportación JSON no incluye Auth ni binarios de Storage; se requiere una extracción con herramientas oficiales, copia separada de fotos y restauración en entorno independiente.
2. **Ensayo integrado end-to-end**: probar dos sesiones reales (administrador y participante) con invitación, acceso, mercado, fichajes, votos, publicación y rectificación. Los SQL de simulación no sustituyen el ensayo del navegador.
3. **Protección de menores**: validar información y autorizaciones adecuadas antes de abrir a participantes; hay fotografías privadas que requieren base jurídica.
4. **Configuración Auth**: Supabase Security Advisor señala `Leaked Password Protection Disabled`; activarlo en el dashboard si disponible.
5. **Revisión de administradores**: figuran dos cuentas con rol `admin` en la base; debe verificarse si las dos están autorizadas, ya que el diseño inicial contemplaba un único administrador.
6. **Seguridad del código**: GitHub informa repositorio público y `main` no protegida. Decidir si privatizarlo y activar protección de cambios antes del lanzamiento.

## Fase 1 funcional
- Panel administrativo con convocatoria, importación, vista previa, publicación, rectificación con motivo, historial, participantes/invitaciones y exportación: implementados.
- La publicación y la vista previa usan cálculo común; la rectificación se bloquea cuando existen dependencias históricas y no reescribe sin autorización.
- Faltan pruebas end-to-end con cuentas reales y restauración antes de dar la fase 1 por cerrada operativamente.

**No activar la temporada** ni copiar datos de menores a un ambiente de prueba sin respaldo legal.

Véase `docs/PHASE01_OPERATIONS.md` para operaciones y recuperación.

## Resultado de ejecución (05/11/2026)
- `tests/phase01.smoke.sql`: **correcto**. Se verificaron vista previa, publicación, la igualdad de resultados antes/después, el registro de una rectificación, las dependencias históricas y la denegación a participantes.
- `tests/phase01.market_vote.sql`: **correcto**. Se probaron mercado, los tres cambios, el bloqueo del cuarto, cierre de mercado y voto válido/propio prohibido.
- `tests/phase01.last_admin.sql`: **correcto** tras aplicar la migración `phase01_atomic_admin_guard` en Supabase.
- Todas las pruebas SQL anteriores se ejecutaron con `BEGIN` y `ROLLBACK`. La comprobación posterior confirmó temporada inactiva, 0 equipos, 0 transferencias, 0 votos y 0 revisiones.
- La rama principal pasó `Checks` después de fusionar la [PR #9](https://github.com/cbaloncestoredeiras-cmyk/Fantasy-CB-Redeiras/pull/9).
- El plan confirmado de la organización Supabase es **Free**. `Leaked Password Protection` requiere Pro o superior; esta opción no se habilitará a cambio de costes no aprobados. Revisar otros ajustes de robustez de contraseña de Free.

El detalle de los pasos pendientes, con casillas de verificación, consta en la [incidencia #10](https://github.com/cbaloncestoredeiras-cmyk/Fantasy-CB-Redeiras/issues/10).
