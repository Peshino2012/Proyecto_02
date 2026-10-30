import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

const base = new PrismaClient({ adapter });

// Campos que el cron toca solo para llevar la cuenta de qué avisó: cambiarlos
// no cambia ninguna alarma, así que no hace falta avisarle al celular.
const CAMPOS_DE_CONTROL = new Set([
  "notifiedAt",
  "lastNotifiedOccurrenceAt",
  "countdownLastSentDate",
  "lastReminderSentDate",
  "seenAt",
]);

function cambiaAlarmas(operation: string, args: unknown): boolean {
  if (operation !== "update") return true;
  const data = (args as { data?: Record<string, unknown> })?.data ?? {};
  return Object.keys(data).some((campo) => !CAMPOS_DE_CONTROL.has(campo));
}

/**
 * Le avisa a la app de alarmas del celular (por ntfy.sh, en el canal secreto
 * del usuario) que algo cambió, para que vuelva a bajar las alarmas al
 * instante. Si falla no pasa nada: la app igual sincroniza sola cada rato.
 */
export async function avisarCelular(userId: string | undefined | null) {
  if (!userId) return;
  try {
    const user = await base.user.findUnique({ where: { id: userId }, select: { deviceTopic: true } });
    if (!user?.deviceTopic) return;
    await fetch(`https://ntfy.sh/${user.deviceTopic}`, {
      method: "POST",
      body: "sync",
      signal: AbortSignal.timeout(2500),
    });
  } catch (err) {
    console.error("[alarmas] no se pudo avisar al celular", err);
  }
}

const OPERACIONES = new Set(["create", "update", "delete", "upsert"]);

async function despues(operation: string, args: unknown, resultado: unknown) {
  if (!OPERACIONES.has(operation) || !cambiaAlarmas(operation, args)) return;
  await avisarCelular((resultado as { userId?: string } | null)?.userId);
}

function conAvisos(client: PrismaClient) {
  return client.$extends({
    query: {
      event: {
        async $allOperations({ operation, args, query }) {
          const resultado = await query(args);
          await despues(operation, args, resultado);
          return resultado;
        },
      },
      quickTask: {
        async $allOperations({ operation, args, query }) {
          const resultado = await query(args);
          await despues(operation, args, resultado);
          return resultado;
        },
      },
      workItem: {
        async $allOperations({ operation, args, query }) {
          const resultado = await query(args);
          await despues(operation, args, resultado);
          return resultado;
        },
      },
    },
  });
}

type ClienteConAvisos = ReturnType<typeof conAvisos>;

const globalForPrisma = globalThis as unknown as {
  prisma: ClienteConAvisos | undefined;
};

export const prisma = globalForPrisma.prisma ?? conAvisos(base);

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
