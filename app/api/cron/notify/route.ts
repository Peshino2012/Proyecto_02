import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { sendReminderEmail } from "@/lib/mail";
import { nextOccurrenceAfter } from "@/lib/recurrence";

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
      });
    }
  }

  const due = [...dueOneOff, ...dueRecurring];

  let pushAttempted = 0;
  let pushSent = 0;
  let pushFailed = 0;
  let notified = 0;
  let stillPending = 0;

  for (const item of due) {
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

  console.log(
    `[cron] checked=${oneOffCandidates.length + recurringCandidates.length} due=${due.length} notified=${notified} stillPending=${stillPending} pushAttempted=${pushAttempted} pushSent=${pushSent} pushFailed=${pushFailed}`
  );

  return NextResponse.json({
    checked: oneOffCandidates.length + recurringCandidates.length,
    due: due.length,
    notified,
    stillPending,
    pushAttempted,
    pushSent,
    pushFailed,
  });
}
