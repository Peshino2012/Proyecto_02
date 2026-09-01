import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateHabitSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  color: z.string().optional(),
  categoryColors: z.array(z.string()).min(1).max(6).optional(),
  recurrence: z.enum(["DAILY", "WEEKLY"]).optional(),
  reminderHour: z.number().int().min(0).max(23).nullable().optional(),
  reminderMinute: z.number().int().min(0).max(59).nullable().optional(),
  archived: z.boolean().optional(),
});

async function getOwnedHabit(id: string, userId: string) {
  const habit = await prisma.habit.findUnique({ where: { id } });
  if (!habit || habit.userId !== userId) return null;
  return habit;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedHabit(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateHabitSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const nextCategoryColors =
    data.categoryColors && data.categoryColors.length > 0
      ? data.categoryColors
      : data.color
        ? [data.color]
        : undefined;

  const habit = await prisma.habit.update({
    where: { id },
    data: {
      title: data.title,
      color: nextCategoryColors ? nextCategoryColors[0] : undefined,
      categoryColors: nextCategoryColors,
      recurrence: data.recurrence,
      reminderHour: data.reminderHour,
      reminderMinute: data.reminderMinute,
      lastReminderSentDate:
        data.reminderHour !== undefined || data.reminderMinute !== undefined ? null : undefined,
      archivedAt: data.archived === true ? new Date() : data.archived === false ? null : undefined,
    },
  });

  return NextResponse.json({ habit });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getOwnedHabit(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.habit.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
