// Argentina no usa horario de verano, así que el offset es fijo.
export const APP_TZ_OFFSET = "-03:00";

export function argDateTime(dateStr: string, hour: number, minute = 0): Date {
  const pad = (n: number) => String(n).padStart(2, "0");
  return new Date(`${dateStr}T${pad(hour)}:${pad(minute)}:00${APP_TZ_OFFSET}`);
}
