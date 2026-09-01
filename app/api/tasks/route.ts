import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { argTodayDateString } from "@/lib/timezone";
import { statsForColors } from "@/lib/taskStats";

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  color: z.string().optional(),
  categoryColors: z.array(z.string()).min(1).max(6).optional(),
  xpReward: z.number().int().min(5).max(100).optional(),
  target: z.number().int().min(1).max(100000).optional().nullable(),
  targetUnit: z.string().max(30).optional().nullable(),
  repeatDaily: z.boolean().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
}).refine((d) => !!d.color || (d.categoryColors && d.categoryColors.length > 0), {
  message: "Elegí al menos una categoría",
  path: ["categoryColors"],
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const today = argTodayDateString();

  // Ver lib/prisma.ts (withDbRetry): esta query puede chocar con un upsert
  // concurrente de /api/progress en la misma conexión del pool.
  const tasks = await withDbRetry(() =>
    prisma.task.findMany({
      where: { userId: session.user.id, archivedAt: null },
      include: { logs: { orderBy: { date: "desc" }, take: 60 } },
      orderBy: { createdAt: "asc" },
    })
  );

  const withStatus = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    color: t.color,
    categoryColors: t.categoryColors,
    stats: t.stats,
    xpReward: t.xpReward,
    target: t.target,
    targetUnit: t.targetUnit,
    repeatDaily: t.repeatDaily,
    dueDate: t.dueDate,
    done: t.repeatDaily ? t.logs.some((l) => l.date === today) : t.logs.length > 0,
  }));

  return NextResponse.json({ tasks: withStatus });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { taskShareEventCategories: true },
  });

  const categoryColors =
    data.categoryColors && data.categoryColors.length > 0
      ? data.categoryColors
      : [data.color!];
  const shareCategories = user?.taskShareEventCategories ?? true;

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: data.title,
      color: categoryColors[0],
      categoryColors,
      stats: statsForColors(categoryColors, shareCategories),
      xpReward: data.xpReward ?? 15,
      target: data.target ?? null,
      targetUnit: data.target ? (data.targetUnit ?? null) : null,
      repeatDaily: data.repeatDaily ?? false,
      dueDate: data.repeatDaily ? null : (data.dueDate ?? null),
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
