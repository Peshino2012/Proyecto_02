"use client";

import { useState } from "react";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400";
const LABEL_CLASS = "text-sm font-medium text-gray-700 dark:text-gray-300";

export type QuickTaskData = {
  id: string;
  title: string;
  date: string;
  done: boolean;
};

type Props = {
  quickTask: QuickTaskData | null;
  initialDate: string;
  onClose: () => void;
  onSaved: () => void;
};

export default function QuickTaskModal({ quickTask, initialDate, onClose, onSaved }: Props) {
  const isEditing = !!quickTask;

  const [title, setTitle] = useState(quickTask?.title ?? "");
  const [date, setDate] = useState(quickTask?.date ?? initialDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const url = isEditing ? `/api/quick-tasks/${quickTask!.id}` : "/api/quick-tasks";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, date }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar");
      return;
    }

    onSaved();
  }

  async function handleDelete() {
    if (!quickTask) return;
    if (!confirm("¿Borrar esta tarea?")) return;
    setLoading(true);
    const res = await fetch(`/api/quick-tasks/${quickTask.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full space-y-4 rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg sm:max-w-sm sm:rounded-2xl sm:p-6 sm:pb-6 dark:bg-gray-900"
      >
        <div className="mx-auto -mt-1 mb-1 h-1.5 w-10 rounded-full bg-gray-200 sm:hidden dark:bg-gray-700" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? "Editar tarea" : "Nueva tarea"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Título</label>
          <input
            required
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Llamar al dentista"
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Fecha</label>
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Borrar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
