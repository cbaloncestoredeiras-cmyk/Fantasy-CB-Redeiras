# Fase 2 · Lanzamento controlado do Fantasy Redeiras

Data de preparación: 5 de novembro de 2026. **A tempada permanece desactivada** ata confirmar todos os requisitos. A existencia de código/controles non equivale a autorización legal, backup restaurable ou proba real de navegación.

## Responsables
- Emilio Carballo: administrador e responsable de coordinación do club.
- Brais: segundo administrador autorizado polo club; colabora no desenvolvemento e corrección de erros.
- O permiso `admin` do Fantasy **non concede acceso ao repositorio GitHub nin á organización Supabase**. Estes permisos deben xestionarse por separado co titular correspondente, segundo as tarefas. Nunca compartir contrasinais, tokens ou claves de servizo.

## Sistema de saída
A migración `202611050008_phase2_launch_gate.sql` incorpora:
- `fantasy_launch_checks`, táboa só de lectura para administradores desde a API, con cambios obrigatoriamente por RPC auditada.
- `fantasy_launch_status`, que devolve o avance das 5 verificaciones.
- `fantasy_set_launch_check`, que rexistra ou revoga cada comprobación con autor, data e nota, pero non permite alterala despois de activar.
- `fantasy_activate_season`, que agora esixe **as cinco verificaciones** e mantén os controis anteriores (horario e xogadores).
- O panel de administración amosa o avance e desactiva o botón de lanzamento mentres hai pendentes.

**Importante:** non introduzas nomes de menores, correos, fotos, contrasinais ou documentos privados no campo de notas. Describe a evidencia, gardada fóra do repositorio público e con acceso restrinxido. Marcar unha tarefa de forma incorrecta non a converte nunha verificación real.

## Verificaciones antes de activar
1. **backup_restore:** realizar copia íntegra de PostgreSQL, información de Auth/configuración necesaria e arquivos `player-photos` por separado; restaurar e comprobar integridade nun entorno independente. Non se considera suficiente o JSON administrativo.
2. **minor_privacy:** verificar e documentar base de lexitimación, información e autorizacións correspondentes para participantes menores e uso de fotografías. Revisar as 12 fotos subidas.
3. **browser_e2e:** dous navegadores/sesións reais (admin + participante): login, permisos, navegación móbil, creación de quinteto, límite de 3 fichaxes, voto 72 h, corrección e puntuación; nunca publicar estatísticas reais de proba.
4. **email_invites:** invitación a enderezos autorizados de proba, aceptación, recuperación de contrasinal, redirección e límites de envío. Non invitar participantes reais antes da revisión de privacidade.
5. **security_review:** validar RLS, ausencia de segredos públicos, administración de Emilio e Brais, configuración Auth, protección de rama e revisión de configuración de Cloudflare.

## Secuencia de traballo
- Confirmar [probas das fases 0/1](PHASE01_FINAL_AUDIT.md).
- Executar `tests/phase2.launch.sql` baixo **transacción que remata en ROLLBACK** nun entorno controlado e comprobar que a base queda inactiva.
- Validar a URL pública de Cloudflare e que o build correspondente se despregou (GitHub Actions non equivale automaticamente a unha publicación exitosa).
- Rexistrar as cinco evidencias desde o panel. Cada unha pode ser confirmada por Emilio ou Brais.
- Unha vez completas, activar manualmente a temporada tras confirmación final do responsable do club.
- Verificar inmediatamente apertura do mercado e que os participantes vexan os datos correctos; comprobar a primeira xornada e hora.

## Se algo falla
- Non completar nin falsear as comprobacións; conservar a tempada desactivada.
- Ante erro na integración, reverter código a un commit anterior mediante GitHub e seguir as instrucións de Cloudflare.
- Ante problema con datos reais, deter cambios e seguir a política de backup/restauración. Non manipular directamente saldos ou prezos de xornadas xa publicadas.
- Non utilizar o SQL de simulación directamente na base real fóra dunha transacción controlada.

## Pendentes externos
A documentación de privacidade, o backup coa restauración verificada, as probas de navegador e o email real non se poden certificar só desde o código. O estado de tarefas en [GitHub #10](https://github.com/cbaloncestoredeiras-cmyk/Fantasy-CB-Redeiras/issues/10) segue aberto ata completalos.
