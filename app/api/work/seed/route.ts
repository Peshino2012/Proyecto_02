import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkItem, SUGGESTED_MODULES } from "@/lib/work";

// Crea los módulos sugeridos con sus primeros ítems. Solo si el usuario
// todavía no tiene ningún módulo (para no duplicar si se toca dos veces).
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const userId = session.user.id;

  const existing = await prisma.workModule.count({ where: { userId } });
  if (existing > 0) {
    return NextResponse.json({ error: "Ya tenés módulos creados" }, { status: 409 });
  }

  for (const [order, suggestion] of SUGGESTED_MODULES.entries()) {
    const mod = await prisma.workModule.create({
      data: {
        userId,
        name: suggestion.name,
        description: suggestion.description,
        icon: suggestion.icon,
        color: suggestion.color,
        order,
      },
    });
    for (const item of suggestion.items) {
      await createWorkItem(userId, mod.id, item, "CLAUDE");
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
