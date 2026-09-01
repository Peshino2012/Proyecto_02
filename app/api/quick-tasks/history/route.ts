import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;

// Historial de tareas rápidas agrupado por día, paginado por "cargar más":
// solo aparecen los días que efectivamente tuvieron alguna tarea (el agrupado
// por fecha ya excluye por sí solo los días sin registros).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const before = searchParams.get("before");

  const dateGroups = await prisma.quickTask.groupBy({
    by: ["date"],
    where: {
      userId: session.user.id,
      ...(before ? { date: { lt: before } } : {}),
    },
    orderBy: { date: "desc" },
    take: PAGE_SIZE,
  });

  const dates = dateGroups.map((g) => g.date);
  if (dates.length === 0) {
    return NextResponse.json({ days: [], nextCursor: null });
  }

  const tasks = await prisma.quickTask.findMany({
    where: { userId: session.user.id, date: { in: dates } },
    orderBy: [{ date: "desc" }, { createdAt: "asc" }],
    select: { id: true, title: true, date: true, done: true },
  });

  const days = dates.map((date) => ({
    date,
    tasks: tasks.filter((t) => t.date === date),
  }));

  const nextCursor = dates.length === PAGE_SIZE ? dates[dates.length - 1] : null;

  return NextResponse.json({ days, nextCursor });
}
