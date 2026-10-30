import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { argDateTime, argTodayDateString } from "@/lib/timezone";
import type { Prisma, WorkItem } from "@/app/generated/prisma/client";

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

export type ModuleCounts = {
  pending: number;
  overdue: number;
  today: number;
  newItems: number;
  attention: number;
};

/**
 * Contadores por módulo, más el total que se muestra en el botón "Trabajo":
 * lo que pide atención ahora (vencidos, lo de hoy y lo nuevo de Claude).
 */
export async function workCounts(userId: string, now = new Date()) {
  const items = await prisma.workItem.findMany({
    where: {
      userId,
      module: { archivedAt: null },
      OR: [{ done: false }, { createdBy: "CLAUDE", seenAt: null }],
    },
    select: { moduleId: true, kind: true, done: true, startAt: true, allDay: true, createdBy: true, seenAt: true },
  });

  const byModule = new Map<string, ModuleCounts>();
  let total = 0;
  for (const item of items) {
    let c = byModule.get(item.moduleId);
    if (!c) {
      c = { pending: 0, overdue: 0, today: 0, newItems: 0, attention: 0 };
      byModule.set(item.moduleId, c);
    }
    const status = itemStatus(item, now);
    if (!item.done && item.kind !== "EVENT") c.pending += 1;
    if (status === "overdue") c.overdue += 1;
    if (status === "today") c.today += 1;
    if (item.createdBy === "CLAUDE" && !item.seenAt) c.newItems += 1;
  }
  for (const c of byModule.values()) {
    c.attention = c.overdue + c.today + c.newItems;
    total += c.attention;
  }

  return { byModule: Object.fromEntries(byModule), total };
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
