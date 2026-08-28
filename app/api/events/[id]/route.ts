import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { findConflicts } from "@/lib/conflicts";

const recurrenceSchema = z.enum(["NONE", "DAILY", "WEEKLY", "MONTHLY"]);

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(60 * 24 * 7).optional().nullable(),
  recurrence: recurrenceSchema.optional(),
  recurrenceEndAt: z.string().datetime().optional().nullable(),
});

// Los eventos recurrentes se expanden en ocurrencias virtuales con id
// `${eventoBase}::${fechaISO}` en el listado. Editar/borrar afecta a toda la
// serie, así que siempre resolvemos al id del evento base real.
function baseEventId(id: string): string {
  return id.split("::")[0];
}

async function getOwnedEvent(id: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id: baseEventId(id) } });
  if (!event || event.userId !== userId) return null;
  return event;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const event = await getOwnedEvent(id, session.user.id);
  if (!event) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  return NextResponse.json({ event });
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
  const existing = await getOwnedEvent(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const nextStart = data.startAt ? new Date(data.startAt) : existing.startAt;
  const nextEnd = data.endAt ? new Date(data.endAt) : existing.endAt;
  if (nextEnd < nextStart) {
    return NextResponse.json(
      { error: "La fecha de fin no puede ser anterior a la de inicio" },
      { status: 400 }
    );
  }

  const conflicts =
    data.startAt || data.endAt
      ? await findConflicts(session.user.id, nextStart, nextEnd, existing.id)
      : [];

  const event = await prisma.event.update({
    where: { id: existing.id },
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      startAt: data.startAt ? nextStart : undefined,
      endAt: data.endAt ? nextEnd : undefined,
      allDay: data.allDay,
      color: data.color,
      reminderMinutesBefore: data.reminderMinutesBefore,
      recurrence: data.recurrence,
      recurrenceEndAt: data.recurrenceEndAt ? new Date(data.recurrenceEndAt) : undefined,
      // Reprogramar recordatorio si cambió el horario, el recordatorio o la recurrencia
      notifiedAt:
        data.startAt || data.reminderMinutesBefore !== undefined ? null : undefined,
      lastNotifiedOccurrenceAt:
        data.startAt || data.reminderMinutesBefore !== undefined || data.recurrence
          ? null
          : undefined,
    },
  });

  return NextResponse.json({ event, conflicts });
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
  const existing = await getOwnedEvent(id, session.user.id);
  if (!existing) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  await prisma.event.delete({ where: { id: existing.id } });

  return NextResponse.json({ ok: true });
}
