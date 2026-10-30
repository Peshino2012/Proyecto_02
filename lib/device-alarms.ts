import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { hashApiToken } from "@/lib/tokens";
import { occurrencesInRange } from "@/lib/recurrence";
import { argDateTime, argTodayDateString, dateStringAddDays } from "@/lib/timezone";

// Alarmas para la app de Android: eventos (a su hora y en su recordatorio),
// tareas rápidas y el apartado Trabajo de los próximos días, con la hora
// exacta en que tiene que sonar cada una. La app las programa en el celular y
// las muestra en pantalla completa.

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

/** Canal secreto de ntfy.sh del usuario (se crea la primera vez que la app sincroniza). */
export async function ensureDeviceTopic(userId: string): Promise<string> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { deviceTopic: true } });
  if (user?.deviceTopic) return user.deviceTopic;
  const topic = `calendario-${randomBytes(18).toString("base64url")}`;
  await prisma.user.update({ where: { id: userId }, data: { deviceTopic: topic } });
  return topic;
}

/**
 * Cada evento con hora suena a la hora en que empieza; si además tiene un
 * recordatorio antes (10 min, 1 h…), suena también a esa hora. Las tareas
 * rápidas suenan a la hora de su recordatorio y los ítems del apartado Trabajo
 * igual que los eventos. Lo que ya pasó hace más de unos minutos no se manda.
 */
export async function deviceAlarms(userId: string, now = new Date()): Promise<DeviceAlarm[]> {
  // Margen hacia atrás: si el celular sincroniza un par de minutos tarde, la
  // alarma recién vencida igual suena (la app no repite las que ya sonaron).
  const from = new Date(now.getTime() - 5 * 60 * 1000);
  const to = new Date(now.getTime() + ALARM_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const maxReminderMs = 7 * 24 * 60 * 60 * 1000;
  const alarms: DeviceAlarm[] = [];

  const agregar = (alarm: DeviceAlarm) => {
    const fireAt = new Date(alarm.fireAt);
    if (fireAt >= from && fireAt <= to) alarms.push(alarm);
  };

  const events = await prisma.event.findMany({
    where: {
      userId,
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
    const starts = occurrencesInRange(ev, from, new Date(to.getTime() + beforeMs));
    for (const start of starts) {
      const cuando = ev.allDay
        ? `Todo el día · ${dayFormat.format(start)}`
        : `${timeFormat.format(start)} · ${dayFormat.format(start)}${ev.location ? ` · ${ev.location}` : ""}`;
      // A la hora del evento (los de todo el día no tienen hora: solo suenan si tienen recordatorio).
      if (!ev.allDay) {
        agregar({ id: `evento:${ev.id}:${start.toISOString()}`, title: ev.title, body: `Ahora · ${cuando}`, fireAt: start.toISOString(), url: "/calendar" });
      }
      if (ev.reminderMinutesBefore != null && (ev.reminderMinutesBefore > 0 || ev.allDay)) {
        const fireAt = new Date(start.getTime() - beforeMs);
        agregar({ id: `evento:${ev.id}:${start.toISOString()}:aviso`, title: ev.title, body: cuando, fireAt: fireAt.toISOString(), url: "/calendar" });
      }
    }
  }

  // Tareas rápidas con hora de recordatorio, sin hacer.
  const today = argTodayDateString(now);
  const lastDay = dateStringAddDays(today, ALARM_WINDOW_DAYS);
  const quickTasks = await prisma.quickTask.findMany({
    where: { userId, done: false, reminderHour: { not: null }, date: { gte: dateStringAddDays(today, -1), lte: lastDay } },
  });
  for (const qt of quickTasks) {
    const fireAt = argDateTime(qt.date, qt.reminderHour ?? 9, qt.reminderMinute ?? 0);
    agregar({ id: `tarea:${qt.id}:${fireAt.toISOString()}`, title: qt.title, body: "Tarea rápida", fireAt: fireAt.toISOString(), url: "/calendar" });
  }

  // Apartado Trabajo: ítems sin hacer con fecha.
  const workItems = await prisma.workItem.findMany({
    where: {
      userId,
      done: false,
      startAt: { not: null, gte: from, lte: new Date(to.getTime() + maxReminderMs) },
      module: { archivedAt: null },
    },
    include: { module: { select: { name: true } } },
  });
  for (const item of workItems) {
    if (!item.startAt) continue;
    const cuando = `${item.module.name} · ${item.allDay ? dayFormat.format(item.startAt) : `${timeFormat.format(item.startAt)} · ${dayFormat.format(item.startAt)}`}`;
    const url = `/trabajo/${item.moduleId}`;
    if (!item.allDay) {
      agregar({ id: `trabajo:${item.id}:${item.startAt.toISOString()}`, title: item.title, body: `Ahora · ${cuando}`, fireAt: item.startAt.toISOString(), url });
    }
    if (item.reminderMinutesBefore != null && (item.reminderMinutesBefore > 0 || item.allDay)) {
      const fireAt = new Date(item.startAt.getTime() - item.reminderMinutesBefore * 60 * 1000);
      agregar({ id: `trabajo:${item.id}:${item.startAt.toISOString()}:aviso`, title: item.title, body: cuando, fireAt: fireAt.toISOString(), url });
    }
  }

  alarms.sort((a, b) => a.fireAt.localeCompare(b.fireAt));
  return alarms;
}
