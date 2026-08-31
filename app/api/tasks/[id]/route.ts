import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { statForColor } from "@/lib/taskStats";

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  color: z.string().optional(),
  xpReward: z.number().int().min(5).max(100).optional(),
  repeatDaily: z.boolean().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional()
    .nullable(),
  archived: z.boolean().optional(),
});

async function getOwnedTask(id: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== userId) return null;
  return task;
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
  const existing = await getOwnedTask(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  let stat = undefined;
  if (data.color) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { taskShareEventCategories: true },
    });
    stat = statForColor(data.color, user?.taskShareEventCategories ?? true);
  }

  const task = await prisma.task.update({
    where: { id },
    data: {
      title: data.title,
      color: data.color,
      stat,
      xpReward: data.xpReward,
      repeatDaily: data.repeatDaily,
      dueDate: data.repeatDaily === true ? null : data.dueDate,
      archivedAt: data.archived === true ? new Date() : data.archived === false ? null : undefined,
    },
  });

  return NextResponse.json({ task });
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
  const existing = await getOwnedTask(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.task.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
