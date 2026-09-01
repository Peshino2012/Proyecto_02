import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const createQuickTaskSchema = z.object({
  title: z.string().min(1).max(200),
  date: dateSchema,
  reminderHour: z.number().int().min(0).max(23).nullable().optional(),
  reminderMinute: z.number().int().min(0).max(59).nullable().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const quickTasks = await prisma.quickTask.findMany({
    where: {
      userId: session.user.id,
      ...(from && to ? { date: { gte: from, lte: to } } : {}),
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json({ quickTasks });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createQuickTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const quickTask = await prisma.quickTask.create({
    data: {
      userId: session.user.id,
      title: parsed.data.title,
      date: parsed.data.date,
      reminderHour: parsed.data.reminderHour ?? null,
      reminderMinute: parsed.data.reminderMinute ?? null,
    },
  });

  return NextResponse.json({ quickTask }, { status: 201 });
}
