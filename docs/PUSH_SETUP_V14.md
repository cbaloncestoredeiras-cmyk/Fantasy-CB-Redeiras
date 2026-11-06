# Activación de Web Push · Fantasy Redeiras V1.4

**Estado**: o código e as táboas están preparados, pero os avisos remotos **non se enviarán** ata completar a configuración seguinte, autorizar un dispositivo e verificar unha entrega. Non solicitar contrasinais nin claves na conversa ou no repositorio. A conta privada do club debe custodiar estes segredos.

## 1. Xerar as claves unha única vez no ordenador autorizado
Nun terminal PowerShell con Node.js:

```powershell
npx.cmd --yes web-push@3.6.7 generate-vapid-keys
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

O primeiro comando dá unha chave **PUBLICA** e outra **PRIVADA** VAPID. O segundo xera o segredo de cron. Gardar os tres nun xestor de segredos privado. A chave privada e o segredo de cron **nunca** poden aparecer en código GitHub, fotos, rexistros compartidos, issues ou chat. Non rotar VAPID sen un plan de resubscrición: as subscricións existentes poden deixar de servir.

## 2. Secrets da Edge Function
En <https://supabase.com/dashboard/project/vfxazecrdxrtoqzdhclh/functions> ir a configuración de **Secrets** e establecer:

- `VAPID_PUBLIC_KEY` → chave pública.
- `VAPID_PRIVATE_KEY` → chave privada.
- `VAPID_SUBJECT` → `mailto:cbaloncestoredeiras@gmail.com`.
- `FANTASY_PUSH_CRON_SECRET` → segredo aleatorio de polo menos 32 caracteres.

`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` deben permanecer **só no servidor**; a función léas como segredos do proxecto, nunca no frontend. Non facer unha proba de envío real antes de validar os permisos dun usuario que o aceptou.

## 3. Publicar a chave pública no cliente
Ao executar o despregamento de Cloudflare, indicar **só a chave pública** en PowerShell, non a privada:

```powershell
$env:PUBLIC_VAPID_PUBLIC_KEY = "PEGA_AQUI_SÓ_A_CHAVE_PUBLICA"
npm.cmd run deploy
Remove-Item Env:PUBLIC_VAPID_PUBLIC_KEY
```

A partir dese despregamento, a sección **Guía → Avisos coa app pechada** ofrecerá un botón de subscrición **voluntario**, se o navegador é compatible. En iPhone debe instalarse antes como app desde Safari. A alta almacena só os datos necesarios do endpoint no Supabase privado.

## 4. Programar a revisión de mercados a pechar
En Supabase habilitar, cando se vaia activar o envío, as extensións **pg_cron** e **pg_net** desde *Database → Extensions*. Gardar na **Supabase Vault** mediante a interface privada:

- `fantasy_push_url` → `https://vfxazecrdxrtoqzdhclh.supabase.co/functions/v1/fantasy-push-send`
- `fantasy_push_cron_secret` → o mesmo segredo de cron da Edge Function.

Despois, no SQL Editor de Supabase, crear o traballo programado usando **só referencias a Vault**, sen poñer segredos literais no SQL:

```sql
select cron.schedule('redeiras-market-push', '*/5 * * * *', $task$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name='fantasy_push_url'),
    headers := jsonb_build_object(
      'Content-Type','application/json',
      'x-fantasy-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='fantasy_push_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 10000
  );
$task$);
```

A función comproba o segredo e consulta a base de datos con `service_role`, usa só subscricións voluntarias e xornadas activas **dentro dos 60 minutos anteriores ao inicio**, e marca cada envío para evitar duplicidades. Os tokens Web Push e as claves privadas non se rexistran nos logs. Se hai un erro 404/410 do servizo de push, a subscrición queda desactivada. Inclúe máximo de tres intentos. Non dispara notificacións antes de que a tempada estea activa nin con datas sen confirmar.

A operación de cron non debe habilitarse ata que existan as claves correctas e se verificase un envío nun **dispositivo de proba que consentiu expresamente**.

## 5. Proba real e control
Comprobar: permiso desde clic; subscrición rexistrada e RLS correcta; aviso chegando coa app pechada nun dispositivo compatible; non hai duplicidade local/remota; revogación e saída de sesión eliminan o endpoint. Non alterar horarios oficiais para facer a proba en produción. Usar un entorno de probas independente para ensaiar a entrega se aínda falta unha hora real de mercado.

O envío de push non é garantía absoluta: cada navegador/OS pode demorar ou bloquear avisos. Seguir usando o horario oficial visible na app.

Se cómpre deter os envíos:

```sql
select cron.unschedule('redeiras-market-push');
```

Non eliminar o rexistro de usuarios nin limpar os seus datos da competición para desactivar a función.
