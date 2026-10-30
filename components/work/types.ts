export type WorkItemKind = "TASK" | "EVENT" | "DEADLINE";
export type WorkItemStatus = "event" | "done" | "undated" | "overdue" | "today" | "upcoming";

export type WorkCounts = {
  pending: number;
  overdue: number;
  today: number;
  newItems: number;
  attention: number;
};

export type WorkModuleData = {
  id: string;
  name: string;
  description: string | null;
  icon: string;
  color: string;
  counts: WorkCounts | null;
};

export type WorkItemData = {
  id: string;
  moduleId: string;
  title: string;
  notes: string | null;
  kind: WorkItemKind;
  date: string | null;
  time: string | null;
  startAt: string | null;
  allDay: boolean;
  done: boolean;
  reminderMinutesBefore: number | null;
  createdBy: "USER" | "CLAUDE";
  isNew: boolean;
  status: WorkItemStatus;
};

export const KIND_LABELS: Record<WorkItemKind, string> = {
  TASK: "Pendiente",
  EVENT: "Evento",
  DEADLINE: "Fecha límite",
};
