"use client";

import { useState } from "react";
import { notifyWorkChanged } from "./useWorkAttention";
import { KIND_LABELS, type WorkItemData, type WorkItemKind } from "./types";

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";

const REMINDER_OPTIONS = [
  { value: "", label: "Sin recordatorio" },
  { value: "0", label: "En el momento" },
  { value: "60", label: "1 hora antes" },
  { value: "1440", label: "1 día antes" },
  { value: "4320", label: "3 días antes" },
  { value: "10080", label: "1 semana antes" },
];

type Props = {
  moduleId: string;
  item: WorkItemData | null;
  initialDate: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function WorkItemModal({ moduleId, item, initialDate, onClose, onSaved }: Props) {
  const [title, setTitle] = useState(item?.title ?? "");
  const [notes, setNotes] = useState(item?.notes ?? "");
  const [kind, setKind] = useState<WorkItemKind>(item?.kind ?? "TASK");
  const [date, setDate] = useState(item ? (item.date ?? "") : (initialDate ?? ""));
  const [time, setTime] = useState(item?.time ?? "");
  const [reminder, setReminder] = useState(
    item?.reminderMinutesBefore != null ? String(item.reminderMinutesBefore) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!title.trim()) {
      setError("Poné un nombre.");
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      moduleId,
      title: title.trim(),
      notes: notes.trim() || null,
      kind,
      date: date || null,
      time: date && time ? time : null,
      reminderMinutesBefore: date && reminder !== "" ? Number(reminder) : null,
    };
    const res = await fetch(item ? `/api/work/items/${item.id}` : "/api/work/items", {
      method: item ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar.");
      return;
    }
    notifyWorkChanged();
    onSaved();
  }

  async function remove() {
    if (!item || !confirm(`¿Borrar "${item.title}"?`)) return;
    setSaving(true);
    const res = await fetch(`/api/work/items/${item.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo borrar.");
      return;
    }
    notifyWorkChanged();
    onSaved();
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {item ? "Editar" : "Nuevo"}
        </h2>

        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-1.5">
            {(Object.keys(KIND_LABELS) as WorkItemKind[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={`rounded-lg border px-2 py-2 text-xs font-medium ${
                  kind === k
                    ? "border-indigo-400 bg-indigo-50 text-indigo-700 dark:border-indigo-500 dark:bg-indigo-500/15 dark:text-indigo-300"
                    : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
                }`}
              >
                {KIND_LABELS[k]}
              </button>
            ))}
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="work-title">
              Nombre
            </label>
            <input
              id="work-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              autoFocus={!item}
              className={INPUT_CLASS}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL_CLASS} htmlFor="work-date">
                Día
              </label>
              <input
                id="work-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={INPUT_CLASS}
              />
            </div>
            <div>
              <label className={LABEL_CLASS} htmlFor="work-time">
                Hora (opcional)
              </label>
              <input
                id="work-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                disabled={!date}
                className={`${INPUT_CLASS} disabled:opacity-50`}
              />
            </div>
          </div>
          {!date && (
            <p className="-mt-2 text-xs text-gray-400 dark:text-gray-500">
              Sin día queda en la lista de pendientes, fuera del calendario.
            </p>
          )}

          <div>
            <label className={LABEL_CLASS} htmlFor="work-reminder">
              Recordatorio
            </label>
            <select
              id="work-reminder"
              value={reminder}
              onChange={(e) => setReminder(e.target.value)}
              disabled={!date}
              className={`${INPUT_CLASS} disabled:opacity-50`}
            >
              {REMINDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={LABEL_CLASS} htmlFor="work-notes">
              Notas
            </label>
            <textarea
              id="work-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={2000}
              className={INPUT_CLASS}
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {item && (
              <button
                onClick={remove}
                disabled={saving}
                className="rounded-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Borrar
              </button>
            )}
            <div className="flex-1" />
            <button
              onClick={onClose}
              className="rounded-full px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500"
            >
              Guardar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
