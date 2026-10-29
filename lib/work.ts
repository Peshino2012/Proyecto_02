import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { argCurrentHour, argDateTime, argTodayDateString, isWithinQuietHours } from "@/lib/timezone";
import type { Prisma, WorkItem, WorkMessage } from "@/app/generated/prisma/client";

// Apartado "Trabajo": lógica compartida entre la API de la app, el MCP (lo
// que usa Claude) y el cron de avisos.

export const WORK_COLORS = [
  "#eab308",
  "#7c3aed",
  "#0d9488",
  "#2563eb",
  "#dc2626",
  "#db2777",
  "#16a34a",
  "#ea580c",
] as const;

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const timeString = z.string().regex(/^\d{2}:\d{2}$/);

// Un ítem se describe con día (YYYY-MM-DD) y hora opcional (HH:MM), siempre
// en hora Argentina: así lo escriben igual la app y Claude, sin husos.
export const workItemInput = z.object({
  title: z.string().min(1).max(200),
  notes: z.string().max(2000).optional().nullable(),
  kind: z.enum(["TASK", "EVENT", "DEADLINE"]).optional(),
  date: dateString.optional().nullable(),
  time: timeString.optional().nullable(),
  reminderMinutesBefore: z.number().int().min(0).max(60 * 24 * 7).optional().nullable(),
});

export const workItemUpdate = workItemInput.partial().extend({
  done: z.boolean().optional(),
});

export type WorkItemInput = z.infer<typeof workItemInput>;
export type WorkItemUpdate = z.infer<typeof workItemUpdate>;

export const proposalChange = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), moduleId: z.string().optional(), data: workItemInput }),
  z.object({ op: z.literal("update"), itemId: z.string(), data: workItemUpdate }),
  z.object({ op: z.literal("delete"), itemId: z.string() }),
]);

export type ProposalChange = z.infer<typeof proposalChange>;

/** Día y hora (Argentina) → instante. Sin hora, el ítem es de todo el día y se guarda a las 09:00. */
export function itemStart(date: string | null | undefined, time: string | null | undefined) {
  if (!date) return { startAt: null, allDay: true };
  if (!time) return { startAt: argDateTime(date, 9), allDay: true };
  const [h, m] = time.split(":").map(Number);
  return { startAt: argDateTime(date, h, m), allDay: false };
}

function itemData(input: WorkItemUpdate) {
  const data: Prisma.WorkItemUncheckedUpdateInput = {};
  if (input.title !== undefined) data.title = input.title;
  if (input.notes !== undefined) data.notes = input.notes;
  if (input.kind !== undefined) data.kind = input.kind;
  if (input.date !== undefined) {
    const { startAt, allDay } = itemStart(input.date, input.time);
    data.startAt = startAt;
    data.allDay = allDay;
    // Si cambia la fecha, el recordatorio vuelve a quedar pendiente.
    data.notifiedAt = null;
  }
  if (input.reminderMinutesBefore !== undefined) {
    data.reminderMinutesBefore = input.reminderMinutesBefore;
    data.notifiedAt = null;
  }
  if (input.done !== undefined) {
    data.done = input.done;
    data.doneAt = input.done ? new Date() : null;
  }
  return data;
}

export async function getOwnedModule(id: string, userId: string) {
  const mod = await prisma.workModule.findUnique({ where: { id } });
  if (!mod || mod.userId !== userId) return null;
  return mod;
}

export async function getOwnedItem(id: string, userId: string) {
  const item = await prisma.workItem.findUnique({ where: { id } });
  if (!item || item.userId !== userId) return null;
  return item;
}

