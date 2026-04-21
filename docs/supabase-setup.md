# Supabase setup

## 1. Desarrollo local

Usa solo `.env.local` para desarrollo. Ese archivo ya esta ignorado por git, asi que no se sube al repo.

Tus secretos reales deben vivir en:

- `.env.local` para local
- Environment Variables de Vercel para preview/production

Completa estas variables en `.env.local`:

```env
DATABASE_URL=""
NEXT_PUBLIC_SUPABASE_URL=""
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=""
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

- `DATABASE_URL` debe apuntar al Postgres de Supabase que va a usar Prisma.
- Para una puesta en marcha rapida, copia el string desde `Connect` en Supabase.
- Si en lugar del Session pooler usas el pooler transaccional (`6543`), agrega `?pgbouncer=true` al final del string para Prisma.
- Los scripts de Prisma del proyecto ya priorizan `.env.local`.
- Si no completas `NEXT_PUBLIC_SPLINE_SCENE_URL` o `NEXT_PUBLIC_ENABLE_BUTTERFLY_OVERLAY`, la app usa fallbacks visuales seguros.


## 2. Levantar el esquema en Supabase

Con `DATABASE_URL` apuntando al proyecto correcto:

```bash
npm run db:push
npm run db:generate
```

Las tablas nuevas incluyen:

- usuarios sincronizados con `auth.users` por `supabaseAuthId`
- ediciones
- asignaciones por usuario/edicion
- pagos por asignacion

Las ediciones 5 y 6 se crean automaticamente al entrar al admin por primera vez.

## 3. Activar Google en Supabase Auth

En el dashboard de Supabase:

1. Ve a `Authentication`.
2. Abre `Sign In / Providers`.
3. Activa `Google`.
4. Configura el client ID y secret de Google dentro de Supabase.

Redirect URLs de la app:

- `http://localhost:3000/auth/callback`
- `https://tu-dominio.com/auth/callback`

## 4. Vercel

En Vercel no se usa `.env.local`. Copia manualmente las mismas variables desde tu entorno local a:

- `Production`
- `Preview`
- `Development` si quieres usar `vercel dev`

Checklist minimo para que el deploy funcione:

- `DATABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPERADMIN_EMAILS`
- `OWNER_EMAIL`
- `NEXT_PUBLIC_WHATSAPP_NUMBER`

Variables opcionales:

- `ADMIN_EMAILS`
- `NEXT_PUBLIC_VERTICAL_VIDEO_URL`
- `NEXT_PUBLIC_SPLINE_SCENE_URL`
- `NEXT_PUBLIC_ENABLE_BUTTERFLY_OVERLAY`
- `NEXT_PUBLIC_BUTTERFLY_*`

Nota importante sobre tu bloqueo actual en Vercel:

- El error de la captura no apunta al codigo ni a Supabase.
- El proyecto esta enlazado a un team de Vercel y el deploy fue bloqueado porque el autor del commit no tiene permisos de contribucion en ese proyecto.
- Eso se resuelve agregando ese usuario al proyecto/team en Vercel o haciendo el deploy desde un usuario con acceso.

## 5. Flujo esperado

- Login y registro usan Google via Supabase Auth.
- En el callback se crea o sincroniza el usuario en Prisma.
- Si el alta vino con `?ref=CODIGO`, se vincula automaticamente el referente.
- `gestiones.metamorfosis@gmail.com` queda como superadmin.
- El panel `/admin` permite:
  - cargar participantes por edicion
  - registrar pagos
  - cambiar el estado global del usuario
  - reasignar manualmente quien invito a quien si eres superadmin
