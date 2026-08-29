import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const updateAccountSchema = z.object({
  name: z.string().max(100).optional(),
  quietHoursStart: z.number().int().min(0).max(23).nullable().optional(),
  quietHoursEnd: z.number().int().min(0).max(23).nullable().optional(),
  defaultReminderMinutes: z.number().int().min(0).max(60 * 24 * 7).nullable().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      email: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      defaultReminderMinutes: true,
    },
  });

  return NextResponse.json({ account: user });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateAccountSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const data = parsed.data;

  const user = await prisma.user.update({
    where: { id: session.user.id },
    data: {
      name: data.name,
      quietHoursStart: data.quietHoursStart,
      quietHoursEnd: data.quietHoursEnd,
      defaultReminderMinutes: data.defaultReminderMinutes,
    },
    select: {
      name: true,
      email: true,
      quietHoursStart: true,
      quietHoursEnd: true,
      defaultReminderMinutes: true,
    },
  });

  return NextResponse.json({ account: user });
}
