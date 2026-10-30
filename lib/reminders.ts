import { argDateTime, argTodayDateString } from "@/lib/timezone";

// El recordatorio se cuenta desde que TERMINA el evento (así lo usa Martín: el
// inicio queda en "ahora" y el fin marca cuándo tiene que avisar).
export const REMINDER_OPTIONS = [
  { label: "Sin recordatorio", value: "" },
  { label: "Justo al terminar", value: "0" },
  { label: "10 minutos antes", value: "10" },
  { label: "30 minutos antes", value: "30" },
  { label: "1 hora antes", value: "60" },
  { label: "1 día antes", value: "1440" },
];

/**
 * Cuándo suena el recordatorio de una ocurrencia: X minutos antes de que
 * termine. Los eventos de todo el día no tienen hora de fin útil: se toman
 * las 9:00 de ese día.
 */
export function reminderFireAt(
  occurrenceStart: Date,
  durationMs: number,
  allDay: boolean,
  reminderMinutesBefore: number
): Date {
  const base = allDay
    ? argDateTime(argTodayDateString(occurrenceStart), 9)
    : new Date(occurrenceStart.getTime() + durationMs);
  return new Date(base.getTime() - reminderMinutesBefore * 60 * 1000);
}
