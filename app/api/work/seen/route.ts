import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Marca como vistos los ítems nuevos (cargados por Claude) de un módulo.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const moduleId = typeof body?.moduleId === "string" ? body.moduleId : null;
  if (!moduleId) {
    return NextResponse.json({ error: "Falta el módulo" }, { status: 400 });
  }

  const { count } = await prisma.workItem.updateMany({
    where: { userId: session.user.id, moduleId, seenAt: null },
    data: { seenAt: new Date() },
  });
  return NextResponse.json({ ok: true, count });
}
