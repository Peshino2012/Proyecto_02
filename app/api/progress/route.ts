import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { argTodayDateString } from "@/lib/timezone";
import { xpForLevel } from "@/lib/taskStats";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const progress = await withDbRetry(() =>
    prisma.userProgress.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
  );

  // Informativo: cuánta XP se ganó hoy (todavía sin bancar en level/xp — eso
  // pasa una sola vez al otro día, en el cron de daily-digest).
  const todayAgg = await prisma.taskLog.aggregate({
    where: { date: argTodayDateString(), task: { userId } },
    _sum: { xpAwarded: true },
  });

  return NextResponse.json({
    progress: {
      ...progress,
      xpToNext: xpForLevel(progress.level),
      todayXp: todayAgg._sum.xpAwarded ?? 0,
    },
  });
}
