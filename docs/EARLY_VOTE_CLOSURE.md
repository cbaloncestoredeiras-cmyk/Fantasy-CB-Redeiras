# Cierre anticipado de votaciones (100 %)

La jornada se puede previsualizar y publicar **después de transcurrir 72 horas** o **después del cierre anticipado explícito de un administrador**, siempre con estadísticas, convocatoria y resultado completos.

## Reglas

- El cierre anticipado se ofrece exclusivamente en **Administración → Seguimento da votación** cuando todos los votantes con derecho (convocados con cuenta y entrenador autorizado) han completado tres votos 3-2-1 válidos.
- El **porcentaje debe ser 100 %**; el servidor lo recalcula bajo bloqueo transaccional del partido para evitar carreras. No se confía en el porcentaje calculado por el cliente.
- La operación exige fin del partido, resultado guardado, acta estadística completa y que aún no hayan vencido las 72 horas.
- La confirmación informa de que **no se podrán modificar las papeletas** tras cerrar. No publica automáticamente ni cambia puntos, precios o ranking.
- `fixtures.votes_finalized_at` registra el cierre; si vence el plazo naturalmente, la previsualización se desbloquea sin exigir pulsar ningún botón.
- `fantasy_vote` rechaza papeletas tras el cierre, y la interfaz oculta las votaciones cerradas. Se preserva la hora de cierre al publicar la jornada.
- Se audita con el evento `close_votes_early`, guardando solo recuentos; las elecciones individuales siguen privadas.

## Operación de administración

1. Seleccionar la jornada y pulsar **Actualizar votos**.
2. Confirmar que todos los habilitados y el entrenador (si tiene permiso) aparecen con **Votou**.
3. Pulsar **Pechar votación e habilitar vista previa** y aceptar la advertencia de irreversibilidad.
4. Entrar en **Vista previa, publicación e rectificación**, pulsar **Calcular vista previa**.
5. Verificar valoración PIR, bonificación de vestuario, puntuaciones de cada quinteto y variaciones de mercado.
6. Publicar únicamente cuando todo esté revisado.

**No cerrar automáticamente al alcanzar el 100 %**: el cierre requiere una decisión administrativa, porque las personas pueden cambiar sus votos mientras el plazo siga abierto.

## Comprobaciones

- Cliente: `npm run check && npm test && npm run build`, incluido el test de voto oculto tras el cierre.
- Servidor: cierre admin permitido únicamente con el 100 % y datos completos; voto posterior rechazado y vista previa permitida; no admin denegado.
- El test transaccional del servidor se ejecuta con rollback: no debe cerrar ninguna votación real durante las pruebas.
