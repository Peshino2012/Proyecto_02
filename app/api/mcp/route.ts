import { NextRequest } from "next/server";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { prisma } from "@/lib/prisma";
import { hashApiToken } from "@/lib/tokens";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { findConflicts } from "@/lib/conflicts";
import { argDateTime, argTodayDateString, clampCountdownDates } from "@/lib/timezone";
import { occurrencesInRange } from "@/lib/recurrence";
import { computeStreak, isCompletedToday } from "@/lib/habits";
import {
  createWorkItem,
  getOwnedModule,
  proposalChange,
  pushClaudeMessage,
  serializeItem,
  serializeMessage,
  workCounts,
  workItemInput,
  WORK_COLORS,
} from "@/lib/work";

const RECURRENCE_HINT =
  "NONE (no se repite), DAILY (todos los días), WEEKLY (todas las semanas), MONTHLY (todos los meses)";

const CATEGORY_HINT = EVENT_CATEGORIES.map((c) => `${c.label}=${c.color}`).join(", ");

const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const runtime = "nodejs";

async function resolveUserId(req: NextRequest): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  const apiToken = await prisma.apiToken.findUnique({
    where: { tokenHash: hashApiToken(token) },
  });
  if (!apiToken) return null;

  prisma.apiToken
    .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});

  return apiToken.userId;
}

