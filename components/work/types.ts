export type WorkItemKind = "TASK" | "EVENT" | "DEADLINE";
export type WorkItemStatus = "event" | "done" | "undated" | "overdue" | "today" | "upcoming";

export type WorkCounts = {
  pending: number;
  overdue: number;
  today: number;
  newItems: number;
  unreadMessages: number;
  pendingProposals: number;
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

export type ProposalChange =
  | { op: "create"; moduleId?: string; data: Partial<WorkItemData> & { title: string } }
  | { op: "update"; itemId: string; data: Partial<WorkItemData> }
  | { op: "delete"; itemId: string };

export type WorkMessageData = {
  id: string;
  moduleId: string | null;
  author: "USER" | "CLAUDE";
  text: string;
  proposal: ProposalChange[] | null;
  proposalStatus: "PENDING" | "APPLIED" | "REJECTED" | null;
  read: boolean;
  createdAt: string;
};

export const KIND_LABELS: Record<WorkItemKind, string> = {
  TASK: "Pendiente",
  EVENT: "Evento",
  DEADLINE: "Fecha límite",
};
