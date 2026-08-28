import { addDays, addMonths, addWeeks } from "date-fns";

export type RecurrenceType = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

type RecurringEvent = {
  startAt: Date;
  recurrence: RecurrenceType;
  recurrenceEndAt: Date | null;
};

function stepOccurrence(date: Date, recurrence: RecurrenceType): Date {
  switch (recurrence) {
    case "DAILY":
      return addDays(date, 1);
    case "WEEKLY":
      return addWeeks(date, 1);
    case "MONTHLY":
      return addMonths(date, 1);
    default:
      return date;
  }
}

/**
 * Fechas de inicio de cada ocurrencia del evento que caen dentro de [rangeStart, rangeEnd].
 * Para eventos no recurrentes, devuelve como mucho su propio startAt.
 */
export function occurrencesInRange(
  event: RecurringEvent,
  rangeStart: Date,
  rangeEnd: Date,
  maxOccurrences = 400
): Date[] {
  if (event.recurrence === "NONE") {
    return event.startAt >= rangeStart && event.startAt <= rangeEnd ? [event.startAt] : [];
  }

  const results: Date[] = [];
  let cursor = event.startAt;
  let count = 0;

  while (cursor <= rangeEnd && count < maxOccurrences) {
    if (event.recurrenceEndAt && cursor > event.recurrenceEndAt) break;
    if (cursor >= rangeStart) results.push(cursor);
    cursor = stepOccurrence(cursor, event.recurrence);
    count += 1;
  }

  return results;
}

/**
 * Próxima ocurrencia con inicio estrictamente posterior a `after` (o la primera si `after` es null).
 * Devuelve null si la serie ya terminó (recurrenceEndAt) o no hay más ocurrencias.
 */
export function nextOccurrenceAfter(
  event: RecurringEvent,
  after: Date | null,
  maxSteps = 1000
): Date | null {
  if (event.recurrence === "NONE") {
    if (after && event.startAt <= after) return null;
    return event.startAt;
  }

  let cursor = event.startAt;
  let steps = 0;

  while (steps < maxSteps) {
    if (event.recurrenceEndAt && cursor > event.recurrenceEndAt) return null;
    if (!after || cursor > after) return cursor;
    cursor = stepOccurrence(cursor, event.recurrence);
    steps += 1;
  }

  return null;
}
