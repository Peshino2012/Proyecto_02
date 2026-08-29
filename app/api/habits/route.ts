import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { computeStreak, isCompletedToday } from "@/lib/habits";

const createHabitSchema = z.object({
  title: z.string().min(1).max(200),
  color: z.string().optional(),
  recurrence: z.enum(["DAILY", "WEEKLY"]).optional(),
  reminderHour: z.number().int().min(0).max(23).nullable().optional(),
  reminderMinute: z.number().int().min(0).max(59).nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const habits = await prisma.habit.findMany({
    where: { userId: session.user.id, archivedAt: null },
    include: { logs: { orderBy: { date: "desc" }, take: 400 } },
    orderBy: { createdAt: "asc" },
  });

  const withStreak = habits.map((h) => {
    const logDates = h.logs.map((l) => l.date);
    return {
      id: h.id,
      title: h.title,
      color: h.color,
      recurrence: h.recurrence,
      reminderHour: h.reminderHour,
      reminderMinute: h.reminderMinute,
      streak: computeStreak(h.recurrence as "DAILY" | "WEEKLY", logDates),
      completedToday: isCompletedToday(logDates),
    };
  });

  return NextResponse.json({ habits: withStreak });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createHabitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const habit = await prisma.habit.create({
    data: {
      userId: session.user.id,
      title: data.title,
      color: data.color ?? undefined,
      recurrence: data.recurrence ?? undefined,
      reminderHour: data.reminderHour,
      reminderMinute: data.reminderMinute,
    },
  });

  return NextResponse.json({ habit }, { status: 201 });
}
