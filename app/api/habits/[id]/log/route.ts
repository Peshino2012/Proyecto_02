import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { argTodayDateString } from "@/lib/timezone";
import { computeStreak } from "@/lib/habits";

export async function POST(
  _req: NextRequest,
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

  const existingLog = await prisma.habitLog.findUnique({
    where: { habitId_date: { habitId: id, date: today } },
  });

  if (existingLog) {
    await prisma.habitLog.delete({ where: { id: existingLog.id } });
  } else {
    await prisma.habitLog.create({ data: { habitId: id, date: today } });
  }

  const logs = await prisma.habitLog.findMany({
    where: { habitId: id },
    orderBy: { date: "desc" },
    take: 400,
  });
  const logDates = logs.map((l) => l.date);

  return NextResponse.json({
    completedToday: logDates.includes(today),
    streak: computeStreak(habit.recurrence as "DAILY" | "WEEKLY", logDates),
  });
}
