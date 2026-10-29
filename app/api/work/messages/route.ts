import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOwnedModule, serializeMessage } from "@/lib/work";

const postMessageSchema = z.object({
  moduleId: z.string().optional().nullable(),
  text: z.string().trim().min(1).max(4000),
});

// Chat de un módulo (o el general, sin moduleId). Al abrirlo se marcan como
// leídos los mensajes de Claude y como vistos los ítems nuevos del módulo.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = session.user.id;

  const { searchParams } = new URL(req.url);
  const moduleId = searchParams.get("moduleId") || null;
  if (moduleId && !(await getOwnedModule(moduleId, userId))) {
    return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
  }

  const messages = await prisma.workMessage.findMany({
    where: { userId, moduleId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  if (searchParams.get("markRead") === "1") {
    await prisma.workMessage.updateMany({
      where: { userId, moduleId, author: "CLAUDE", readAt: null },
      data: { readAt: new Date() },
    });
  }

  return NextResponse.json({ messages: messages.reverse().map(serializeMessage) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = session.user.id;

  const body = await req.json().catch(() => null);
  const parsed = postMessageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  const moduleId = parsed.data.moduleId || null;
  if (moduleId && !(await getOwnedModule(moduleId, userId))) {
    return NextResponse.json({ error: "Módulo no encontrado" }, { status: 404 });
  }

  const message = await prisma.workMessage.create({
    data: { userId, moduleId, author: "USER", text: parsed.data.text },
  });

  return NextResponse.json({ message: serializeMessage(message) }, { status: 201 });
}
