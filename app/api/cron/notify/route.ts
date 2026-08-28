import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { sendReminderEmail } from "@/lib/mail";

// Ventana máxima de recordatorio permitida al crear un evento (7 días).
const MAX_REMINDER_MS = 60 * 24 * 7 * 60 * 1000;

function formatEventTime(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const now = new Date();

  const candidates = await prisma.event.findMany({
    where: {
      notifiedAt: null,
      reminderMinutesBefore: { not: null },
      startAt: { gte: new Date(now.getTime() - 5 * 60 * 1000), lte: new Date(now.getTime() + MAX_REMINDER_MS) },
    },
    include: { user: true },
  });

  const due = candidates.filter((ev) => {
    const reminderAt = new Date(
      ev.startAt.getTime() - (ev.reminderMinutesBefore ?? 0) * 60 * 1000
    );
    return reminderAt <= now;
  });

  let pushAttempted = 0;
  let pushSent = 0;
  let pushFailed = 0;

  for (const ev of due) {
    const title = `Recordatorio: ${ev.title}`;
    const body = `${formatEventTime(ev.startAt)}${ev.location ? ` · ${ev.location}` : ""}`;

    const [pushOutcome] = await Promise.allSettled([
      sendPushToUser(ev.userId, { title, body, url: "/calendar" }),
      sendReminderEmail(
        ev.user.email,
        title,
        `<p><strong>${ev.title}</strong></p><p>${body}</p>${
          ev.description ? `<p>${ev.description}</p>` : ""
        }`
      ),
    ]);

    if (pushOutcome.status === "fulfilled") {
      pushAttempted += pushOutcome.value.attempted;
      pushSent += pushOutcome.value.sent;
      pushFailed += pushOutcome.value.failed;
    } else {
      console.error("[cron] sendPushToUser lanzó una excepción", pushOutcome.reason);
    }

    await prisma.event.update({
      where: { id: ev.id },
      data: { notifiedAt: now },
    });
  }

  return NextResponse.json({
    checked: candidates.length,
    due: due.length,
    pushAttempted,
    pushSent,
    pushFailed,
  });
}
