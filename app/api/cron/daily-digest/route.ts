import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { argDateTime, argTodayDateString, dateStringAddDays } from "@/lib/timezone";
import { verseOfTheDay } from "@/lib/verses";
import { occurrencesInRange } from "@/lib/recurrence";
import { applyXpDelta, type TaskStat } from "@/lib/taskStats";

const STAT_FIELD: Partial<Record<TaskStat, "intelecto" | "disciplina" | "espiritu" | "vitalidad" | "fuerza">> = {
  INTELECTO: "intelecto",
  DISCIPLINA: "disciplina",
  ESPIRITU: "espiritu",
  VITALIDAD: "vitalidad",
  FUERZA: "fuerza",
};

// Días consecutivos con quests diarias incompletas antes de entrar en "zona
// de penalización" (estilo Solo Leveling).
const PENALTY_ZONE_THRESHOLD = 3;
// XP perdida por cada quest diaria no completada el día anterior.
const XP_PENALTY_PER_MISSED_QUEST = 12;

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
    const rawEvents = await prisma.event.findMany({
      where: {
        userId: user.id,
        OR: [
          { recurrence: "NONE", startAt: { lt: dayEnd }, endAt: { gt: dayStart } },
          {
            recurrence: { not: "NONE" },
            startAt: { lt: dayEnd },
            OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: dayStart } }],
          },
        ],
      },
      orderBy: { startAt: "asc" },
    });

    const todaysOccurrences = rawEvents.flatMap((ev) => {
      const starts =
        ev.recurrence === "NONE" ? [ev.startAt] : occurrencesInRange(ev, dayStart, dayEnd);
      return starts.map((startAt) => ({ title: ev.title, startAt }));
    });
    todaysOccurrences.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    const body =
      todaysOccurrences.length === 0
        ? `Sin eventos agendados hoy. "${verse.text}" (${verse.ref})`
        : `${todaysOccurrences
            .map((ev) => `${formatHour(ev.startAt)} ${ev.title}`)
            .join(" · ")}\n"${verse.text}" (${verse.ref})`;

    const result = await sendPushToUser(user.id, {
      title:
        todaysOccurrences.length === 0
          ? "Hoy no tenés nada agendado"
          : `Tu día: ${todaysOccurrences.length} evento(s)`,
      body,
      url: "/calendar",
    }).catch((err) => {
      console.error("[daily-digest] sendPushToUser lanzó una excepción", err);
      return null;
    });

    if (result && result.sent > 0) digestsSent += 1;
  }

  console.log(`[daily-digest] users=${users.length} digestsSent=${digestsSent}`);

  // --- Penalidad de quests diarias: se evalúa una vez al día (el digest ya
  // corre una sola vez, a las 08:00 ART) el día anterior completo. Si había
  // quests diarias y alguna no se marcó, se pierde XP real y, tras varios
  // días seguidos, entra en "zona de penalización" hasta ponerse al día.
  const yesterday = dateStringAddDays(today, -1);
  const todayStart = dayStart;

  const usersWithDailyQuests = await prisma.user.findMany({
    where: { tasks: { some: { repeatDaily: true, archivedAt: null } } },
    select: { id: true },
  });

  let penaltiesApplied = 0;
  let cleanDays = 0;

  for (const u of usersWithDailyQuests) {
    const progress = await withDbRetry(() =>
      prisma.userProgress.upsert({
        where: { userId: u.id },
        create: { userId: u.id },
        update: {},
      })
    );

    if (progress.lastPenaltyCheckedDate === today) continue;

    const dailyQuests = await prisma.task.findMany({
      where: {
        userId: u.id,
        repeatDaily: true,
        archivedAt: null,
        createdAt: { lt: todayStart },
      },
      include: { logs: { where: { date: yesterday } } },
    });

    if (dailyQuests.length === 0) {
      await prisma.userProgress.update({
        where: { userId: u.id },
        data: { lastPenaltyCheckedDate: today },
      });
      continue;
    }

    const missed = dailyQuests.filter((t) => t.logs.length === 0);

    if (missed.length === 0) {
      cleanDays += 1;
      await prisma.userProgress.update({
        where: { userId: u.id },
        data: { penaltyStrikes: 0, inPenaltyZone: false, lastPenaltyCheckedDate: today },
      });
      continue;
    }

    const xpDelta = -missed.length * XP_PENALTY_PER_MISSED_QUEST;
    const nextXp = applyXpDelta(progress, xpDelta);
    const nextStrikes = progress.penaltyStrikes + 1;
    const nextInPenaltyZone = nextStrikes >= PENALTY_ZONE_THRESHOLD;

    const statHits: Partial<Record<"intelecto" | "disciplina" | "espiritu" | "vitalidad" | "fuerza", number>> = {};
    for (const t of missed) {
      const field = STAT_FIELD[t.stat as TaskStat];
      if (!field) continue;
      statHits[field] = Math.max(0, (statHits[field] ?? progress[field]) - 1);
    }

    await prisma.userProgress.update({
      where: { userId: u.id },
      data: {
        level: nextXp.level,
        xp: nextXp.xp,
        totalXp: nextXp.totalXp,
        penaltyStrikes: nextStrikes,
        inPenaltyZone: nextInPenaltyZone,
        lastPenaltyCheckedDate: today,
        ...statHits,
      },
    });

    penaltiesApplied += 1;

    const questWord = missed.length === 1 ? "quest" : "quests";
    const zoneMsg = nextInPenaltyZone
      ? " Entraste en zona de penalización: completá tus quests de hoy sin fallar para salir."
      : "";
    await sendPushToUser(u.id, {
      title: "Penalización",
      body: `Ayer no completaste ${missed.length} ${questWord} diaria(s): -${
        missed.length * XP_PENALTY_PER_MISSED_QUEST
      } XP.${zoneMsg}`,
      url: "/tasks",
    }).catch((err) => {
      console.error("[daily-digest] sendPushToUser (penalidad) lanzó una excepción", err);
      return null;
    });
  }

  console.log(
    `[daily-digest] penaltyUsers=${usersWithDailyQuests.length} penaltiesApplied=${penaltiesApplied} cleanDays=${cleanDays}`
  );

  return NextResponse.json({
    users: users.length,
    digestsSent,
    penaltyUsers: usersWithDailyQuests.length,
    penaltiesApplied,
    cleanDays,
  });
}
