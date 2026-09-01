import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { sendReminderEmail } from "@/lib/mail";
import { nextOccurrenceAfter } from "@/lib/recurrence";
import {
  argCurrentHour,
  argMinutesSinceMidnight,
  argTodayDateString,
  dateStringDiffDays,
  isWithinQuietHours,
} from "@/lib/timezone";

// Ventana máxima de recordatorio permitida al crear un evento (7 días).
const MAX_REMINDER_MS = 60 * 24 * 7 * 60 * 1000;

function formatEventTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

type DueItem = {
  eventId: string;
  userId: string;
  userEmail: string;
  title: string;
  description: string | null;
  location: string | null;
  occurrenceStart: Date;
  isRecurring: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
};

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();

  // --- Eventos que no se repiten: un solo aviso, gate por notifiedAt ---
  const oneOffCandidates = await prisma.event.findMany({
    where: {
      recurrence: "NONE",
      notifiedAt: null,
      reminderMinutesBefore: { not: null },
      // Sin límite inferior: si el cron se saltea una vuelta (pasa en el plan
      // gratis de cron-job.org), el recordatorio pendiente se manda igual en
      // la próxima ejecución en vez de perderse para siempre.
      startAt: { lte: new Date(now.getTime() + MAX_REMINDER_MS) },
    },
    include: { user: true },
  });

  const dueOneOff: DueItem[] = oneOffCandidates
    .filter((ev) => {
      const reminderAt = new Date(
        ev.startAt.getTime() - (ev.reminderMinutesBefore ?? 0) * 60 * 1000
      );
      return reminderAt <= now;
    })
    .map((ev) => ({
      eventId: ev.id,
      userId: ev.userId,
      userEmail: ev.user.email,
      title: ev.title,
      description: ev.description,
      location: ev.location,
      occurrenceStart: ev.startAt,
      isRecurring: false,
      quietHoursStart: ev.user.quietHoursStart,
      quietHoursEnd: ev.user.quietHoursEnd,
    }));

  // --- Eventos recurrentes: se repiten para siempre, gate por
  // lastNotifiedOccurrenceAt en vez de notifiedAt. Si se saltearon varias
  // ocurrencias (server caído, etc.), avisamos solo por la más reciente
  // vencida, no mandamos un backlog de notificaciones atrasadas.
  const recurringCandidates = await prisma.event.findMany({
    where: {
      recurrence: { not: "NONE" },
      reminderMinutesBefore: { not: null },
    },
    include: { user: true },
  });

  const dueRecurring: DueItem[] = [];
  for (const ev of recurringCandidates) {
    let dueOccurrence: Date | null = null;
    let candidate = nextOccurrenceAfter(ev, ev.lastNotifiedOccurrenceAt);
    let guard = 0;

    while (candidate && guard < 500) {
      const reminderAt = new Date(
        candidate.getTime() - (ev.reminderMinutesBefore ?? 0) * 60 * 1000
      );
      if (reminderAt > now) break;
      dueOccurrence = candidate;
      candidate = nextOccurrenceAfter(ev, candidate);
      guard += 1;
    }

    if (dueOccurrence) {
      dueRecurring.push({
        eventId: ev.id,
        userId: ev.userId,
        userEmail: ev.user.email,
        title: ev.title,
        description: ev.description,
        location: ev.location,
        occurrenceStart: dueOccurrence,
        isRecurring: true,
        quietHoursStart: ev.user.quietHoursStart,
        quietHoursEnd: ev.user.quietHoursEnd,
      });
    }
  }

  const due = [...dueOneOff, ...dueRecurring];

  let pushAttempted = 0;
  let pushSent = 0;
  let pushFailed = 0;
  let notified = 0;
  let stillPending = 0;
  let quietSkipped = 0;

  const currentHour = argCurrentHour(now);

  for (const item of due) {
    if (isWithinQuietHours(currentHour, item.quietHoursStart, item.quietHoursEnd)) {
      // No molestar: no mandamos nada y lo dejamos pendiente para la
      // próxima corrida, que ya va a estar fuera del horario silenciado.
      quietSkipped += 1;
      continue;
    }

    const title = `Recordatorio: ${item.title}`;
    const body = `${formatEventTime(item.occurrenceStart)}${
      item.location ? ` · ${item.location}` : ""
    }`;

    const pushOutcome = await sendPushToUser(item.userId, {
      title,
      body,
      url: "/calendar",
    }).catch((err) => {
      console.error("[cron] sendPushToUser lanzó una excepción", err);
      return null;
    });

    let pushOk = false;
    if (pushOutcome) {
      pushAttempted += pushOutcome.attempted;
      pushSent += pushOutcome.sent;
      pushFailed += pushOutcome.failed;
      pushOk = pushOutcome.sent > 0;
    }

    // El email es un respaldo, no un segundo aviso: solo se manda si el push
    // no llegó a ningún dispositivo (para no duplicar notificación).
    let emailOk = false;
    if (!pushOk) {
      emailOk = await sendReminderEmail(
        item.userEmail,
        title,
        `<p><strong>${item.title}</strong></p><p>${body}</p>${
          item.description ? `<p>${item.description}</p>` : ""
        }`
      ).catch((err) => {
        console.error("[cron] sendReminderEmail lanzó una excepción", err);
        return false;
      });
    }

    // Solo avanzamos el estado si algún canal funcionó de verdad. Si no, lo
    // dejamos pendiente para reintentar en la próxima corrida en vez de
    // perder el recordatorio en silencio.
    if (pushOk || emailOk) {
      await prisma.event.update({
        where: { id: item.eventId },
        data: item.isRecurring
          ? { lastNotifiedOccurrenceAt: item.occurrenceStart }
          : { notifiedAt: now },
      });
      notified += 1;
    } else {
      console.error(`[cron] no se pudo notificar el evento ${item.eventId}, se reintenta después`);
      stillPending += 1;
    }
  }

  // --- Recordatorios de hábitos: una vez por día, a la hora configurada,
  // solo si todavía no se marcó como cumplido hoy.
  const today = argTodayDateString(now);
  const nowMinutes = argMinutesSinceMidnight(now);

  const habitCandidates = await prisma.habit.findMany({
    where: { archivedAt: null, reminderHour: { not: null } },
    include: { user: true, logs: { where: { date: today } } },
  });

  let habitRemindersSent = 0;
  let habitRemindersSkipped = 0;

  for (const habit of habitCandidates) {
    if (habit.lastReminderSentDate === today) continue;
    if (habit.logs.length > 0) continue;

    const reminderMinutes = (habit.reminderHour ?? 0) * 60 + (habit.reminderMinute ?? 0);
    if (nowMinutes < reminderMinutes) continue;

    if (isWithinQuietHours(currentHour, habit.user.quietHoursStart, habit.user.quietHoursEnd)) {
      habitRemindersSkipped += 1;
      continue;
    }

    const pushOutcome = await sendPushToUser(habit.userId, {
      title: `Hábito: ${habit.title}`,
      body:
        habit.recurrence === "DAILY"
          ? "Todavía no lo marcaste hoy."
          : "Esta semana todavía no lo marcaste.",
      url: "/habits",
    }).catch((err) => {
      console.error("[cron] sendPushToUser (hábito) lanzó una excepción", err);
      return null;
    });

    if (pushOutcome && pushOutcome.sent > 0) {
      await prisma.habit.update({
        where: { id: habit.id },
        data: { lastReminderSentDate: today },
      });
      habitRemindersSent += 1;
    }
  }

  // --- Cuenta regresiva de eventos: aviso diario entre countdownFrom y
  // countdownTo (inclusive), a una hora fija por evento. No repite el
  // evento, solo avisa "faltan X días" (relativo al día real del evento).
  const countdownCandidates = await prisma.event.findMany({
    where: { countdownFrom: { not: null } },
    include: { user: true },
  });

  let countdownSent = 0;
  let countdownSkipped = 0;

  for (const ev of countdownCandidates) {
    if (ev.countdownFrom == null || ev.countdownTo == null) continue;

    const eventDay = argTodayDateString(ev.startAt);
    if (today < ev.countdownFrom || today > ev.countdownTo) continue;
    if (ev.countdownLastSentDate === today) continue;

    const fireMinutes = (ev.countdownHour ?? 9) * 60 + (ev.countdownMinute ?? 0);
    if (nowMinutes < fireMinutes) continue;

    if (isWithinQuietHours(currentHour, ev.user.quietHoursStart, ev.user.quietHoursEnd)) {
      countdownSkipped += 1;
      continue;
    }

    const daysLeft = dateStringDiffDays(today, eventDay);
    const body =
      daysLeft <= 0
        ? "Es hoy."
        : daysLeft === 1
          ? "Falta 1 día."
          : `Faltan ${daysLeft} días.`;

    const pushOutcome = await sendPushToUser(ev.userId, {
      title: `Cuenta regresiva: ${ev.title}`,
      body,
      url: "/calendar",
    }).catch((err) => {
      console.error("[cron] sendPushToUser (countdown) lanzó una excepción", err);
      return null;
    });

    if (pushOutcome && pushOutcome.sent > 0) {
      await prisma.event.update({
        where: { id: ev.id },
        data: { countdownLastSentDate: today },
      });
      countdownSent += 1;
    }
  }

  // --- Recordatorios de tareas rápidas: una sola vez, a la hora configurada
  // por tarea, solo si todavía no está marcada como hecha.
  const quickTaskCandidates = await prisma.quickTask.findMany({
    where: { date: today, done: false, reminderHour: { not: null } },
    include: { user: true },
  });

  let quickTaskRemindersSent = 0;
  let quickTaskRemindersSkipped = 0;

  for (const qt of quickTaskCandidates) {
    if (qt.lastReminderSentDate === today) continue;

    const reminderMinutes = (qt.reminderHour ?? 0) * 60 + (qt.reminderMinute ?? 0);
    if (nowMinutes < reminderMinutes) continue;

    if (isWithinQuietHours(currentHour, qt.user.quietHoursStart, qt.user.quietHoursEnd)) {
      quickTaskRemindersSkipped += 1;
      continue;
    }

    const pushOutcome = await sendPushToUser(qt.userId, {
      title: `Tarea: ${qt.title}`,
      body: "Todavía no la marcaste como hecha.",
      url: "/calendar",
    }).catch((err) => {
      console.error("[cron] sendPushToUser (tarea rápida) lanzó una excepción", err);
      return null;
    });

    if (pushOutcome && pushOutcome.sent > 0) {
      await prisma.quickTask.update({
        where: { id: qt.id },
        data: { lastReminderSentDate: today },
      });
      quickTaskRemindersSent += 1;
    }
  }

  console.log(
    `[cron] checked=${oneOffCandidates.length + recurringCandidates.length} due=${due.length} notified=${notified} stillPending=${stillPending} quietSkipped=${quietSkipped} pushAttempted=${pushAttempted} pushSent=${pushSent} pushFailed=${pushFailed} habitRemindersSent=${habitRemindersSent} habitRemindersSkipped=${habitRemindersSkipped} countdownSent=${countdownSent} countdownSkipped=${countdownSkipped} quickTaskRemindersSent=${quickTaskRemindersSent} quickTaskRemindersSkipped=${quickTaskRemindersSkipped}`
  );

  return NextResponse.json({
    checked: oneOffCandidates.length + recurringCandidates.length,
    due: due.length,
    notified,
    stillPending,
    quietSkipped,
    pushAttempted,
    pushSent,
    pushFailed,
    habitRemindersSent,
    habitRemindersSkipped,
    countdownSent,
    countdownSkipped,
    quickTaskRemindersSent,
    quickTaskRemindersSkipped,
  });
}
