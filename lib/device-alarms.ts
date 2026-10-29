import { prisma } from "@/lib/prisma";
import { hashApiToken } from "@/lib/tokens";
import { occurrencesInRange } from "@/lib/recurrence";
import { argDateTime, argTodayDateString, dateStringAddDays } from "@/lib/timezone";

// Alarmas para la app de Android: todo lo que tiene recordatorio en los
// próximos días (eventos, tareas rápidas y el apartado Trabajo), con la hora
// exacta en que tiene que sonar. La app las programa en el celular y las
// muestra en pantalla completa.

export const ALARM_WINDOW_DAYS = 7;

export type DeviceAlarm = {
  /** Único por ocurrencia: la app lo usa para no programar dos veces lo mismo. */
  id: string;
  title: string;
  body: string;
  fireAt: string;
  /** Página de la app web para abrir desde la alarma. */
  url: string;
};

/** Usuario dueño del token de la app (Ajustes → Tokens API), o null. */
export async function userIdFromBearer(authHeader: string | null): Promise<string | null> {
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : null;
  if (!token) return null;
  const apiToken = await prisma.apiToken.findUnique({ where: { tokenHash: hashApiToken(token) } });
  if (!apiToken) return null;
  prisma.apiToken
    .update({ where: { id: apiToken.id }, data: { lastUsedAt: new Date() } })
    .catch(() => {});
  return apiToken.userId;
}

const timeFormat = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Argentina/Buenos_Aires",
});
const dayFormat = new Intl.DateTimeFormat("es-AR", {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "America/Argentina/Buenos_Aires",
});

export async function deviceAlarms(userId: string, now = new Date()): Promise<DeviceAlarm[]> {
  // Un margen hacia atrás por si el celular sincroniza justo después de la hora.
  const from = new Date(now.getTime() - 5 * 60 * 1000);
  const to = new Date(now.getTime() + ALARM_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const alarms: DeviceAlarm[] = [];

  // Eventos con recordatorio (incluye los que se repiten). Se busca hasta una
  // semana más allá del rango porque el recordatorio puede ser días antes.
  const maxReminderMs = 7 * 24 * 60 * 60 * 1000;
  const events = await prisma.event.findMany({
    where: {
      userId,
      reminderMinutesBefore: { not: null },
      OR: [
        { recurrence: "NONE", startAt: { gte: from, lte: new Date(to.getTime() + maxReminderMs) } },
        {
          recurrence: { not: "NONE" },
          startAt: { lte: new Date(to.getTime() + maxReminderMs) },
          OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: from } }],
        },
      ],
    },
  });
  for (const ev of events) {
    const beforeMs = (ev.reminderMinutesBefore ?? 0) * 60 * 1000;
    const starts = occurrencesInRange(ev, new Date(from.getTime() + beforeMs), new Date(to.getTime() + beforeMs));
    for (const start of starts) {
      const fireAt = new Date(start.getTime() - beforeMs);
      if (fireAt < from || fireAt > to) continue;
      alarms.push({
        id: `evento:${ev.id}:${start.toISOString()}`,
        title: ev.title,
        body: ev.allDay
          ? `Todo el día · ${dayFormat.format(start)}`
          : `${timeFormat.format(start)} · ${dayFormat.format(start)}${ev.location ? ` · ${ev.location}` : ""}`,
        fireAt: fireAt.toISOString(),
        url: "/calendar",
      });
    }
  }

  // Tareas rápidas con hora de recordatorio, sin hacer.
  const today = argTodayDateString(now);
  const lastDay = dateStringAddDays(today, ALARM_WINDOW_DAYS);
  const quickTasks = await prisma.quickTask.findMany({
    where: { userId, done: false, reminderHour: { not: null }, date: { gte: today, lte: lastDay } },
  });
  for (const qt of quickTasks) {
    const fireAt = argDateTime(qt.date, qt.reminderHour ?? 9, qt.reminderMinute ?? 0);
    if (fireAt < from || fireAt > to) continue;
    alarms.push({
      id: `tarea:${qt.id}:${fireAt.toISOString()}`,
      title: qt.title,
      body: "Tarea rápida",
      fireAt: fireAt.toISOString(),
      url: "/calendar",
    });
  }

  // Apartado Trabajo: ítems sin hacer con recordatorio.
  const workItems = await prisma.workItem.findMany({
    where: {
      userId,
      done: false,
      reminderMinutesBefore: { not: null },
      startAt: { not: null, gte: from, lte: new Date(to.getTime() + maxReminderMs) },
      module: { archivedAt: null },
    },
    include: { module: { select: { name: true } } },
  });
  for (const item of workItems) {
    if (!item.startAt) continue;
    const fireAt = new Date(item.startAt.getTime() - (item.reminderMinutesBefore ?? 0) * 60 * 1000);
    if (fireAt < from || fireAt > to) continue;
    alarms.push({
      id: `trabajo:${item.id}:${item.startAt.toISOString()}`,
      title: item.title,
      body: `${item.module.name} · ${item.allDay ? dayFormat.format(item.startAt) : `${timeFormat.format(item.startAt)} · ${dayFormat.format(item.startAt)}`}`,
      fireAt: fireAt.toISOString(),
      url: `/trabajo/${item.moduleId}`,
    });
  }

  alarms.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
  return alarms;
}
