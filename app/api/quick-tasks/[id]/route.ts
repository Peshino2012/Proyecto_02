import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateQuickTaskSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  done: z.boolean().optional(),
  reminderHour: z.number().int().min(0).max(23).nullable().optional(),
  reminderMinute: z.number().int().min(0).max(59).nullable().optional(),
});

async function getOwnedQuickTask(id: string, userId: string) {
  const quickTask = await prisma.quickTask.findUnique({ where: { id } });
  if (!quickTask || quickTask.userId !== userId) return null;
  return quickTask;
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
  const existing = await getOwnedQuickTask(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateQuickTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const quickTask = await prisma.quickTask.update({
    where: { id },
    data: {
      ...parsed.data,
      // Si se toca el horario del recordatorio, permitir que vuelva a
      // dispararse hoy en vez de quedar bloqueado por un envío previo.
      lastReminderSentDate:
        parsed.data.reminderHour !== undefined || parsed.data.reminderMinute !== undefined
          ? null
          : undefined,
    },
  });

  return NextResponse.json({ quickTask });
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
  const existing = await getOwnedQuickTask(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.quickTask.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
