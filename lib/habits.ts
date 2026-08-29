import { argTodayDateString } from "@/lib/timezone";

function dateStringAddDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

function startOfIsoWeek(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = dt.getUTCDay(); // 0=domingo..6=sábado
  const diff = day === 0 ? -6 : 1 - day; // retrocede hasta el lunes
  dt.setUTCDate(dt.getUTCDate() + diff);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export type HabitRecurrence = "DAILY" | "WEEKLY";

/**
 * Racha actual del hábito: días (o semanas) consecutivos con al menos un
 * check-in, contando hacia atrás desde hoy. Si hoy todavía no se marcó,
 * no se considera "rota" hasta que termine el día/semana (se sigue contando
 * desde el período anterior), para no castigar antes de tiempo.
 */
export function computeStreak(
  recurrence: HabitRecurrence,
  logDates: string[],
  now: Date = new Date()
): number {
  const dates = new Set(logDates);
  const today = argTodayDateString(now);

  if (recurrence === "WEEKLY") {
    const hasLogInWeek = (weekStart: string) => {
      for (let i = 0; i < 7; i++) {
        if (dates.has(dateStringAddDays(weekStart, i))) return true;
      }
      return false;
    };

    let weekStart = startOfIsoWeek(today);
    if (!hasLogInWeek(weekStart)) weekStart = dateStringAddDays(weekStart, -7);

    let streak = 0;
    while (hasLogInWeek(weekStart)) {
      streak += 1;
      weekStart = dateStringAddDays(weekStart, -7);
    }
    return streak;
  }

  let cursor = dates.has(today) ? today : dateStringAddDays(today, -1);
  let streak = 0;
  while (dates.has(cursor)) {
    streak += 1;
    cursor = dateStringAddDays(cursor, -1);
  }
  return streak;
}

export function isCompletedToday(logDates: string[], now: Date = new Date()): boolean {
  return logDates.includes(argTodayDateString(now));
}
