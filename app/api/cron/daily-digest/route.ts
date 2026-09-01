import { NextRequest, NextResponse } from "next/server";
import { prisma, withDbRetry } from "@/lib/prisma";
import { sendPushToUser } from "@/lib/push";
import { argDateTime, argTodayDateString, dateStringAddDays } from "@/lib/timezone";
import { verseOfTheDay, verseForLevel } from "@/lib/verses";
import { occurrencesInRange } from "@/lib/recurrence";
import { applyXpDelta, rankForLevel, type TaskStat } from "@/lib/taskStats";

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

  // --- Quests: se banca una sola vez al día (el digest ya corre una sola
  // vez, a las 08:00 ART) todo lo del día anterior completo. La XP ganada
  // completando quests NO sube de nivel al toque — se acumula durante el día
  // (ver /api/tasks/[id]/complete y /api/progress, que solo devuelven la XP
  // de hoy) y recién acá se banca de una junto con la posible penalidad, así
  // el nivel/rango no "flapea" para arriba y para abajo en el mismo día.
  const yesterday = dateStringAddDays(today, -1);
  const todayStart = dayStart;

  const usersWithTasks = await prisma.user.findMany({
    where: { tasks: { some: {} } },
    select: { id: true },
  });

  let xpBankedUsers = 0;
  let levelUps = 0;
  let penaltiesApplied = 0;
  let cleanDays = 0;

  for (const u of usersWithTasks) {
    const progress = await withDbRetry(() =>
      prisma.userProgress.upsert({
        where: { userId: u.id },
        create: { userId: u.id },
        update: {},
      })
    );

    if (progress.lastPenaltyCheckedDate === today) continue;

    const yesterdayTasks = await prisma.task.findMany({
      where: { userId: u.id, createdAt: { lt: todayStart } },
      include: { logs: { where: { date: yesterday } } },
    });

    const earned = yesterdayTasks.filter((t) => t.logs.length > 0);
    const dailyTasks = yesterdayTasks.filter((t) => t.repeatDaily && t.archivedAt === null);
    const missed = dailyTasks.filter((t) => t.logs.length === 0);

    if (earned.length === 0 && dailyTasks.length === 0) {
      // Nada que bancar y ninguna quest diaria activa: no toca nada, solo
      // marca el día como evaluado.
      await prisma.userProgress.update({
        where: { userId: u.id },
        data: { lastPenaltyCheckedDate: today },
      });
      continue;
    }

    type StatField = "intelecto" | "disciplina" | "espiritu" | "vitalidad" | "fuerza";
    const statHits: Partial<Record<StatField, number>> = {};
    let xpDelta = 0;

    for (const t of earned) {
      xpDelta += t.logs[0].xpAwarded;
      // Con varias categorías, el +1 diario se reparte en partes iguales
      // entre los stats de todas (ej. 2 categorías = +0.5 c/u).
      const stats = (t.stats as TaskStat[]).length > 0 ? (t.stats as TaskStat[]) : ["OTRO" as TaskStat];
      const share = 1 / stats.length;
      for (const stat of stats) {
        const field = STAT_FIELD[stat];
        if (field) statHits[field] = (statHits[field] ?? progress[field]) + share;
      }
    }
    for (const t of missed) {
      xpDelta -= XP_PENALTY_PER_MISSED_QUEST;
      const stats = (t.stats as TaskStat[]).length > 0 ? (t.stats as TaskStat[]) : ["OTRO" as TaskStat];
      const share = 1 / stats.length;
      for (const stat of stats) {
        const field = STAT_FIELD[stat];
        if (field) statHits[field] = Math.max(0, (statHits[field] ?? progress[field]) - share);
      }
    }

    const nextXp = applyXpDelta(progress, xpDelta);
    const leveledUp = nextXp.level > progress.level;

    const hasDailyStreak = dailyTasks.length > 0;
    const nextStrikes = hasDailyStreak
      ? missed.length === 0
        ? 0
        : progress.penaltyStrikes + 1
      : progress.penaltyStrikes;
    const nextInPenaltyZone = hasDailyStreak && missed.length > 0 && nextStrikes >= PENALTY_ZONE_THRESHOLD;
    const nextCleanStreak = hasDailyStreak
      ? missed.length === 0
        ? progress.cleanStreak + 1
        : 0
      : progress.cleanStreak;

    const updated = await prisma.userProgress.update({
      where: { userId: u.id },
      data: {
        level: nextXp.level,
        xp: nextXp.xp,
        totalXp: nextXp.totalXp,
        penaltyStrikes: nextStrikes,
        inPenaltyZone: nextInPenaltyZone,
        cleanStreak: nextCleanStreak,
        lastPenaltyCheckedDate: today,
        ...statHits,
      },
    });

    xpBankedUsers += 1;
    if (hasDailyStreak && missed.length === 0) cleanDays += 1;

    if (leveledUp) {
      levelUps += 1;
      const verse = verseForLevel(updated.level);
      const rank = rankForLevel(updated.level);
      await sendPushToUser(u.id, {
        title: `¡Subiste a nivel ${updated.level}! · Rango ${rank}`,
        body: `"${verse.text}" (${verse.ref})`,
        url: "/tasks",
      }).catch((err) => {
        console.error("[daily-digest] sendPushToUser (level up) lanzó una excepción", err);
        return null;
      });
    }

    if (missed.length > 0) {
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
  }

  console.log(
    `[daily-digest] usersWithTasks=${usersWithTasks.length} xpBankedUsers=${xpBankedUsers} levelUps=${levelUps} penaltiesApplied=${penaltiesApplied} cleanDays=${cleanDays}`
  );

  return NextResponse.json({
    users: users.length,
    digestsSent,
    usersWithTasks: usersWithTasks.length,
    xpBankedUsers,
    levelUps,
    penaltiesApplied,
    cleanDays,
  });
}
