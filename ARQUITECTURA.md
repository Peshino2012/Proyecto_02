# Arquitectura — Calendario personal

Notas para quien vaya a trabajar sobre este repo (ej. para agregar un apartado
"Trabajo / Freelancer"). Generado por Claude a pedido del dueño del proyecto.

## 1. Código

- Repo: https://github.com/Peshino2012/Proyecto_02
- **Ojo con las ramas**, es un caso atípico:
  - `claude/interactive-calendar-claude-ns4y9y` es la rama **default de GitHub
    y la que usa Vercel para Production**. Es la rama "real" del proyecto.
  - `main` existe pero **no se usa para nada** (se creó recién, en Sep/2026,
    solo para destrabar una sesión de Claude que no podía inicializar porque
    buscaba `refs/heads/main` y no existía). Por ahora tiene el mismo
    contenido que `claude/interactive-calendar-claude-ns4y9y`.
  - `claude/peaceful-dirac-3a267w` es la rama de la sesión de Claude que
    escribió este documento.
  - Si vas a abrir PRs o integrar algo, apuntá contra
    `claude/interactive-calendar-claude-ns4y9y`, no contra `main`.
- Si el trabajo se hace desde el repo `Peshino2012/PD1`: es un repo
  **distinto** a este. Si la idea es que termine viviendo en esta misma app,
  en algún momento hay que decidir si se mergea código hacia acá o si PD1
  pasa a ser el repo principal — esto todavía no está resuelto.

## 2. Deploy

- URL pública: https://proyecto-02-nine.vercel.app
- Se despliega en **Vercel**, conectado directo al repo de GitHub.
  Auto-deploy on push a la rama Production (`claude/interactive-calendar-claude-ns4y9y`).
- Build command (`package.json`): `prisma generate && prisma migrate deploy && next build`
  — las migraciones de Prisma corren solas en cada deploy, no hace falta
  ejecutar nada a mano.
- Cron:
  - `/api/cron/daily-digest` vía Vercel Cron (`vercel.json`, 11:00 UTC / 08:00 Arg).
  - `/api/cron/notify` (recordatorios cada 5 min) vía un cron externo gratuito
    (Vercel Hobby no permite cron más frecuente que 1/día), llamando ese
    endpoint con header `Authorization: Bearer <CRON_SECRET>`.

## 3. Stack técnico

- **Framework**: Next.js 16.3.0 (App Router), React 19.2.8, TypeScript.
- **Estilos**: Tailwind CSS 4.
- **Base de datos**: Postgres, provisto como integración de **Neon vía Vercel
  Marketplace** (plan Free), nombre del proyecto en Neon: `neon-celeste-helmet`.
  **La misma base sirve tanto a Production como a Preview** (no hay bases
  separadas por entorno/rama) — cualquier deploy de preview pega contra los
  datos reales.
- **ORM**: Prisma 7.9.1 + `@prisma/adapter-pg`. Schema en `prisma/schema.prisma`,
  migraciones en `prisma/migrations/`.
- **Login**: NextAuth v5 (beta), provider `Credentials` (email + password con
  `bcryptjs`), sesión JWT. Hubo un intento de login biométrico/WebAuthn que se
  agregó y **se sacó completamente** (ver migraciones
  `add_webauthn` → `rename_biometric_app_lock` → `remove_biometric_app_lock`):
  no reintroducir ese patrón, fue una decisión explícita del dueño del proyecto.
- **Notificaciones push**: `web-push` con claves VAPID
  (`lib/push.ts` → `sendPushToUser`). Las subscriptions del browser se guardan
  en `PushSubscription` (ligada a `User`). Si el envío falla con 404/410 se
  borra la subscription (endpoint vencido).
- **Emails**: `nodemailer` vía SMTP (`lib/mail.ts` → `sendReminderEmail`). Si
  no están seteadas las env vars de SMTP, simplemente no manda nada (no rompe).
- **Avisos/recordatorios**: calculados en `app/api/cron/notify/route.ts`
  (corre cada 5 min) y `app/api/cron/daily-digest/route.ts` (resumen diario),
  usando utilidades de `lib/timezone.ts` (todo en huso horario
  `America/Argentina/Buenos_Aires`) y `lib/recurrence.ts`.

## 4. Servidor MCP "Calendario Personal"

- Archivo único: **`app/api/mcp/route.ts`**.
- Auth: Bearer token propio de la app (no es el login normal) — se genera
  desde Ajustes → tokens API (`lib/tokens.ts`, modelo `ApiToken`), hasheado
  con SHA-256 antes de guardarse.
- Expone 8 tools (vía `@modelcontextprotocol/sdk`, transport HTTP streamable):
  `list_events`, `create_event`, `update_event`, `delete_event`,
  `find_free_slots`, `list_habits`, `create_habit`, `log_habit_today`.
- Todas las tools operan **scopeadas al `userId` del token** — un token no
  puede ver/tocar datos de otro usuario.
- **Importante para el apartado nuevo**: este MCP solo conoce `Event` y
  `Habit` del calendario personal. Si el chat de "Trabajo/Freelancer" va a
  tener su propio MCP (como pide el enunciado: "pregunta antes de hacer
  cambios"), debería ser un servidor/endpoint separado, con sus propios
  tokens, para no mezclar permisos ni datos con este.

## 5. Variables de entorno (nombres, sin valores)

De `.env.example`:

```
DATABASE_URL
DATABASE_URL_UNPOOLED
AUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
SMTP_HOST
SMTP_PORT
SMTP_USER
SMTP_PASS
SMTP_FROM
CRON_SECRET
```

## 6. Cosas a medio hacer / que no se pueden tocar sin avisar

- **La base de Neon se pausó** (límite mensual del plan Free agotado) el
  20/Sep/2026 — confirmado desde el panel de Vercel → Storage →
  `neon-celeste-helmet` → "paused after reaching its monthly free plan
  limit". Mientras esté pausada, la app no lee ni escribe nada (ni local
  development apuntando a esa `DATABASE_URL`, ni producción). **Confirmar
  que esté reactivada (upgrade de plan, o reset mensual) antes de asumir que
  algo "no anda" por un bug de código.**
- **Bug conocido, no arreglado todavía**: `components/calendar/CalendarView.tsx`
  → `loadEvents()` solo hace `if (res.ok) setEvents(...)`, así que si
  `GET /api/events` falla (ej. base caída), el calendario se muestra
  vacío **sin ningún error visible** — parece que "se borraron los datos"
  cuando en realidad es un fallo silencioso. Las rutas `GET` en general no
  tienen manejo de errores (`try/catch`) en los handlers de `app/api/`. Tenerlo
  en cuenta al armar las notificaciones del módulo nuevo: que los errores se
  vean, no que se "tapen" con un estado vacío.
- **No existe todavía ningún concepto de "proyecto" ni "espacio de trabajo"**
  separado del calendario personal. Lo único parecido es una categoría de
  color fija `"Laburo / Proyectos"` (`lib/categories.ts`, `EVENT_CATEGORIES`)
  que comparten Eventos/Hábitos/Quests — es solo una etiqueta de color, no
  aísla datos. El apartado "Trabajo/Freelancer" nuevo necesita modelos propios
  (`Project`, eventos de proyecto, etc.) separados de `Event`, no reusar esa
  categoría, justamente porque el pedido es que no se mezclen con el
  calendario personal.
- El usuario único logueado hoy (`User`) no tiene roles/multi-tenant: todo el
  modelo de datos asume un solo dueño por cuenta.
