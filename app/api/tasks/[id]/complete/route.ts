import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { argTodayDateString } from "@/lib/timezone";
import { applyXpDelta, rankForLevel, xpForLevel, type TaskStat } from "@/lib/taskStats";
import { sendPushToUser } from "@/lib/push";
import { verseForLevel } from "@/lib/verses";

const STAT_FIELD: Partial<Record<TaskStat, "intelecto" | "disciplina" | "espiritu" | "vitalidad" | "fuerza">> = {
  INTELECTO: "intelecto",
  DISCIPLINA: "disciplina",
  ESPIRITU: "espiritu",
  VITALIDAD: "vitalidad",
  FUERZA: "fuerza",
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const today = argTodayDateString();
  // Las quests diarias se marcan por día; las puntuales tienen un único log
  // (la fecha en que se completaron), sin importar qué día sea hoy.
  const existingLog = task.repeatDaily
    ? await prisma.taskLog.findUnique({ where: { taskId_date: { taskId: id, date: today } } })
    : await prisma.taskLog.findFirst({ where: { taskId: id } });

  const userId = session.user.id;
  const progress = await withDbRetry(() =>
    prisma.userProgress.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
  );

  const statField = STAT_FIELD[task.stat as TaskStat];
  let done: boolean;
  let xpDelta: number;

  if (existingLog) {
    // Desmarcar: revierte exactamente la XP que se había otorgado en ese log.
    await prisma.taskLog.delete({ where: { id: existingLog.id } });
    xpDelta = -existingLog.xpAwarded;
    done = false;
  } else {
    await prisma.taskLog.create({
      data: { taskId: id, date: today, xpAwarded: task.xpReward },
    });
    xpDelta = task.xpReward;
    done = true;
  }

  const next = applyXpDelta(progress, xpDelta);
  const leveledUp = next.level > progress.level;
  const leveledDown = next.level < progress.level;

  const statUpdate = statField
    ? { [statField]: Math.max(0, progress[statField] + (done ? 1 : -1)) }
    : {};

  const updated = await prisma.userProgress.update({
    where: { userId: session.user.id },
    data: {
      level: next.level,
      xp: next.xp,
      totalXp: next.totalXp,
      ...statUpdate,
    },
  });

  if (leveledUp) {
    const verse = verseForLevel(updated.level);
    const rank = rankForLevel(updated.level);
    sendPushToUser(userId, {
      title: `¡Subiste a nivel ${updated.level}! · Rango ${rank}`,
      body: `"${verse.text}" (${verse.ref})`,
      url: "/tasks",
    }).catch((err) => {
      console.error("[tasks/complete] sendPushToUser (level up) lanzó una excepción", err);
    });
  }

  return NextResponse.json({
    done,
    progress: { ...updated, xpToNext: xpForLevel(updated.level) },
    leveledUp,
    leveledDown,
  });
}
