import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { argTodayDateString } from "@/lib/timezone";
import { computeStreak } from "@/lib/habits";

const bodySchema = z.object({
  // YYYY-MM-DD; si no se manda, es "hoy". Permite tildar días pasados desde
  // la planilla de hábitos.
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit || habit.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const today = argTodayDateString();
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  const date = parsed.success && parsed.data.date ? parsed.data.date : today;

  if (date > today) {
    return NextResponse.json({ error: "No se puede marcar un día futuro" }, { status: 400 });
  }

  const existingLog = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId: id, date } },
  });

  if (existingLog) {
    await prisma.habitLog.delete({ where: { id: existingLog.id } });
  } else {
    await prisma.habitLog.create({ data: { habitId: id, date } });
  }

  const logs = await prisma.habitLog.findMany({
    where: { habitId: id },
    orderBy: { date: "desc" },
    take: 400,
  });
  const logDates = logs.map((l) => l.date);

  return NextResponse.json({
    date,
    checked: logDates.includes(date),
    completedToday: logDates.includes(today),
    streak: computeStreak(habit.recurrence as "DAILY" | "WEEKLY", logDates),
    logDates,
  });
}
