# Entradas 7ma edición: Mercado Pago + QR + WhatsApp automático

Sábado 28 y domingo 29 de noviembre · de 11 a 17 hs · hasta 50 lugares.

Valor regular de la Fase 1: $120.000 por persona. Se presenta como promoción:

- **Seña + saldo** (plan `SPLIT`): seña de $60.000 que reserva el lugar y saldo de $60.000 antes del sábado 28 ($120.000).
- **Pagando hoy en 1 pago** (plan `FULL`): $72.000 (40% off, se ahorra $48.000). Es "pagando hoy", sin vencimiento: no se dice "solo por hoy".
- **Promo para dos** (plan `DUO`, opción "¿Son 2?" en la web o por el bot): $120.000 por las dos personas en 1 pago ($60.000 cada una). Se crean 2 entradas, una por persona con su WhatsApp, y se pagan juntas con un solo checkout. Cada entrada guarda en `source` el código de la otra ("promo para dos con M7-…" la de quien compra, "promo para dos de M7-…" la de la otra persona). Al acreditarse el pago se registra la mitad en cada entrada (la segunda con id `<payment_id>:<código>`) y a cada una le llega su QR. Si una de las dos se paga aparte o cambia de forma de pago, la otra pasa a pago único.

Precios y fechas: `app/lib/entradas.ts`. Todo lo demás (web, WhatsApp, Mercado Pago, admin) los toma de ahí.

Si cambian los precios, cada entrada conserva el total con el que se pagó: una entrada que ya tiene un pago (o paga un link armado antes del cambio) mantiene su precio original, y una que no tiene ningún pago se cobra con el precio nuevo. Hasta el 7/11/2026 el plan en 2 pagos era de $100.000 (2 × $50.000).

## Cómo funciona

**Se compra de dos formas:**

1. **Desde la web:** botón "Comprar entrada" o `metamorfosis.vip/entradas`. La persona elige cómo pagar, deja nombre y WhatsApp, y paga con Mercado Pago.
2. **Desde el WhatsApp:** la persona escribe al WhatsApp Business y el bot le responde las dudas. Si quiere anotarse, le pide nombre y apellido y la forma de pago, y le manda en el chat su link de Mercado Pago (`metamorfosis.vip/entradas/M7-XXXXXXXX/pagar`).

**Después del pago, todo es automático:**

- Mercado Pago avisa a la web (`/api/mercadopago/webhook`). Si la persona vuelve a la web después de pagar, la web también lo verifica en ese momento.
- La entrada pasa a **Pagada** o **Con saldo**, y le llega un **WhatsApp** con la imagen de la entrada y su **QR para entrar al evento**.
- Si pagó la mitad, en ese mismo WhatsApp le llega el link para pagar el saldo. Hasta el viernes 27 le llega un recordatorio cada 3 días.
- Si se anotó y no pagó, le llega un solo recordatorio al día siguiente.
- El **viernes 27** todas las personas con entrada reciben un recordatorio: "mañana arrancamos", con el QR.
- **En la puerta** se escanea el QR con un celular donde haya una sesión de admin iniciada, y se toca **Registrar ingreso**.

**El WhatsApp se atiende solo.** El bot contesta todos los mensajes de personas: precio, fecha, lugar, de qué se trata, cómo se paga, estado de la entrada, reenvío del QR. Acompaña la decisión con la guía de venta consultiva de `docs/metamorfosis-system-prompt.md` (sección 11). Algunos detalles de cómo trabaja:

- **Primer mensaje:** a quien escribe por primera vez (sin mensajes nuestros en los últimos 30 días) le llega primero el flyer (`public/entradas/flyer-7ma.jpg`) y después la bienvenida. Si ya trajo una pregunta, la IA la responde en ese mismo texto. El flyer se manda una sola vez por contacto, salvo que lo pidan.
- Recuerda lo hablado con cada número durante 24 horas.
- Si alguien manda varios mensajes seguidos, contesta una sola vez.
- A los audios les pide que lo escriban.
- No contesta en grupos ni en estados.
- No contesta mensajes viejos, como los que llegan al conectar el WhatsApp por QR.
- **Seguimiento:** si la persona deja de responder, le llega un único mensaje amable a las 24 horas (lo manda el cron diario, solo con Evolution). Nunca insiste.

