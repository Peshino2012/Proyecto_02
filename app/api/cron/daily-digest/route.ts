import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { argDateTime, argTodayDateString } from "@/lib/timezone";
import { verseOfTheDay } from "@/lib/verses";

function formatHour(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = argTodayDateString();
  const dayStart = argDateTime(today, 0);
  const dayEnd = argDateTime(today, 24);

  const users = await prisma.user.findMany({
    where: { pushSubscriptions: { some: {} } },
    select: { id: true },
  });

  const verse = verseOfTheDay();
  let digestsSent = 0;

  for (const user of users) {
    const events = await prisma.event.findMany({
      where: {
        userId: user.id,
        startAt: { lt: dayEnd },
        endAt: { gt: dayStart },
      },
      orderBy: { startAt: "asc" },
    });

    const body =
      events.length === 0
        ? `Sin eventos agendados hoy. "${verse.text}" (${verse.ref})`
        : `${events
            .map((ev) => `${formatHour(ev.startAt)} ${ev.title}`)
            .join(" · ")}\n"${verse.text}" (${verse.ref})`;

    const result = await sendPushToUser(user.id, {
      title: events.length === 0 ? "Hoy no tenés nada agendado" : `Tu día: ${events.length} evento(s)`,
      body,
      url: "/calendar",
    }).catch((err) => {
      console.error("[daily-digest] sendPushToUser lanzó una excepción", err);
      return null;
    });

    if (result && result.sent > 0) digestsSent += 1;
  }

  console.log(`[daily-digest] users=${users.length} digestsSent=${digestsSent}`);

  return NextResponse.json({ users: users.length, digestsSent });
}
