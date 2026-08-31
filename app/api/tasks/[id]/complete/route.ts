import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { argTodayDateString } from "@/lib/timezone";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const task = await prisma.task.findUnique({ where: { id } });
  if (!task || task.userId !== session.user.id) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const today = argTodayDateString();
  // Las quests diarias se marcan por día; las puntuales tienen un único log
  // (la fecha en que se completaron), sin importar qué día sea hoy.
  const existingLog = task.repeatDaily
    ? await prisma.taskLog.findUnique({ where: { taskId_date: { taskId: id, date: today } } })
    : await prisma.taskLog.findFirst({ where: { taskId: id } });

  let done: boolean;

  if (existingLog) {
    // Desmarcar antes de que se banque (al otro día): no pasó nada
    // permanente todavía, así que solo se borra el log de hoy.
    await prisma.taskLog.delete({ where: { id: existingLog.id } });
    done = false;
  } else {
    await prisma.taskLog.create({
      data: { taskId: id, date: today, xpAwarded: task.xpReward },
    });
    done = true;
  }

  // La XP de hoy es solo informativa: el nivel/rango/stats NO cambian acá.
  // Se acumulan durante el día y se bancan una sola vez, al otro día, en el
  // cron de daily-digest — así el nivel no sube y baja repetidas veces en
  // el mismo día por tildar y destildar quests.
  const todayAgg = await prisma.taskLog.aggregate({
    where: { date: today, task: { userId: session.user.id } },
    _sum: { xpAwarded: true },
  });

  return NextResponse.json({ done, todayXp: todayAgg._sum.xpAwarded ?? 0 });
}
