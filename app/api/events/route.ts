import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findConflicts } from "@/lib/conflicts";

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(60 * 24 * 7).optional().nullable(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const events = await prisma.event.findMany({
    where: {
      userId: session.user.id,
      ...(from && to
        ? {
            startAt: { lte: new Date(to) },
            endAt: { gte: new Date(from) },
          }
        : {}),
    },
    orderBy: { startAt: "asc" },
  });

  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  if (new Date(data.endAt) < new Date(data.startAt)) {
    return NextResponse.json(
      { error: "La fecha de fin no puede ser anterior a la de inicio" },
      { status: 400 }
    );
  }

  const startAt = new Date(data.startAt);
  const endAt = new Date(data.endAt);

  const conflicts = await findConflicts(session.user.id, startAt, endAt);

  const event = await prisma.event.create({
    data: {
      userId: session.user.id,
      title: data.title,
      description: data.description ?? undefined,
      location: data.location ?? undefined,
      startAt,
      endAt,
      allDay: data.allDay ?? false,
      color: data.color ?? undefined,
      reminderMinutesBefore: data.reminderMinutesBefore ?? undefined,
    },
  });

  return NextResponse.json({ event, conflicts }, { status: 201 });
}
