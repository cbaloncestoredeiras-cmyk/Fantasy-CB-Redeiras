# Redeiras Workspace · Diseño inspirado en ClickUp

Referencia de principios visuales: [ClickUp Design System en Refero Styles](https://styles.refero.design/style/efcb73cb-b84a-4ae7-9a2b-e1116f79f130).

## Objetivo
Actualizar toda la capa visual del Fantasy CB Redeiras sin copiar marcas, pantallas o código de ClickUp y **sin cambiar lógica de negocio**. Priorizar los móviles y la legibilidad de mercado, quinteto, clasificación y administración.

## Tokens y criterios
- Lienzo gris blanco `#f6f8fb`; tarjetas blancas; bordes `#e4eaf0`; texto `#112c42`.
- Azul marino del club `#071d33` para CTA principal y títulos. Celeste Redeiras `#33a9db` para estados activos, foco y métricas.
- Medidas basadas en 4 px; tarjetas de 14 px; controles con radio completo; sombra apenas visible.
- Interfaz densa pero escaneable, barras y tablas limpias, menús explícitos con iconos SVG vectoriales sin CDN.
- La cancha, las fotos y el escudo conservan el carácter deportivo del club. Sin recursos extra de Refero o ClickUp.
- Fuente local de sistema con preferencia por Plus Jakarta Sans/Inter si ya están instaladas, **sin cargar fuentes de terceros**.

## Implementación
`site/workspace.css` es el último archivo CSS de la página: sus reglas sobrescriben de manera limitada el tema anterior sin borrar su comportamiento responsive.
`site/nav-icons.js` aporta iconos vectoriales accesibles (`aria-hidden`).
`site/pages.js` conserva controles, atributos `data-page`, clics, búsqueda, confirmación de transferencias y HTML de las páginas; introduce solo clases de estilo e iconos.
`site/index.html` adapta los colores del navegador/PWA y carga el nuevo CSS.

## Protección de los datos
Sin cambios en Supabase, las políticas RLS, los jugadores, los precios, la clasificación, los votos ni los fichajes. Los cambios de diseño pueden revertirse eliminando el CSS final y recuperando los iconos de navegación antiguos.

## QA
Pruebas de Node y de navegador a 320, 375, 390, 430, 768, 820, 1024, 1280, 1440 y 1920 px; navegación, búsqueda, administración, fichas de jugadores y acceso siguen operativos. Revisar capturas de las pruebas CI antes de introducir cambios posteriores.
