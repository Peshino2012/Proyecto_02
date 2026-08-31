import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

/**
 * `upsert` sobre el pool de @prisma/adapter-pg puede pisarse cuando corre en
 * paralelo con otra query en la misma conexión compartida (protocolo
 * desincronizado: "bind message supplies N parameters, but prepared
 * statement requires 0"). Es intermitente y desaparece al reintentar una
 * vez, así que envolvemos los upsert con esto en vez de serializar todo el
 * acceso a la base.
 */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}
