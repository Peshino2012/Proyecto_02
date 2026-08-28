// Argentina no usa horario de verano, así que el offset es fijo.
export const APP_TZ_OFFSET = "-03:00";

export function argDateTime(dateStr: string, hour: number, minute = 0): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00${APP_TZ_OFFSET}`);
}

const ARG_OFFSET_MS = 3 * 60 * 60 * 1000;

// Fecha calendario (YYYY-MM-DD) del "hoy" en horario argentino, para un instante UTC dado.
export function argTodayDateString(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - ARG_OFFSET_MS);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`;
}