export async function createWorkItem(
  userId: string,
  moduleId: string,
  input: WorkItemInput,
  createdBy: "USER" | "CLAUDE"
) {
  const { startAt, allDay } = itemStart(input.date, input.time);
  return prisma.workItem.create({
    data: {
      userId,
      moduleId,
      title: input.title,
      notes: input.notes ?? null,
      kind: input.kind ?? "TASK",
      startAt,
      allDay,
      reminderMinutesBefore: input.reminderMinutesBefore ?? null,
      createdBy,
      // Lo que carga el usuario ya lo vio; lo de Claude sale como "Nuevo".
      seenAt: createdBy === "USER" ? new Date() : null,
    },
  });
}

export async function updateWorkItem(id: string, input: WorkItemUpdate) {
  return prisma.workItem.update({ where: { id }, data: itemData(input) });
}

/** Ítem → forma que usan la app y Claude (día y hora en Argentina). */
export function serializeItem(item: WorkItem, now = new Date()) {
  const date = item.startAt ? argTodayDateString(item.startAt) : null;
  const time =
    item.startAt && !item.allDay
      ? new Intl.DateTimeFormat("es-AR", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
          timeZone: "America/Argentina/Buenos_Aires",
        }).format(item.startAt)
      : null;
  return {
    id: item.id,
    moduleId: item.moduleId,
    title: item.title,
    notes: item.notes,
    kind: item.kind,
    date,
    time,
    startAt: item.startAt?.toISOString() ?? null,
    allDay: item.allDay,
    done: item.done,
    reminderMinutesBefore: item.reminderMinutesBefore,
    createdBy: item.createdBy,
    isNew: item.createdBy === "CLAUDE" && !item.seenAt,
    status: itemStatus(item, now),
  };
}

export type SerializedWorkItem = ReturnType<typeof serializeItem>;

/** Estado de un pendiente: vencido, vence hoy, próximo, sin fecha, hecho o evento. */
export function itemStatus(item: Pick<WorkItem, "kind" | "done" | "startAt" | "allDay">, now = new Date()) {
  if (item.kind === "EVENT") return "event" as const;
  if (item.done) return "done" as const;
  if (!item.startAt) return "undated" as const;
  const today = argTodayDateString(now);
  const day = argTodayDateString(item.startAt);
  if (day < today || (!item.allDay && day === today && item.startAt < now)) return "overdue" as const;
  if (day === today) return "today" as const;
  return "upcoming" as const;
}

export function serializeMessage(msg: WorkMessage) {
  return {
    id: msg.id,
    moduleId: msg.moduleId,
    author: msg.author,
    text: msg.text,
    proposal: (msg.proposal as ProposalChange[] | null) ?? null,
    proposalStatus: msg.proposalStatus,
    read: !!msg.readAt,
    createdAt: msg.createdAt.toISOString(),
  };
}

export type ModuleCounts = {
  pending: number;
  overdue: number;
  today: number;
  newItems: number;
  unreadMessages: number;
  pendingProposals: number;
  attention: number;
};

/**
 * Contadores por módulo (y del chat general, con clave ""), más el total que
 * se muestra en el botón "Trabajo": lo que pide atención ahora (vencidos, lo
 * de hoy, lo nuevo de Claude, mensajes sin leer y cambios por confirmar).
 */
