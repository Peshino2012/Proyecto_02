# Calendario

Calendario interactivo propio (reemplazo mínimo de Google Calendar): entrás desde el celu o la compu con tu usuario, ves un mes navegable, creás/editás/borrás eventos (incluso recurrentes), recibís recordatorios por notificación push y por email, un resumen de tu día cada mañana, lo instalás como app en el celu, y podés conectarlo a Claude (o a Claude Cowork) para que gestione tu calendario por vos.

## Stack

- **Next.js 16** (App Router, TypeScript) + Tailwind CSS
- **Postgres** vía **Prisma 7** (driver adapter `@prisma/adapter-pg`)
- **NextAuth (Auth.js) v5** con login por email/contraseña
- **PWA**: `manifest.json` + service worker propio (`public/sw.js`), instalable en el celu. En Android, mantener presionado el ícono da un atajo "Nuevo evento" directo (no hay equivalente en iOS ni widgets reales de pantalla de inicio/bloqueo — eso requiere una app nativa, no una PWA)
- **Notificaciones push** (Web Push / VAPID), con **email** (SMTP vía Nodemailer) como respaldo si el push no se pudo entregar a ningún dispositivo
- **Resumen diario automático** por push (agenda del día + versículo corto rotando)
- **Eventos recurrentes** (diario/semanal/mensual), **detección de conflictos** al agendar y **búsqueda de horarios libres**
- **Categorías** con nombre (Facultad/Laburo/Fe/Personal/Salud/Otro) y **dictado por voz** en el título
- **Modo oscuro** (Claro/Oscuro/Sistema) y **diseño mobile-first** (nav inferior, botón flotante, modal como bottom sheet)
- **Ajustes de cuenta**: cambiar nombre/contraseña, horario "no molestar" (silencia notificaciones sin perderlas) y recordatorio por defecto
- **Hábitos** (`/habits`): planilla estilo spreadsheet (filas = hábitos, columnas = días, vista semana/mes) con rachas (streaks) diarias o semanales y recordatorio propio
- **Cuenta regresiva** por evento: aviso diario (sin repetir el evento) desde N días antes hasta el día del evento, a una hora fija, con marca visible en el calendario (franja + días restantes)
- **Quests** (`/tasks`): sistema de tareas gamificado (inspirado en Solo Leveling) con nivel, XP y 5 stats (Intelecto/Disciplina/Espíritu/Vitalidad/Fuerza) que suben según la categoría de la quest completada; la XP del día se acumula y se banca una sola vez por día (junto con la posible penalización), para que el nivel no oscile; racha, versículo del día y objetivo numérico opcional por quest
- **Tareas rápidas**: pendientes simples ligados al calendario (sin XP ni categorías, distintos de las Quests), con fecha y tilde de hecho/no hecho, listados dentro de la vista de calendario
- **Huella / Face ID (WebAuthn)** opcional en Ajustes → Seguridad: pide verificación biométrica solo al entrar por el atajo rápido "Nuevo evento" (pantalla de bloqueo o ícono), nunca al abrir la app normalmente
- **Servidor MCP** (`/api/mcp`, Streamable HTTP) para que Claude cree/lea/edite/borre eventos (incluida la cuenta regresiva) y hábitos, detecte conflictos y sugiera horarios libres

## 1. Poner en marcha en local

```bash
npm install
cp .env.example .env   # y completar las variables (ver abajo)
npx prisma migrate dev
npm run dev
```

Abrí http://localhost:3000 — te redirige a `/login`. Registrate desde `/register`.

### Base de datos local sin instalar Postgres

Si no tenés Postgres a mano, Prisma puede levantar uno local:

```bash
npx prisma dev -d
```

Te da una `DATABASE_URL` de `localhost` para pegar en `.env`.

## 2. Variables de entorno

Ver `.env.example` para la lista completa. Resumen:

