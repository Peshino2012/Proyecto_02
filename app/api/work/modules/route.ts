import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { workCounts } from "@/lib/work";

const createModuleSchema = z.object({
  name: z.string().min(1).max(60),
  description: z.string().max(300).optional().nullable(),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const [modules, counts] = await Promise.all([
    prisma.workModule.findMany({
      where: { userId: session.user.id, archivedAt: null },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
    }),
    workCounts(session.user.id),
  ]);

  return NextResponse.json({
    modules: modules.map((m) => ({
      id: m.id,
      name: m.name,
      description: m.description,
      icon: m.icon,
      color: m.color,
      counts: counts.byModule[m.id] ?? null,
    })),
    general: counts.byModule[""] ?? null,
    total: counts.total,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createModuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const count = await prisma.workModule.count({ where: { userId: session.user.id } });
  const mod = await prisma.workModule.create({
    data: {
      userId: session.user.id,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      icon: parsed.data.icon,
      color: parsed.data.color,
      order: count,
    },
  });

  return NextResponse.json({ module: mod }, { status: 201 });
}
