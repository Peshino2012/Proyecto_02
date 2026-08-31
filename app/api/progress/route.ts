import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma, withDbRetry } from "@/lib/prisma";
import { xpForLevel } from "@/lib/taskStats";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const userId = session.user.id;
  const progress = await withDbRetry(() =>
    prisma.userProgress.upsert({
      where: { userId },
      create: { userId },
      update: {},
    })
  );

  return NextResponse.json({
    progress: { ...progress, xpToNext: xpForLevel(progress.level) },
  });
}