export async function workCounts(userId: string, now = new Date()) {
  const [items, messages] = await Promise.all([
    prisma.workItem.findMany({
      where: {
        userId,
        module: { archivedAt: null },
        OR: [{ done: false }, { createdBy: "CLAUDE", seenAt: null }],
      },
      select: { moduleId: true, kind: true, done: true, startAt: true, allDay: true, createdBy: true, seenAt: true },
    }),
    prisma.workMessage.findMany({
      where: {
        userId,
        author: "CLAUDE",
        OR: [{ readAt: null }, { proposalStatus: "PENDING" }],
      },
      select: { moduleId: true, readAt: true, proposalStatus: true },
    }),
  ]);

  const byModule = new Map<string, ModuleCounts>();
  const get = (key: string) => {
    let c = byModule.get(key);
    if (!c) {
      c = { pending: 0, overdue: 0, today: 0, newItems: 0, unreadMessages: 0, pendingProposals: 0, attention: 0 };
      byModule.set(key, c);
    }
    return c;
  };

  for (const item of items) {
    const c = get(item.moduleId);
    const status = itemStatus(item, now);
    if (!item.done && item.kind !== "EVENT") c.pending += 1;
    if (status === "overdue") c.overdue += 1;
    if (status === "today") c.today += 1;
    if (item.createdBy === "CLAUDE" && !item.seenAt) c.newItems += 1;
  }
  for (const msg of messages) {
    const c = get(msg.moduleId ?? "");
    if (!msg.readAt) c.unreadMessages += 1;
    if (msg.proposalStatus === "PENDING") c.pendingProposals += 1;
  }

  let total = 0;
  for (const c of byModule.values()) {
    // Una propuesta sin leer ya cuenta como mensaje sin leer: no la sumamos dos veces.
    const proposalsAlreadyCounted = Math.min(c.pendingProposals, c.unreadMessages);
    c.attention = c.overdue + c.today + c.newItems + c.unreadMessages + c.pendingProposals - proposalsAlreadyCounted;
    total += c.attention;
  }

  return { byModule: Object.fromEntries(byModule), total };
}

/** Aplica (o rechaza) los cambios que propuso Claude en un mensaje. */
export async function resolveProposal(userId: string, messageId: string, action: "apply" | "reject") {
  const msg = await prisma.workMessage.findUnique({ where: { id: messageId } });
  if (!msg || msg.userId !== userId || msg.author !== "CLAUDE" || !msg.proposal) {
    return { error: "Propuesta no encontrada", status: 404 } as const;
  }
  if (msg.proposalStatus !== "PENDING") {
    return { error: "Esta propuesta ya se resolvió", status: 409 } as const;
  }

  if (action === "reject") {
    await prisma.workMessage.update({
      where: { id: msg.id },
      data: { proposalStatus: "REJECTED", readAt: msg.readAt ?? new Date() },
    });
    return { ok: true, applied: 0 } as const;
  }

  const parsed = z.array(proposalChange).safeParse(msg.proposal);
  if (!parsed.success) return { error: "La propuesta tiene un formato inválido", status: 400 } as const;

  let applied = 0;
  for (const change of parsed.data) {
    if (change.op === "create") {
      const moduleId = change.moduleId ?? msg.moduleId;
      if (!moduleId || !(await getOwnedModule(moduleId, userId))) continue;
      // Lo confirmó el usuario: ya lo vio, no sale como "Nuevo".
      const item = await createWorkItem(userId, moduleId, change.data, "CLAUDE");
      await prisma.workItem.update({ where: { id: item.id }, data: { seenAt: new Date() } });
      applied += 1;
    } else {
      const item = await getOwnedItem(change.itemId, userId);
      if (!item) continue;
      if (change.op === "update") await updateWorkItem(item.id, change.data);
      else await prisma.workItem.delete({ where: { id: item.id } });
      applied += 1;
    }
  }

  await prisma.workMessage.update({
    where: { id: msg.id },
    data: { proposalStatus: "APPLIED", readAt: msg.readAt ?? new Date() },
  });
  return { ok: true, applied } as const;
}

/**
 * Manda el push de un mensaje de Claude, salvo en horario silenciado (en ese
 * caso queda pushedAt = null y lo reintenta el cron).
 */
export async function pushClaudeMessage(msg: WorkMessage, now = new Date()) {
  const user = await prisma.user.findUnique({
    where: { id: msg.userId },
    select: { quietHoursStart: true, quietHoursEnd: true },
  });
  if (!user || isWithinQuietHours(argCurrentHour(now), user.quietHoursStart, user.quietHoursEnd)) {
    return false;
  }
  const mod = msg.moduleId
    ? await prisma.workModule.findUnique({ where: { id: msg.moduleId }, select: { name: true } })
    : null;

  const outcome = await sendPushToUser(msg.userId, {
    title: `Claude · ${mod?.name ?? "Trabajo"}`,
    body: msg.proposal ? `Te propone cambios: ${msg.text}` : msg.text,
    url: msg.moduleId ? `/trabajo/${msg.moduleId}?tab=chat` : "/trabajo",
  }).catch((err) => {
    console.error("[trabajo] no se pudo mandar el push del mensaje", err);
    return null;
  });

  if (outcome && outcome.sent > 0) {
    await prisma.workMessage.update({ where: { id: msg.id }, data: { pushedAt: now } });
    return true;
  }
  return false;
}

