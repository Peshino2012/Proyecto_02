import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkItem, getOwnedModule, serializeItem, workItemInput } from "@/lib/work";

// Ítems de un módulo: todos los pendientes (con o sin fecha) más lo que cae
// en el rango from-to (para el calendario del mes).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!moduleId || !(await getOwnedModule(moduleId, session.user.id))) {
    return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
  }

  const items = await prisma.workItem.findMany({
    where: {
      moduleId,
      OR: [
        { done: false },
        ...(from && to ? [{ startAt: { gte: new Date(from), lte: new Date(to) } }] : []),
      ],
    },
    orderBy: [{ startAt: { sort: "asc", nulls: "last" } }, { createdAt: "asc" }],
  });

  const now = new Date();
  return NextResponse.json({ items: items.map((i) => serializeItem(i, now)) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const moduleId = typeof body?.moduleId === "string" ? body.moduleId : null;
  if (!moduleId || !(await getOwnedModule(moduleId, session.user.id))) {
    return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
  }

  const parsed = workItemInput.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const item = await createWorkItem(session.user.id, moduleId, parsed.data, "USER");
  return NextResponse.json({ item: serializeItem(item) }, { status: 201 });
}
