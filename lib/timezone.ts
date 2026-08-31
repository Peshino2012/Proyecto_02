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

// Suma (o resta, con delta negativo) días a una fecha YYYY-MM-DD, sin
// depender de zona horaria (aritmética pura de calendario).
export function dateStringAddDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

// Cantidad de días entre dos fechas YYYY-MM-DD (to - from), positivo si `to`
// es posterior.
export function dateStringDiffDays(from: string, to: string): number {
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  const fromMs = Date.UTC(fy, fm - 1, fd);
  const toMs = Date.UTC(ty, tm - 1, td);
  return Math.round((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

/**
 * Ajusta el rango de la cuenta regresiva de un evento: `to` nunca puede ser
 * posterior al día del evento (se recorta), y `from` nunca posterior a `to`
 * (se recorta a `to`).
 */
export function clampCountdownDates(
  from: string,
  to: string,
  eventStartAt: Date
): { from: string; to: string } {
  const eventDay = argTodayDateString(eventStartAt);
  const clampedTo = to > eventDay ? eventDay : to;
  const clampedFrom = from > clampedTo ? clampedTo : from;
  return { from: clampedFrom, to: clampedTo };
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
