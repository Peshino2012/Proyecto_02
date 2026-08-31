import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { argTodayDateString } from "@/lib/timezone";
import { statForColor } from "@/lib/taskStats";

const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  color: z.string(),
  xpReward: z.number().int().min(5).max(100).optional(),
  repeatDaily: z.boolean().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
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
    stat: t.stat,
    xpReward: t.xpReward,
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

  const task = await prisma.task.create({
    data: {
      userId: session.user.id,
      title: data.title,
      color: data.color,
      stat: statForColor(data.color, user?.taskShareEventCategories ?? true),
      xpReward: data.xpReward ?? 15,
      repeatDaily: data.repeatDaily ?? false,
      dueDate: data.repeatDaily ? null : (data.dueDate ?? null),
    },
  });

  return NextResponse.json({ task }, { status: 201 });
}
