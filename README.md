# Fantasy CB Redeiras

Aplicación Fantasy del CB Redeiras. **En desarrollo: no apta todavía para participantes reales.**

## Lo que hay ahora

- [Prototipo interactivo V5](prototype/index.html): funciona en el navegador con datos locales. **No dispone de autenticación real ni de base de datos compartida**.
- [Textos legales provisionales](prototype/legal.html): requieren verificación antes de abrir registros, particularmente para menores.
- [Datos y precios iniciales de los 18 jugadores](data/jugadores.json).
- [Calendario](data/calendario.csv).
- [Pasos para preparar el despliegue](docs/despliegue.md).

## Reglas confirmadas

- 18 jugadores (15 sénior y 3 juniors: Mateo, Gil y Yosue).
- Presupuesto inicial **6.000.000 € virtuales**.
- Quinteto de **5**: al menos **1 BA** y **1 AP/P**, ocupados por dos jugadores distintos; 3 plazas libres.
- Máximo **3 transferencias por jornada**.
- Inicio previsto: jornada 5, sábado **7/11/2026, 20:00** (Europe/Madrid). Horarios modificables cuando se confirman los martes.
- Puntuación: valoración ACB/PIR, bonus de victoria del 20 % sobre valoración positiva y premio por votaciones del vestuario.
- Votan convocados con 3/2/1 a tres compañeros distintos; ventana de 72 horas desde el fin del encuentro.
- Bróker: cambio de precio máximo ±15 % por jornada. **Calibración pendiente**.
- Si faltan resultados, se permiten simulaciones de fichajes, pero no su confirmación.
- Acceso a la futura aplicación real por invitación; un único administrador inicial.

## Estado y seguridad

El prototipo es una prueba local: contiene controles de administrador **simulados**. No constituye un sistema seguro, aunque esté guardado en un repositorio privado. No desplegar ni habilitar registros de usuarios reales hasta desarrollar autenticación, reglas RLS, operaciones transaccionales, importación validada, votaciones seguras y pruebas de privacidad. No subir contraseñas ni claves secretas.

Infraestructura prevista: **GitHub → Cloudflare Pages** (frontend) + **Supabase** (PostgreSQL/Auth).
