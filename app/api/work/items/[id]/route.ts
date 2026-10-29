import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedItem, serializeItem, updateWorkItem, workItemUpdate } from "@/lib/work";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await getOwnedItem(id, session.user.id))) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = workItemUpdate.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const item = await updateWorkItem(id, parsed.data);
  return NextResponse.json({ item: serializeItem(item) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  if (!(await getOwnedItem(id, session.user.id))) {
    return NextResponse.json({ error: "Ítem no encontrado" }, { status: 404 });
  }

  await prisma.workItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
