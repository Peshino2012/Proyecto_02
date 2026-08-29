import { NextRequest } from "next/server";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { prisma } from "@/lib/prisma";
import { hashApiToken } from "@/lib/tokens";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { findConflicts } from "@/lib/conflicts";
import { argDateTime, argTodayDateString } from "@/lib/timezone";
import { occurrencesInRange } from "@/lib/recurrence";
import { computeStreak, isCompletedToday } from "@/lib/habits";

const RECURRENCE_HINT =
  "NONE (no se repite), DAILY (todos los días), WEEKLY (todas las semanas), MONTHLY (todos los meses)";

const CATEGORY_HINT = EVENT_CATEGORIES.map((c) => `${c.label}=${c.color}`).join(", ");

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
          .describe("Minutos antes del evento para enviar un recordatorio push/email"),
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
          color: args.color ?? undefined,
          recurrence: args.recurrence ?? undefined,
          recurrenceEndAt: args.recurrenceEndAt ? new Date(args.recurrenceEndAt) : undefined,
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

      const event = await prisma.event.update({
        where: { id: realId },
        data: {
          title: rest.title,
          description: rest.description,
          location: rest.location,
          allDay: rest.allDay,
          reminderMinutesBefore: rest.reminderMinutesBefore,
          color: rest.color,
          recurrence: rest.recurrence,
          recurrenceEndAt: rest.recurrenceEndAt ? new Date(rest.recurrenceEndAt) : undefined,
          startAt: rest.startAt ? nextStart : undefined,
          endAt: rest.endAt ? nextEnd : undefined,
          notifiedAt:
            rest.startAt || rest.reminderMinutesBefore !== undefined ? null : undefined,
          lastNotifiedOccurrenceAt:
            rest.startAt || rest.reminderMinutesBefore !== undefined || rest.recurrence
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
      const habit = await prisma.habit.create({
        data: {
          userId,
          title: args.title,
          recurrence: args.recurrence ?? undefined,
          reminderHour: args.reminderHour,
          reminderMinute: args.reminderMinute,
          color: args.color ?? undefined,
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
