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

// Hora (0-23) en horario argentino, para un instante UTC dado.
export function argCurrentHour(now: Date = new Date()): number {
  return new Date(now.getTime() - ARG_OFFSET_MS).getUTCHours();
}

// Minutos desde las 00:00 en horario argentino (0-1439), para comparar
// contra un horario de recordatorio configurado en HH:MM.
export function argMinutesSinceMidnight(now: Date = new Date()): number {
  const shifted = new Date(now.getTime() - ARG_OFFSET_MS);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

export function isWithinQuietHours(
  hourNow: number,
  start: number | null | undefined,
  end: number | null | undefined
): boolean {
  if (start == null || end == null || start === end) return false;
  if (start < end) return hourNow >= start && hourNow < end;
  // El rango cruza la medianoche (ej. 22 a 7).
  return hourNow >= start || hourNow < end;
}