function buildServer(userId: string) {
  const server = new McpServer({
    name: "calendario-mcp",
    version: "1.0.0",
  });

  server.registerTool(
    "list_events",
    {
      title: "Listar eventos",
      description:
        "Lista los eventos del calendario del usuario en un rango de fechas. Si no se especifica, devuelve los próximos 30 días.",
      inputSchema: {
        from: z.string().datetime().optional().describe("Fecha/hora ISO 8601 de inicio del rango"),
        to: z.string().datetime().optional().describe("Fecha/hora ISO 8601 de fin del rango"),
      },
    },
    async ({ from, to }) => {
      const rangeFrom = from ? new Date(from) : new Date();
      const rangeTo = to ? new Date(to) : new Date(rangeFrom.getTime() + 30 * 24 * 60 * 60 * 1000);

      const events = await prisma.event.findMany({
        where: {
          userId,
          OR: [
            { recurrence: "NONE", startAt: { lte: rangeTo }, endAt: { gte: rangeFrom } },
            {
              recurrence: { not: "NONE" },
              startAt: { lte: rangeTo },
              OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: rangeFrom } }],
            },
          ],
        },
        orderBy: { startAt: "asc" },
      });

      const expanded = events.flatMap((ev) => {
        if (ev.recurrence === "NONE") return [ev];
        const durationMs = ev.endAt.getTime() - ev.startAt.getTime();
        return occurrencesInRange(ev, rangeFrom, rangeTo).map((occStart) => ({
          ...ev,
          id: `${ev.id}::${occStart.toISOString()}`,
          seriesId: ev.id,
          startAt: occStart,
          endAt: new Date(occStart.getTime() + durationMs),
        }));
      });

      expanded.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

      return {
        content: [{ type: "text", text: JSON.stringify(expanded, null, 2) }],
      };
    }
  );

  server.registerTool(
    "create_event",
    {
      title: "Crear evento",
      description: "Crea un nuevo evento en el calendario del usuario.",
      inputSchema: {
        title: z.string().min(1).max(200),
        description: z.string().max(2000).optional(),
        location: z.string().max(200).optional(),
        startAt: z.string().datetime().describe("Fecha/hora ISO 8601 de inicio"),
        endAt: z.string().datetime().describe("Fecha/hora ISO 8601 de fin"),
        allDay: z.boolean().optional(),
        reminderMinutesBefore: z
          .number()
          .int()
          .min(0)
          .max(60 * 24 * 7)
          .optional()
          .describe("Minutos antes de que TERMINE el evento (endAt) para avisar: push y alarma del celular. 0 = justo al terminar; sin este campo no avisa."),
        color: z
          .string()
          .optional()
          .describe(
            `Color hexadecimal para categorizar el evento. Categorías disponibles: ${CATEGORY_HINT}. Elegí la que mejor corresponda (facultad, laburo/proyectos, fe, personal/hábitos, salud, u otro) según el contenido del evento.`
          ),
        recurrence: z
          .enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"])
          .optional()
          .describe(`Repetición del evento. Valores: ${RECURRENCE_HINT}. Default NONE.`),
        recurrenceEndAt: z
          .string()
          .datetime()
          .optional()
          .describe("Fecha/hora ISO 8601 en que deja de repetirse (opcional, sin fin si se omite)"),
        countdownFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe(
            "Si se especifica junto con countdownTo, activa una cuenta regresiva: aviso push diario (sin repetir el evento) entre esta fecha y countdownTo (ambas inclusive, YYYY-MM-DD), más una marca visible en el calendario."
          ),
        countdownTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe(
            "Último día (YYYY-MM-DD) del aviso de cuenta regresiva. Se recorta automáticamente para no ser posterior al día del evento."
          ),
        countdownHour: z
          .number()
          .int()
          .min(0)
          .max(23)
          .optional()
          .describe("Hora del día (0-23) para el aviso de cuenta regresiva. Default 9."),
        countdownMinute: z.number().int().min(0).max(59).optional().describe("Default 0."),
      },
    },
    async (args) => {
      if (new Date(args.endAt) < new Date(args.startAt)) {
        return {
          isError: true,
          content: [{ type: "text", text: "La fecha de fin no puede ser anterior a la de inicio" }],
        };
      }

      const startAt = new Date(args.startAt);
      const endAt = new Date(args.endAt);
      const conflicts = await findConflicts(userId, startAt, endAt);

      const countdown =
        args.countdownFrom && args.countdownTo
          ? clampCountdownDates(args.countdownFrom, args.countdownTo, startAt)
          : null;

      const eventCategoryColors = args.color ? [args.color] : ["#4f46e5"];

      const event = await prisma.event.create({
        data: {
          userId,
          title: args.title,
          description: args.description,
          location: args.location,
          startAt,
          endAt,
          allDay: args.allDay ?? false,
          reminderMinutesBefore: args.reminderMinutesBefore,
          color: eventCategoryColors[0],
          categoryColors: eventCategoryColors,
          recurrence: args.recurrence ?? undefined,
          recurrenceEndAt: args.recurrenceEndAt ? new Date(args.recurrenceEndAt) : undefined,
          countdownFrom: countdown?.from,
          countdownTo: countdown?.to,
          countdownHour: countdown ? (args.countdownHour ?? 9) : undefined,
          countdownMinute: countdown ? (args.countdownMinute ?? 0) : undefined,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                event,
                conflicts:
                  conflicts.length > 0
                    ? conflicts
                    : undefined,
                warning:
                  conflicts.length > 0
                    ? "Ojo: este evento se superpone con otro(s) existente(s), listados en 'conflicts'."
                    : undefined,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "update_event",
    {
      title: "Editar evento",
      description: "Modifica un evento existente del calendario del usuario.",
      inputSchema: {
        id: z.string().describe("ID del evento a editar"),
        title: z.string().min(1).max(200).optional(),
        description: z.string().max(2000).optional(),
        location: z.string().max(200).optional(),
        startAt: z.string().datetime().optional(),
        endAt: z.string().datetime().optional(),
        allDay: z.boolean().optional(),
        reminderMinutesBefore: z.number().int().min(0).max(60 * 24 * 7).optional(),
        color: z.string().optional().describe(`Categorías disponibles: ${CATEGORY_HINT}`),
        recurrence: z
          .enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"])
          .optional()
          .describe(`Repetición del evento. Valores: ${RECURRENCE_HINT}.`),
        recurrenceEndAt: z
          .string()
          .datetime()
          .optional()
          .describe("Fecha/hora ISO 8601 en que deja de repetirse"),
        countdownFrom: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional()
          .describe("Cuenta regresiva: primer día (YYYY-MM-DD) del aviso. null para desactivarla."),
        countdownTo: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .nullable()
          .optional()
          .describe("Último día (YYYY-MM-DD) del aviso, recortado al día del evento."),
        countdownHour: z.number().int().min(0).max(23).nullable().optional(),
        countdownMinute: z.number().int().min(0).max(59).nullable().optional(),
      },
    },
    async ({ id, ...rest }) => {
      // Las ocurrencias de eventos recurrentes tienen id "eventoBase::fechaISO";
      // editar/borrar siempre afecta a toda la serie (el evento base real).
      const realId = id.split("::")[0];

      const existing = await prisma.event.findUnique({ where: { id: realId } });
      if (!existing || existing.userId !== userId) {
        return {
          isError: true,
          content: [{ type: "text", text: "Evento no encontrado" }],
        };
      }

      const nextStart = rest.startAt ? new Date(rest.startAt) : existing.startAt;
      const nextEnd = rest.endAt ? new Date(rest.endAt) : existing.endAt;
      const conflicts =
        rest.startAt || rest.endAt
          ? await findConflicts(userId, nextStart, nextEnd, realId)
          : [];

      const countdownFieldsTouched =
        rest.countdownFrom !== undefined ||
        rest.countdownTo !== undefined ||
        rest.countdownHour !== undefined ||
        rest.countdownMinute !== undefined;
      const dateMovedWithExistingCountdown = !!rest.startAt && !!existing.countdownFrom;
      const explicitlyDisabled = rest.countdownFrom === null;
      const needsRecompute =
        !explicitlyDisabled &&
        (rest.countdownFrom || rest.countdownTo || dateMovedWithExistingCountdown);
      const countdown = needsRecompute
        ? clampCountdownDates(
            rest.countdownFrom ?? existing.countdownFrom ?? "",
            rest.countdownTo ?? existing.countdownTo ?? "",
            nextStart
          )
        : null;

      const event = await prisma.event.update({
        where: { id: realId },
        data: {
          title: rest.title,
          description: rest.description,
          location: rest.location,
          allDay: rest.allDay,
          reminderMinutesBefore: rest.reminderMinutesBefore,
          color: rest.color,
          categoryColors: rest.color ? [rest.color] : undefined,
          recurrence: rest.recurrence,
          recurrenceEndAt: rest.recurrenceEndAt ? new Date(rest.recurrenceEndAt) : undefined,
          startAt: rest.startAt ? nextStart : undefined,
          endAt: rest.endAt ? nextEnd : undefined,
          countdownFrom: explicitlyDisabled ? null : (countdown?.from ?? undefined),
          countdownTo: explicitlyDisabled ? null : (countdown?.to ?? undefined),
          countdownHour: explicitlyDisabled
            ? null
            : (rest.countdownHour ?? (needsRecompute ? (existing.countdownHour ?? 9) : undefined)),
          countdownMinute: explicitlyDisabled
            ? null
            : (rest.countdownMinute ?? (needsRecompute ? (existing.countdownMinute ?? 0) : undefined)),
          notifiedAt:
            rest.startAt || rest.reminderMinutesBefore !== undefined ? null : undefined,
          lastNotifiedOccurrenceAt:
            rest.startAt || rest.reminderMinutesBefore !== undefined || rest.recurrence
              ? null
              : undefined,
          countdownLastSentDate:
            explicitlyDisabled || countdownFieldsTouched || dateMovedWithExistingCountdown
              ? null
              : undefined,
        },
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                event,
                conflicts: conflicts.length > 0 ? conflicts : undefined,
                warning:
                  conflicts.length > 0
                    ? "Ojo: este evento se superpone con otro(s) existente(s), listados en 'conflicts'."
                    : undefined,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  server.registerTool(
    "find_free_slots",
    {
      title: "Buscar horarios libres",
      description:
        "Busca huecos libres en el calendario del usuario para un día dado, evitando eventos existentes. Útil para sugerir horarios antes de crear un evento.",
      inputSchema: {
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).describe("Fecha en formato YYYY-MM-DD"),
        durationMinutes: z
          .number()
          .int()
          .min(5)
          .max(600)
          .optional()
          .describe("Duración mínima del hueco en minutos (default 60)"),
        dayStartHour: z
          .number()
          .int()
          .min(0)
          .max(23)
          .optional()
          .describe("Hora de inicio de la ventana de búsqueda, 0-23 (default 8)"),
        dayEndHour: z
          .number()
          .int()
          .min(1)
          .max(24)
          .optional()
          .describe("Hora de fin de la ventana de búsqueda, 1-24 (default 22)"),
      },
    },
    async ({ date, durationMinutes = 60, dayStartHour = 8, dayEndHour = 22 }) => {
      const windowStart = argDateTime(date, dayStartHour);
      const windowEnd = argDateTime(date, dayEndHour);

      const events = await prisma.event.findMany({
        where: {
          userId,
          startAt: { lt: windowEnd },
          endAt: { gt: windowStart },
        },
        orderBy: { startAt: "asc" },
      });

      const freeSlots: { start: string; end: string }[] = [];
      let cursor = windowStart;

      for (const ev of events) {
        const evStart = ev.startAt < windowStart ? windowStart : ev.startAt;
        if (evStart.getTime() - cursor.getTime() >= durationMinutes * 60 * 1000) {
          freeSlots.push({ start: cursor.toISOString(), end: evStart.toISOString() });
        }
        if (ev.endAt > cursor) cursor = ev.endAt;
      }

      if (windowEnd.getTime() - cursor.getTime() >= durationMinutes * 60 * 1000) {
        freeSlots.push({ start: cursor.toISOString(), end: windowEnd.toISOString() });
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ freeSlots }, null, 2) }],
      };
    }
  );

  server.registerTool(
    "delete_event",
    {
      title: "Borrar evento",
      description:
        "Elimina un evento del calendario del usuario. Si es una serie recurrente, borra toda la serie.",
      inputSchema: {
        id: z.string().describe("ID del evento a borrar"),
      },
    },
    async ({ id }) => {
      const realId = id.split("::")[0];
      const existing = await prisma.event.findUnique({ where: { id: realId } });
      if (!existing || existing.userId !== userId) {
        return {
          isError: true,
          content: [{ type: "text", text: "Evento no encontrado" }],
        };
      }

      await prisma.event.delete({ where: { id: realId } });

      return { content: [{ type: "text", text: "Evento borrado" }] };
    }
  );

  server.registerTool(
    "list_habits",
    {
      title: "Listar hábitos",
      description:
        "Lista los hábitos del usuario con su racha actual (streak) y si ya se marcó como cumplido hoy.",
      inputSchema: {},
    },
    async () => {
      const habits = await prisma.habit.findMany({
        where: { userId, archivedAt: null },
        include: { logs: { orderBy: { date: "desc" }, take: 400 } },
        orderBy: { createdAt: "asc" },
      });

      const withStreak = habits.map((h) => {
        const logDates = h.logs.map((l) => l.date);
        return {
          id: h.id,
          title: h.title,
          recurrence: h.recurrence,
          reminderHour: h.reminderHour,
          reminderMinute: h.reminderMinute,
          streak: computeStreak(h.recurrence as "DAILY" | "WEEKLY", logDates),
          completedToday: isCompletedToday(logDates),
        };
      });

      return { content: [{ type: "text", text: JSON.stringify(withStreak, null, 2) }] };
    }
  );

  server.registerTool(
    "create_habit",
    {
      title: "Crear hábito",
      description: "Crea un nuevo hábito para hacerle seguimiento de racha.",
      inputSchema: {
        title: z.string().min(1).max(200),
        recurrence: z
          .enum(["DAILY", "WEEKLY"])
          .optional()
          .describe("DAILY (todos los días) o WEEKLY (al menos una vez por semana). Default DAILY."),
        reminderHour: z.number().int().min(0).max(23).optional(),
        reminderMinute: z.number().int().min(0).max(59).optional(),
        color: z
          .string()
          .optional()
          .describe(`Categorías disponibles: ${CATEGORY_HINT}`),
      },
    },
    async (args) => {
      const habitCategoryColors = args.color ? [args.color] : ["#16a34a"];

      const habit = await prisma.habit.create({
        data: {
          userId,
          title: args.title,
          recurrence: args.recurrence ?? undefined,
          reminderHour: args.reminderHour,
          reminderMinute: args.reminderMinute,
          color: habitCategoryColors[0],
          categoryColors: habitCategoryColors,
        },
      });

      return { content: [{ type: "text", text: JSON.stringify(habit, null, 2) }] };
    }
  );

  server.registerTool(
    "log_habit_today",
    {
      title: "Marcar hábito de hoy",
      description:
        "Marca (o desmarca, si ya estaba marcado) un hábito como cumplido en el día de hoy. Devuelve la racha actualizada.",
      inputSchema: {
        id: z.string().describe("ID del hábito"),
      },
    },
    async ({ id }) => {
      const habit = await prisma.habit.findUnique({ where: { id } });
      if (!habit || habit.userId !== userId) {
        return { isError: true, content: [{ type: "text", text: "Hábito no encontrado" }] };
      }

      const today = argTodayDateString();
      const existingLog = await prisma.habitLog.findUnique({
        where: { habitId_date: { habitId: id, date: today } },
      });

      if (existingLog) {
        await prisma.habitLog.delete({ where: { id: existingLog.id } });
      } else {
        await prisma.habitLog.create({ data: { habitId: id, date: today } });
      }

      const logs = await prisma.habitLog.findMany({ where: { habitId: id } });
      const logDates = logs.map((l) => l.date);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                completedToday: logDates.includes(today),
                streak: computeStreak(habit.recurrence as "DAILY" | "WEEKLY", logDates),
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );


  // --- Apartado "Trabajo": módulos por proyecto con su calendario y su chat.
  // Separado del calendario personal (list_events no lo muestra).

  const WORK_ITEM_FIELDS_HINT =
    "Fechas en hora Argentina: date = YYYY-MM-DD, time = HH:MM (sin time es de todo el día; sin date es un pendiente sin fecha). kind: TASK (pendiente que se tilda), EVENT (algo que pasa ese día, no se tilda) o DEADLINE (fecha límite).";

  const jsonText = (value: unknown) => ({
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  });

  server.registerTool(
    "trabajo_resumen",
    {
      title: "Trabajo: resumen",
      description:
        "Resumen del apartado Trabajo: módulos con sus contadores (pendientes, vencidos, de hoy, nuevos, mensajes sin leer, propuestas sin confirmar) y cuántos mensajes del usuario esperan respuesta. Usalo primero para ver si hay algo para contestar.",
      inputSchema: {},
    },
    async () => {
      const [modules, counts, unanswered] = await Promise.all([
        prisma.workModule.findMany({
          where: { userId, archivedAt: null },
          orderBy: [{ order: "asc" }, { createdAt: "asc" }],
        }),
        workCounts(userId),
        prisma.workMessage.count({ where: { userId, author: "USER", readAt: null } }),
      ]);
      return jsonText({
        mensajesSinResponder: unanswered,
        modulos: modules.map((m) => ({
          id: m.id,
          nombre: m.name,
          descripcion: m.description,
          contadores: counts.byModule[m.id] ?? null,
        })),
        chatGeneral: counts.byModule[""] ?? null,
      });
    }
  );

  server.registerTool(
    "trabajo_crear_modulo",
    {
      title: "Trabajo: crear módulo",
      description: "Crea un módulo nuevo (un proyecto) en el apartado Trabajo.",
      inputSchema: {
        name: z.string().min(1).max(60),
        description: z.string().max(300).optional(),
        icon: z.string().min(1).max(8).optional().describe("Un emoji"),
        color: z
          .string()
          .regex(/^#[0-9a-fA-F]{6}$/)
          .optional()
          .describe(`Color hexadecimal. Sugeridos: ${WORK_COLORS.join(", ")}`),
      },
    },
    async (args) => {
      const count = await prisma.workModule.count({ where: { userId } });
      const mod = await prisma.workModule.create({
        data: { userId, ...args, order: count },
      });
      return jsonText(mod);
    }
  );

  server.registerTool(
    "trabajo_listar_items",
    {
      title: "Trabajo: listar ítems",
      description:
        "Lista los ítems (pendientes, eventos y fechas límite) del apartado Trabajo, de un módulo o de todos. Por defecto trae todo lo no hecho más lo del rango de fechas pedido.",
      inputSchema: {
        moduleId: z.string().optional().describe("ID del módulo; si se omite, de todos"),
        from: dateStringSchema.optional().describe("Desde (YYYY-MM-DD, hora Argentina)"),
        to: dateStringSchema.optional().describe("Hasta (YYYY-MM-DD, hora Argentina)"),
        includeDone: z.boolean().optional().describe("Incluir los hechos de cualquier fecha"),
      },
    },
    async ({ moduleId, from, to, includeDone }) => {
      if (moduleId && !(await getOwnedModule(moduleId, userId))) {
        return { isError: true, content: [{ type: "text", text: "Módulo no encontrado" }] };
      }
      const range =
        from || to
          ? {
              startAt: {
                ...(from ? { gte: argDateTime(from, 0) } : {}),
                ...(to ? { lte: argDateTime(to, 23, 59) } : {}),
              },
            }
          : null;
      const items = await prisma.workItem.findMany({
        where: {
          userId,
          module: { archivedAt: null },
          ...(moduleId ? { moduleId } : {}),
          ...(includeDone ? {} : { OR: [{ done: false }, ...(range ? [range] : [])] }),
        },
        orderBy: [{ startAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
      });
      const now = new Date();
      return jsonText(items.map((i) => serializeItem(i, now)));
    }
  );

  server.registerTool(
    "trabajo_crear_item",
    {
      title: "Trabajo: crear ítem",
      description:
        `Agrega un ítem nuevo a un módulo (le aparece al usuario como "Nuevo"). Usalo para cargar novedades por iniciativa propia (por ejemplo, un plazo nuevo de un proyecto). Si el usuario te PIDIÓ un cambio por el chat, o hay que modificar o borrar algo que ya existe, NO uses esto: usá trabajo_proponer_cambios para que lo confirme. ${WORK_ITEM_FIELDS_HINT}`,
      inputSchema: {
        moduleId: z.string(),
        ...workItemInput.shape,
      },
    },
    async ({ moduleId, ...input }) => {
      if (!(await getOwnedModule(moduleId, userId))) {
        return { isError: true, content: [{ type: "text", text: "Módulo no encontrado" }] };
      }
      const item = await createWorkItem(userId, moduleId, input, "CLAUDE");
      return jsonText(serializeItem(item));
    }
  );

  server.registerTool(
    "trabajo_leer_mensajes",
    {
      title: "Trabajo: leer mensajes del chat",
      description:
        "Lee el chat del apartado Trabajo. Por defecto devuelve, de todos los chats, los mensajes del usuario que todavía no respondiste, cada uno con los últimos mensajes de su chat como contexto. Con moduleId (o \"general\") devuelve ese chat completo.",
      inputSchema: {
        moduleId: z
          .string()
          .optional()
          .describe('ID del módulo, o "general" para el chat general. Si se omite: solo lo pendiente de responder.'),
        limit: z.number().int().min(1).max(100).optional().describe("Máximo de mensajes por chat (default 20)"),
      },
    },
    async ({ moduleId, limit }) => {
      const take = limit ?? 20;
      const chatHistory = async (chatModuleId: string | null) =>
        (
          await prisma.workMessage.findMany({
            where: { userId, moduleId: chatModuleId },
            orderBy: { createdAt: "desc" },
            take,
          })
        )
          .reverse()
          .map(serializeMessage);

      if (moduleId) {
        const chatModuleId = moduleId === "general" ? null : moduleId;
        if (chatModuleId && !(await getOwnedModule(chatModuleId, userId))) {
          return { isError: true, content: [{ type: "text", text: "Módulo no encontrado" }] };
        }
        return jsonText(await chatHistory(chatModuleId));
      }

      const pending = await prisma.workMessage.findMany({
        where: { userId, author: "USER", readAt: null },
        orderBy: { createdAt: "asc" },
        include: { module: { select: { name: true } } },
      });
      const chats = new Map<string, { moduleId: string | null; modulo: string }>();
      for (const m of pending) {
        chats.set(m.moduleId ?? "general", {
          moduleId: m.moduleId,
          modulo: m.module?.name ?? "Chat general",
        });
      }
      const result = [];
      for (const [key, chat] of chats) {
        result.push({
          chat: key,
          modulo: chat.modulo,
          sinResponder: pending.filter((m) => (m.moduleId ?? "general") === key).map((m) => m.id),
          mensajes: await chatHistory(chat.moduleId),
        });
      }
      return jsonText(result);
    }
  );

  const replyToSchema = z
    .array(z.string())
    .optional()
    .describe("IDs de los mensajes del usuario que este mensaje responde (quedan como respondidos)");

  async function postClaudeMessage(
    moduleId: string | undefined,
    text: string,
    replyTo: string[] | undefined,
    proposal?: unknown[]
  ) {
    const chatModuleId = moduleId && moduleId !== "general" ? moduleId : null;
    if (chatModuleId && !(await getOwnedModule(chatModuleId, userId))) return null;
    const message = await prisma.workMessage.create({
      data: {
        userId,
        moduleId: chatModuleId,
        author: "CLAUDE",
        text,
        ...(proposal ? { proposal: proposal as object[], proposalStatus: "PENDING" as const } : {}),
      },
    });
    if (replyTo?.length) {
      await prisma.workMessage.updateMany({
        where: { id: { in: replyTo }, userId, author: "USER" },
        data: { readAt: new Date() },
      });
    }
    await pushClaudeMessage(message);
    return message;
  }

  server.registerTool(
    "trabajo_enviar_mensaje",
    {
      title: "Trabajo: mandar mensaje al chat",
      description:
        "Escribe en el chat del apartado Trabajo (le llega una notificación al usuario). Para responder sus mensajes, pasá sus IDs en replyTo. También sirve para avisar novedades de un proyecto en el chat de su módulo.",
      inputSchema: {
        moduleId: z.string().optional().describe('ID del módulo, o "general" (default)'),
        text: z.string().min(1).max(4000),
        replyTo: replyToSchema,
      },
    },
    async ({ moduleId, text, replyTo }) => {
      const message = await postClaudeMessage(moduleId, text, replyTo);
      if (!message) return { isError: true, content: [{ type: "text", text: "Módulo no encontrado" }] };
      return jsonText(serializeMessage(message));
    }
  );

  server.registerTool(
    "trabajo_proponer_cambios",
    {
      title: "Trabajo: proponer cambios",
      description:
        `Propone cambios en los ítems del apartado Trabajo: le aparecen al usuario en el chat con los botones Confirmar y Rechazar, y recién se aplican cuando confirma. Es la forma de hacer cualquier cambio que el usuario pida por el chat y de modificar o borrar ítems existentes. Cada cambio: {op:"create", moduleId?, data} | {op:"update", itemId, data} | {op:"delete", itemId}. ${WORK_ITEM_FIELDS_HINT}`,
      inputSchema: {
        moduleId: z.string().optional().describe('Chat donde aparece la propuesta: ID del módulo, o "general"'),
        text: z.string().min(1).max(4000).describe("Explicación corta de qué cambia y por qué"),
        changes: z.array(proposalChange).min(1).max(30),
        replyTo: replyToSchema,
      },
    },
    async ({ moduleId, text, changes, replyTo }) => {
      const message = await postClaudeMessage(moduleId, text, replyTo, changes);
      if (!message) return { isError: true, content: [{ type: "text", text: "Módulo no encontrado" }] };
      return jsonText(serializeMessage(message));
    }
  );

  return server;
}

async function handle(req: NextRequest) {
  const userId = await resolveUserId(req);
  if (!userId) {
    return new Response(JSON.stringify({ error: "Token inválido o ausente" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const server = buildServer(userId);
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });

  await server.connect(transport);
  return transport.handleRequest(req);
}

export { handle as GET, handle as POST, handle as DELETE };