Con `ANTHROPIC_API_KEY` responde la IA (Claude). Sin esa clave, o si la IA falla, a quien escribe por primera vez le llega la bienvenida tal cual, y al resto un menú automático con precio, fecha, lugar y el link de compra.

---

## Paso 1: tablas en Supabase ✅

Ya están creadas en la base (`tickets`, `ticket_payments`, `ticket_checkins` y `whatsapp_messages`, con RLS activado). Si alguna vez hay que recrearlas, corré [`supabase/entradas.sql`](../supabase/entradas.sql) en el SQL Editor. Se puede correr las veces que haga falta y no borra nada.

## Paso 2: Mercado Pago

1. Entrá a <https://www.mercadopago.com.ar/developers/panel/app> con la cuenta que va a cobrar y creá una aplicación (pagos online → Checkout Pro).
2. En **Credenciales de producción**, copiá el **Access Token** (empieza con `APP_USR-`). Va en `MP_ACCESS_TOKEN`.
3. (Recomendado) En **Webhooks** configurá:
   - URL: `https://metamorfosis.vip/api/mercadopago/webhook`
   - Evento: **Pagos**
   - Copiá la **clave secreta** que te muestra. Va en `MP_WEBHOOK_SECRET`.

## Paso 3: conectar el WhatsApp Business por QR (Evolution API)

Se usa el mismo número y la misma app de WhatsApp Business, como si fuera WhatsApp Web.

