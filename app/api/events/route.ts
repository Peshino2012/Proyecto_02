import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findConflicts } from "@/lib/conflicts";
import { occurrencesInRange } from "@/lib/recurrence";

const recurrenceSchema = z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]);

const createEventSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(60 * 24 * 7).optional().nullable(),
  recurrence: recurrenceSchema.optional(),
  recurrenceEndAt: z.string().datetime().optional().nullable(),
  // Cuenta regresiva: aviso diario desde `countdownDays` días antes del
  // evento hasta el día del evento inclusive, a una hora fija.
  countdownDays: z.number().int().min(1).max(60).optional().nullable(),
  countdownHour: z.number().int().min(0).max(23).optional().nullable(),
  countdownMinute: z.number().int().min(0).max(59).optional().nullable(),
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
            OR: [
              { recurrence: "NONE", startAt: { lte: new Date(to) }, endAt: { gte: new Date(from) } },
              {
                recurrence: { not: "NONE" },
                startAt: { lte: new Date(to) },
                OR: [{ recurrenceEndAt: null }, { recurrenceEndAt: { gte: new Date(from) } }],
              },
            ],
          }
        : {}),
    },
    orderBy: { startAt: "asc" },
  });

  if (!from || !to) {
    return NextResponse.json({ events });
  }

  const rangeStart = new Date(from);
  const rangeEnd = new Date(to);
  const expanded = events.flatMap((ev) => {
    if (ev.recurrence === "NONE") return [ev];

    const durationMs = ev.endAt.getTime() - ev.startAt.getTime();
    const occurrences = occurrencesInRange(ev, rangeStart, rangeEnd);

    return occurrences.map((occStart) => ({
      ...ev,
      id: `${ev.id}::${occStart.toISOString()}`,
      seriesId: ev.id,
      startAt: occStart,
      endAt: new Date(occStart.getTime() + durationMs),
    }));
  });

  expanded.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

  return NextResponse.json({ events: expanded });
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
      recurrence: data.recurrence ?? undefined,
      recurrenceEndAt: data.recurrenceEndAt ? new Date(data.recurrenceEndAt) : undefined,
      countdownDays: data.countdownDays ?? undefined,
      countdownHour: data.countdownDays ? (data.countdownHour ?? 9) : undefined,
      countdownMinute: data.countdownDays ? (data.countdownMinute ?? 0) : undefined,
    },
  });

  return NextResponse.json({ event, conflicts }, { status: 201 });
}
