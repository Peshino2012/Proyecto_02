import { prisma } from "@/lib/prisma";

export async function findConflicts(
  userId: string,
  startAt: Date,
  endAt: Date,
  excludeEventId?: string
) {
  return prisma.event.findMany({
    where: {
      userId,
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    orderBy: { startAt: "asc" },
    select: { id: true, title: true, startAt: true, endAt: true },
  });
}
