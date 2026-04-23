# Supabase setup

## Objetivo

Este proyecto ahora usa:

- Supabase Auth para login con Google
- Supabase Database para usuarios, ediciones, pagos y dashboard
- Vercel para deploy
- GitHub para source control

No usa Prisma ni `DATABASE_URL`.

## Variables necesarias

En local usa solo `.env.local`.

```env
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
SUPABASE_SERVICE_ROLE_KEY=""

SUPERADMIN_EMAILS="gestiones.metamorfosis@gmail.com"
ADMIN_EMAILS=""
OWNER_EMAIL=""

NEXT_PUBLIC_WHATSAPP_NUMBER=""
NEXT_PUBLIC_VERTICAL_VIDEO_URL=""
NEXT_PUBLIC_SPLINE_SCENE_URL=""

NEXT_PUBLIC_ENABLE_BUTTERFLY_OVERLAY="false"
NEXT_PUBLIC_BUTTERFLY_FRAMES_BASE_URL=""
NEXT_PUBLIC_BUTTERFLY_FRAMES_PREFIX="maripometaweb"
NEXT_PUBLIC_BUTTERFLY_FRAMES_DIGITS="3"
NEXT_PUBLIC_BUTTERFLY_FRAMES_START="0"
NEXT_PUBLIC_BUTTERFLY_FRAMES_COUNT="220"
NEXT_PUBLIC_BUTTERFLY_FPS="24"
NEXT_PUBLIC_BUTTERFLY_MIN_DELAY_MS="12000"
NEXT_PUBLIC_BUTTERFLY_MAX_DELAY_MS="22000"
NEXT_PUBLIC_BUTTERFLY_MAX_WIDTH_PX="420"
```

Notas:

- `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` salen de `Project Settings > API`.
- `SUPABASE_SERVICE_ROLE_KEY` tambien sale de `Project Settings > API`.
- `SUPABASE_SERVICE_ROLE_KEY` va solo en servidor. No la expongas en el cliente.

## Crear tablas en Supabase

1. Ve a `Supabase > SQL Editor`.
2. Abre [supabase/schema.sql](/e:/PRGRAMACION%20PROYECTOS/metamorfosis-web/supabase/schema.sql).
3. Copia el contenido completo.
4. Pegalo y ejecutalo en Supabase.

Eso crea:

- `users`
- `user_status_events`
- `points_transactions`
- `editions`
- `enrollments`
- `payments`

## Google Auth

En Supabase:

1. `Authentication > Sign in / Providers`
2. Activa `Google`
3. Carga tu `Client ID` y `Client Secret`

En Google Cloud, el callback autorizado debe ser el de Supabase:

- `https://TU-PROYECTO.supabase.co/auth/v1/callback`

## URL configuration en Supabase

En `Authentication > URL Configuration`:

- `Site URL`: `https://metamorfosis.vip`

Agrega como redirect URLs permitidas:

- `http://localhost:3000/auth/callback`
- `https://metamorfosis.vip/auth/callback`
- `https://webcompleta-iqfx.vercel.app/auth/callback`

Si cambias el dominio de Vercel, agrega tambien el nuevo callback.

## Vercel

En `Project > Settings > Environment Variables` agrega:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPERADMIN_EMAILS`
- `OWNER_EMAIL`
- `ADMIN_EMAILS` si aplica
- `NEXT_PUBLIC_WHATSAPP_NUMBER`

Y si quieres igualar la landing local:

- `NEXT_PUBLIC_VERTICAL_VIDEO_URL`
- `NEXT_PUBLIC_SPLINE_SCENE_URL`
- `NEXT_PUBLIC_ENABLE_BUTTERFLY_OVERLAY`
- `NEXT_PUBLIC_BUTTERFLY_*`

Despues haz `Redeploy`.

## Flujo esperado

- Login y registro usan Google via Supabase Auth.
- El callback `/auth/callback` intercambia el code por session.
- La app sincroniza el usuario en la tabla `users`.
- Si entra con `?ref=CODIGO`, se asocia el referente.
- `gestiones.metamorfosis@gmail.com` queda como superadmin por default.