| Variable | Para qué |
|---|---|
| `DATABASE_URL` | Conexión Postgres |
| `AUTH_SECRET` | Firma de sesión de NextAuth (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | URL pública de la app |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | Notificaciones push |
| `VAPID_SUBJECT` | `mailto:tu-email` (requerido por el protocolo push) |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASS` / `SMTP_FROM` | Recordatorios por email |
| `CRON_SECRET` | Protege `/api/cron/notify` |

Generar claves VAPID nuevas:

```bash
node -e "console.log(JSON.stringify(require('web-push').generateVAPIDKeys()))"
```

### Email con Gmail

Usá una [contraseña de aplicación](https://myaccount.google.com/apppasswords) de tu cuenta de Gmail (no tu contraseña normal):

```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu-email@gmail.com
SMTP_PASS=la-contraseña-de-aplicación
```

## 3. Deploy a Vercel

1. Subí el repo a GitHub (ya está en `Peshino2012/Proyecto_02`) e importalo en [vercel.com/new](https://vercel.com/new).
2. Agregá una base de datos Postgres desde el panel de Vercel (**Storage → Postgres**, usa Neon por debajo) — esto define `DATABASE_URL` solo. O usá tu propio Postgres (Neon, Supabase, etc.).
3. Cargá el resto de las variables de entorno del paso 2 en **Settings → Environment Variables**.
4. Deployá. El script `build` (`prisma generate && prisma migrate deploy && next build`) corre las migraciones automáticamente contra `DATABASE_URL` en cada deploy — no hace falta ejecutar nada a mano.
5. Programá quién dispara los recordatorios. El plan Hobby de Vercel solo permite cron jobs **una vez por día**, insuficiente para recordatorios ("10 min antes", etc.), así que usamos un servicio externo gratuito:
   - Creá una cuenta gratis en [cron-job.org](https://cron-job.org).
   - Nuevo cron job → URL: `https://tu-app.vercel.app/api/cron/notify` → método `GET` → cada 5 minutos.
   - En "Advanced → Headers" agregá: `Authorization: Bearer <tu CRON_SECRET>` (el mismo valor que pusiste en las variables de entorno de Vercel).

   El **resumen diario** (`/api/cron/daily-digest`) sí corre una vez por día, así que ese lo maneja Vercel Cron directamente — ya está configurado en `vercel.json` (08:00 hora Argentina) y no requiere nada extra.

6. Entrá a la app desde el celu, iniciá sesión, y en **Ajustes → Notificaciones push** tocá "Activar". En iOS hace falta primero "Agregar a pantalla de inicio" (instalar como PWA) para que las notificaciones push funcionen.

## 4. Conectar con Claude / Claude Cowork

1. Entrá a **Ajustes** dentro de la app.
2. En "Integración con Claude", generá un token (ponele un nombre, ej. "Claude Cowork") y copialo — solo se muestra una vez.
3. En Claude (claude.ai → Configuración → Conectores, o en Claude Cowork), agregá un conector MCP remoto:
   - **URL**: `https://tu-app.vercel.app/api/mcp`
   - **Autenticación**: Bearer token, pegando el token generado.
4. A partir de ahí le podés pedir a Claude cosas como "agendame una reunión mañana a las 10" y va a usar las herramientas `list_events`, `create_event`, `update_event` y `delete_event` directo sobre tu calendario.

Podés revocar un token en cualquier momento desde la misma pantalla de Ajustes.

## Estructura del proyecto

```
app/
  api/            endpoints (auth, events, habits, tasks, progress, account, push, tokens, cron, mcp)
  calendar/       vista principal del calendario
  habits/         planilla de hábitos y rachas
  tasks/          quests y progreso (nivel/XP/stats)
  settings/       apariencia, cuenta, notificaciones, tareas, tokens MCP
  login/ register/
components/
  calendar/       grilla mensual + modal de eventos (incl. cuenta regresiva)
  habits/         planilla de hábitos + modal
  tasks/          vista de quests + modal
  settings/       toggles y formularios de Ajustes
lib/              prisma, auth, push, mail, tokens, recurrence, conflicts,
                  categories, verses, habits, taskStats, theme, reminders, timezone
prisma/schema.prisma   User, Event, PushSubscription, ApiToken, Habit, HabitLog,
                       Task, TaskLog, UserProgress
public/           manifest.json, sw.js, íconos
```

## Sobre los eventos recurrentes

- Un evento recurrente es una sola fila en la base con una regla (diario/semanal/mensual) y un fin opcional; las ocurrencias se calculan al vuelo, no se guardan una por una.
- **Editar o borrar afecta a toda la serie**, no a una fecha puntual (no hay excepciones por ocurrencia individual).
- Los recordatorios de una serie avanzan ocurrencia por ocurrencia (no se pierden ni se acumulan si el servidor estuvo caído).

## Notas de seguridad

- Las contraseñas se guardan hasheadas con bcrypt.
- Los tokens de API para MCP se guardan hasheados (SHA-256); el valor en texto plano solo se muestra una vez al crearlo.
- `/api/cron/notify` y `/api/mcp` no dependen de cookies de sesión: se protegen con `CRON_SECRET` y con el token de API respectivamente.
