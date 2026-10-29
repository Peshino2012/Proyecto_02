import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedModule } from "@/lib/work";

const updateModuleSchema = z.object({
  name: z.string().min(1).max(60).optional(),
  description: z.string().max(300).optional().nullable(),
  icon: z.string().min(1).max(8).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const mod = await getOwnedModule(id, session.user.id);
  if (!mod || mod.archivedAt) {
    return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
  }

  return NextResponse.json({ module: mod });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const mod = await getOwnedModule(id, session.user.id);
  if (!mod) {
    return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateModuleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const updated = await prisma.workModule.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ module: updated });
}

// Borrar un módulo lo archiva (no se pierden sus ítems ni su chat).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const mod = await getOwnedModule(id, session.user.id);
  if (!mod) {
    return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
  }

  await prisma.workModule.update({ where: { id }, data: { archivedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
