export type RecurrenceType = "NONE" | "DAILY" | "WEEKLY" | "MONTHLY";

export type CalendarEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: string;
  endAt: string;
  allDay: boolean;
  color: string;
  categoryColors: string[];
  reminderMinutesBefore: number | null;
  recurrence: RecurrenceType;
  recurrenceEndAt: string | null;
  /** ID del evento base de la serie. Presente solo en ocurrencias virtuales expandidas. */
  seriesId?: string;
  countdownFrom: string | null;
  countdownTo: string | null;
  countdownHour: number | null;
  countdownMinute: number | null;
};
