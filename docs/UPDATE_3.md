# Fantasy CB Redeiras · Actualización 3 (V1.3)

Data: 6 de novembro de 2026. Cambios **só na interfaz e no comportamento do navegador**. Non se modifica Supabase nin as regras competitivas, os permisos, o orzamento, a puntuación, os equipos ou os prezos. A actualización non activa a tempada.

## Identidade visual Redeiras

- Mantense o escudo orixinal xa existente en `site/assets/redeiras-logo.webp`; non se altera.
- Paleta de referencia: azul noite `#011d33`, celeste principal `#33A9DB`, azul camiseta `#63afe0`, celeste claro `#B2EAFE`, e azul complementario `#1F3F88`.
- Lixeiros motivos SVG propios (olas, rede e banco de peixes) nas zonas de portada, acceso, axuda e navegación. **Nada de fondos recargados en táboas de administración ou datos**.
- Tipografía: mantense a pila Inter/sistema do código actual. A fonte corporativa exacta non consta no repositorio: non se inventa unha fonte oficial nin se inclúen arquivos de fontes de terceiros.
- Ficheiro `site/marea.css` introdúcese **despois** dos estilos anteriores para manter tamaños e comportamentos xa probados. Debe comprobarse o aspecto en 320–1920 px.

## PWA: instalación sen tenda

- Manifeso `site/manifest.webmanifest` cos nomes, cor, iconas PNG 192 e 512 e modo independente.
- `scripts/install-icons.mjs` xera os PNG reais e a icona iOS de 180 px ao compilar; os arquivos binarios non se gardan en GitHub. Son monogramas «R» con ondas nos tons do club, **non unha substitución do escudo institucional**.
- Hai un `service worker` de alcance só da propia web. Garda en caché recursos **públicos** de interfaz. Exclúe configuración, respostas de Supabase, sesións de usuario, datos privados, fichaxes e fotografías privadas.
- Se non hai conexión, as rutas de navegación amosan unha páxina informativa **sen datos da conta**, e non permiten realizar fichaxes offline.
- En iOS o usuario debe instalar desde Safari → Compartir → Engadir á pantalla de inicio; a solicitude automática de instalación en navegador non está dispoñible en iOS.
- As opcións nativas de instalación varían segundo navegador e dispositivo.

## Guía interactiva

- Nova ruta **Guía** no menú normal e no menú «Máis» do móbil. Está dispoñible en calquera momento.
- Catro pasos: construír o quinteto, xestionar orzamento, peche e publicación de xornada, e clasificación/votación.
- A portada incorpora unha invitación á guía, un atallo de instalación e o estado do mercado. Non mostra horarios inventados.

## Avisos voluntarios

- Permiso solicitado só cun clic explícito en **Activar avisos neste dispositivo** da Guía, se o navegador ofrece Notification e Service Workers.
- Aviso cando queda menos dunha hora para o peche **só se a app permanece aberta**. Só se envía un aviso por partido/dispositivo, sen correo nin nome do participante.
- O usuario pode desactivar estes avisos no mesmo panel.
- **Non son push remotas**: non existe servidor de subscrición nin notificación garantida coa app pechada; esa opción necesitará infraestrutura de backend e unha avaliación separada de privacidade.
- Un temporizador visual actualiza o texto de peche da portada, pero as fichaxes reais seguen verificándose no servidor.

## Probas de V1.3

- Unitarias: conta atrás, estado inactivo/pechado, guía, manifesto e PNG 180/192/512 xerados e descomprimibles, illamento do service worker.
- Navegador: apertura da guía, navegación móbil, ausencia de desbordamento horizontal, modal e mercado existentes, instalación do manifesto e nova decoración.
- CI: `Checks` e `Responsive Browser QA`.
- Compilación: `npm run build` xera `dist/` e as iconas PNG; `npm.cmd run deploy` publica no Cloudflare configurado.

## Verificación de publicación

1. Fusionar a PR en `main` só cando pasen todas as probas.
2. Verificar o despregamento de Cloudflare, automático ou `npm.cmd run deploy` desde a copia actualizada en VS Code.
3. No móbil e no escritorio comprobar: portada mariña, Guía en catro pasos, instalación/indicacións, temporizador e vista normal do Mercado.
4. Aceptar as notificacións só en dispositivo de proba. Confirmar que non se solicita permiso ao abrir a web.
5. Confirmar que as pantallas de administración, prezos, fichaxes e votacións seguen intactas.

Este cambio non altera o estado da tempada. **Non activar a tempada por automatismo dunha actualización.**
