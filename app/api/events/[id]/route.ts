import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateEventSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).optional().nullable(),
  location: z.string().max(200).optional().nullable(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
  allDay: z.boolean().optional(),
  color: z.string().optional(),
  reminderMinutesBefore: z.number().int().min(0).max(60 * 24 * 7).optional().nullable(),
});

async function getOwnedEvent(id: string, userId: string) {
  const event = await prisma.event.findUnique({ where: { id } });
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

  const event = await prisma.event.update({
    where: { id },
    data: {
      title: data.title,
      description: data.description,
      location: data.location,
      startAt: data.startAt ? nextStart : undefined,
      endAt: data.endAt ? nextEnd : undefined,
      allDay: data.allDay,
      color: data.color,
      reminderMinutesBefore: data.reminderMinutesBefore,
      // Reprogramar recordatorio si cambió el horario o el minuto de aviso
      notifiedAt:
        data.startAt || data.reminderMinutesBefore !== undefined ? null : undefined,
    },
  });

  return NextResponse.json({ event });
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

  await prisma.event.delete({ where: { id } });

  return NextResponse.json({ ok: true });
}