1. Levantá **Evolution API v2** en un servidor que quede prendido. Lo más simple es la plantilla "Evolution API" de [Railway](https://railway.com) (unos USD 5 por mes). En sus variables, poné una clave en `AUTHENTICATION_API_KEY`.
2. Abrí `https://TU-EVOLUTION/manager` y creá una instancia llamada `metamorfosis`.
3. Escaneá el QR desde el celular: WhatsApp Business → Dispositivos vinculados → Vincular un dispositivo.
4. En la instancia, entrá a **Webhook** y configurá:
   - URL: `https://metamorfosis.vip/api/whatsapp/webhook?token=EL_VALOR_DE_WHATSAPP_VERIFY_TOKEN`
   - Evento `MESSAGES_UPSERT` activado.
   - "Webhook by events" apagado.
5. Cargá en Vercel `WHATSAPP_PROVIDER=evolution`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE=metamorfosis` y `WHATSAPP_VERIFY_TOKEN`.

> Evolution no es la API oficial de Meta. Para cuidar el número, el sistema solo le escribe a quien compró o a quien escribió primero. No lo uses para mandar difusiones masivas.

<details>
<summary>Alternativa: WhatsApp Cloud API oficial de Meta</summary>

Requiere una app en developers.facebook.com con WhatsApp y un número registrado en Cloud API (ese número deja de andar en la app común). Variables: `WHATSAPP_PROVIDER=cloud`, `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`. Webhook: `https://metamorfosis.vip/api/whatsapp/webhook`, campo `messages`.

Para escribirle primero a alguien hacen falta plantillas aprobadas, de categoría Utilidad y en español de Argentina (`es_AR`). Las variables van en este orden:

- `entrada_confirmada` (nombre, código, link de la entrada)
- `sena_recibida` (nombre, monto pagado, saldo, link de pago, link de la entrada)
- `recordatorio_saldo` (nombre, saldo, link de pago)
- `vispera_taller` (nombre, link de la entrada)

Las plantillas no pueden terminar en una variable, así que cerralas con una frase. Cuando estén aprobadas, poné `WHATSAPP_USE_TEMPLATES=1`.
</details>

## Paso 4: la IA que contesta el WhatsApp

1. Entrá a <https://console.anthropic.com>, cargá crédito y creá una **API key**. Va en `ANTHROPIC_API_KEY`.
2. Listo. Por defecto usa `claude-opus-5-5` con razonamiento en esfuerzo bajo, que alcanza para chat. Cada respuesta cuesta alrededor de 1 a 2 centavos de dólar (USD 4 por millón de tokens de entrada y USD 20 por millón de salida, y el prompt fijo se cachea). Si querés que salga mucho más barato, poné `ANTHROPIC_MODEL=claude-haiku-5-5` (USD 0,10 y USD 0,50 por millón de tokens).
3. Tiene activado el respaldo automático de la API (`fallbacks: "default"`): si el modelo rechaza un mensaje, la API lo reintenta con otro modelo. Si igual no hay respuesta, contesta el menú automático.

## Paso 5: variables en Vercel

En Vercel (Settings → Environment Variables, en Production):

| Variable | Para qué |
| --- | --- |
| `MP_ACCESS_TOKEN` | Cobrar con Mercado Pago (**obligatoria antes de publicar**) |
| `MP_WEBHOOK_SECRET` | Validar los avisos de MP (recomendada) |
| `SITE_URL` | `https://metamorfosis.vip`: links de los WhatsApp y de MP |
| `CRON_SECRET` | Cualquier texto largo al azar: activa los recordatorios diarios |
| `WHATSAPP_VERIFY_TOKEN` | Cualquier texto al azar: protege el webhook de WhatsApp |
| `WHATSAPP_PROVIDER` | `evolution` |
| `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` / `EVOLUTION_INSTANCE` | Conexión con Evolution |
| `ANTHROPIC_API_KEY` | La IA que contesta el WhatsApp |
| `ANTHROPIC_MODEL` | (Opcional) Otro modelo, por ejemplo `claude-haiku-5-5` |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Número del WhatsApp Business, solo dígitos (`549...`) |
| `NEXT_PUBLIC_EVENT_ADDRESS` | (Opcional) Dirección exacta: si está, sale en los mensajes y el bot la sabe |

Las variables que empiezan con `NEXT_PUBLIC_` recién se aplican con un nuevo deploy. Los recordatorios los dispara Vercel Cron todos los días a las 10:00 de Argentina (`vercel.json`).

## Paso 6: probar con plata real antes de abrir la venta

1. En el admin → **Entradas**, revisá que los cuatro indicadores estén en verde.
2. Desde otro celular, escribile "hola" al WhatsApp Business. Tiene que contestar solo. Después pedile "quiero anotarme, soy Nombre Apellido, pago en uno" y tiene que mandarte el link de pago.
3. Pagá con una cuenta de Mercado Pago **distinta** de la que cobra (MP no deja pagarse a uno mismo). Te tiene que llegar el WhatsApp con el QR y la entrada tiene que aparecer como pagada en el admin.
4. Devolvé ese pago desde Mercado Pago y cancelá la entrada en el admin.

## En la puerta (28 y 29)

- Iniciá sesión en `metamorfosis.vip/login` con una cuenta admin, en el celular que va a escanear.
- Escaneá el QR con la cámara. Se abre la entrada en **modo puerta**:
  - **Verde, "Puede pasar":** tocá **Registrar ingreso**.
  - **Amarillo, "Debe el saldo":** cobrá y tocá "Cobré $60.000 en efectivo / transferencia · registrar ingreso" (el botón muestra el saldo de esa entrada).
  - **Amarillo, "Ya ingresó hoy":** ese QR ya se usó hoy.
  - **Rojo:** la entrada no tiene pago o está cancelada.
- El domingo se registra el ingreso de nuevo: el sistema cuenta un ingreso por día.
- Si alguien no tiene el QR, buscalo por nombre en el admin → Entradas → **Registrar ingreso hoy**.