// Módulos sugeridos para arrancar (los proyectos de Martín al 29/10/2026).
// Los ítems salen como cargados por Claude, así se ven como "Nuevo".
export const SUGGESTED_MODULES: {
  name: string;
  description: string;
  icon: string;
  color: string;
  items: WorkItemInput[];
}[] = [
  {
    name: "Mercado Libre",
    description: "Planillas de Excel: 15 publicaciones activas y el contestador automático de preguntas.",
    icon: "🛒",
    color: "#eab308",
    items: [
      {
        title: "Primera venta: mandarle captura a Claude antes de entregar",
        notes: "Claude te pasa el mensaje de entrega con el link de Drive.",
        kind: "TASK",
      },
      {
        title: "Opcional: \"Verificar producto\" en las publicaciones nuevas",
        kind: "TASK",
      },
    ],
  },
  {
    name: "Hackathons",
    description: "Cobra (hackathon de PayPal) y las próximas convocatorias.",
    icon: "🏆",
    color: "#7c3aed",
    items: [
      {
        title: "Cobra: empiezan a salir los resultados",
        notes: "Los jueces anuncian entre el 1 y el 15 de diciembre.",
        kind: "EVENT",
        date: "2026-12-01",
      },
      {
        title: "Cobra: último día para los resultados",
        kind: "EVENT",
        date: "2026-12-15",
      },
      { title: "Vaquita: elegir una hackathon o grant para presentarla", kind: "TASK" },
    ],
  },
  {
    name: "Prospectos y TPT",
    description: "Páginas web para negocios de Mendoza y materiales para Teachers Pay Teachers.",
    icon: "🤝",
    color: "#0d9488",
    items: [
      {
        title: "Seguimiento por WhatsApp a los 5 negocios",
        notes: "Veterinaria Pelusa, Veterinaria Inalican, Facundo Sebastianelli Peluqueros, Erina Estilista y Sport Fitness.",
        kind: "TASK",
        date: "2026-10-29",
      },
      { title: "TPT: revisar el español de los 3 PDF", kind: "TASK" },
      { title: "TPT: abrir la cuenta Basic y ver si Hyperwallet paga en Argentina", kind: "TASK" },
    ],
  },
  {
    name: "Apps y Tiendanube",
    description: "Dólar Automático (Tiendanube), Pizarra Dólar, Aguinaldo y Sueldo, AutoFlow.",
    icon: "📱",
    color: "#2563eb",
    items: [
      { title: "Pegarle a Claude la respuesta de Tiendanube cuando llegue", kind: "TASK" },
      {
        title: "Difundir Aguinaldo y Sueldo",
        notes: "Antes de que se cobre el aguinaldo.",
        kind: "DEADLINE",
        date: "2026-12-18",
      },
      { title: "Revocar el token viejo de crates.io y borrar el secret de PD1", kind: "TASK" },
    ],
  },
];

export const WELCOME_MESSAGE =
  "¡Hola! Este es el apartado Trabajo: un módulo por proyecto, con su calendario, sus pendientes y este chat. " +
  "Escribime acá lo que necesites y te contesto en este mismo chat (te llega una notificación). " +
  "No es al instante: leo los mensajes cuando trabajamos juntos y en la revisión automática. " +
  "Si me pedís un cambio, te lo muestro primero y lo aplico cuando tocás Confirmar.";
