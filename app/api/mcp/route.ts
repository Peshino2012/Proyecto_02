import { NextRequest } from "next/server";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { prisma } from "@/lib/prisma";
import { hashApiToken } from "@/lib/tokens";

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
          startAt: { lte: rangeTo },
          endAt: { gte: rangeFrom },
        },
        orderBy: { startAt: "asc" },
      });

      return {
        content: [{ type: "text", text: JSON.stringify(events, null, 2) }],
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
        color: z.string().optional().describe("Color hexadecimal, ej. #4f46e5"),
      },
    },
    async (args) => {
      if (new Date(args.endAt) < new Date(args.startAt)) {
        return {
          isError: true,
          content: [{ type: "text", text: "La fecha de fin no puede ser anterior a la de inicio" }],
        };
      }

      const event = await prisma.event.create({
        data: {
          userId,
          title: args.title,
          description: args.description,
          location: args.location,
          startAt: new Date(args.startAt),
          endAt: new Date(args.endAt),
          allDay: args.allDay ?? false,
          reminderMinutesBefore: args.reminderMinutesBefore,
          color: args.color ?? undefined,
        },
      });

      return {
        content: [{ type: "text", text: JSON.stringify(event, null, 2) }],
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
        color: z.string().optional(),
      },
    },
    async ({ id, ...rest }) => {
      const existing = await prisma.event.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return {
          isError: true,
          content: [{ type: "text", text: "Evento no encontrado" }],
        };
      }

      const event = await prisma.event.update({
        where: { id },
        data: {
          ...rest,
          startAt: rest.startAt ? new Date(rest.startAt) : undefined,
          endAt: rest.endAt ? new Date(rest.endAt) : undefined,
          notifiedAt:
            rest.startAt || rest.reminderMinutesBefore !== undefined ? null : undefined,
        },
      });

      return {
        content: [{ type: "text", text: JSON.stringify(event, null, 2) }],
      };
    }
  );

  server.registerTool(
    "delete_event",
    {
      title: "Borrar evento",
      description: "Elimina un evento del calendario del usuario.",
      inputSchema: {
        id: z.string().describe("ID del evento a borrar"),
      },
    },
    async ({ id }) => {
      const existing = await prisma.event.findUnique({ where: { id } });
      if (!existing || existing.userId !== userId) {
        return {
          isError: true,
          content: [{ type: "text", text: "Evento no encontrado" }],
        };
      }

      await prisma.event.delete({ where: { id } });

      return { content: [{ type: "text", text: "Evento borrado" }] };
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
