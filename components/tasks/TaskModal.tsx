"use client";

import { useEffect, useState } from "react";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { DIFFICULTY_OPTIONS, TASK_CATEGORIES } from "@/lib/taskStats";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400";
const LABEL_CLASS = "text-sm font-medium text-gray-700 dark:text-gray-300";

export type TaskData = {
  id: string;
  title: string;
  color: string;
  xpReward: number;
  repeatDaily: boolean;
  dueDate: string | null;
};

type Props = {
  task: TaskData | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function TaskModal({ task, onClose, onSaved }: Props) {
  const isEditing = !!task;

  const [shareCategories, setShareCategories] = useState(true);
  const categories = shareCategories ? EVENT_CATEGORIES : TASK_CATEGORIES;

  const [title, setTitle] = useState(task?.title ?? "");
  const [color, setColor] = useState(task?.color ?? "");
  const [difficulty, setDifficulty] = useState(
    task ? String(task.xpReward) : DIFFICULTY_OPTIONS[0].value
  );
  const [repeatDaily, setRepeatDaily] = useState(task?.repeatDaily ?? true);
  const [dueDate, setDueDate] = useState(task?.dueDate ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        const share = data.account?.taskShareEventCategories ?? true;

        setShareCategories(share);
        if (!color) setColor((share ? EVENT_CATEGORIES : TASK_CATEGORIES)[0].color);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo al montar
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      title,
      color,
      xpReward: Number(difficulty),
      repeatDaily,
      dueDate: repeatDaily ? null : dueDate || null,
    };

    const url = isEditing ? `/api/tasks/${task!.id}` : "/api/tasks";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
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
    if (!task) return;
    if (!confirm("¿Borrar esta quest?")) return;
    setLoading(true);
    const res = await fetch(`/api/tasks/${task.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg sm:max-w-md sm:rounded-2xl sm:p-6 sm:pb-6 dark:bg-gray-900"
      >
        <div className="mx-auto -mt-1 mb-1 h-1.5 w-10 rounded-full bg-gray-200 sm:hidden dark:bg-gray-700" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? "Editar quest" : "Nueva quest"}
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
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Repasar 1 capítulo, Entrenar, Orar 15 min"
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Tipo</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setRepeatDaily(true)}
              className={`rounded-md border px-2 py-2 text-sm ${
                repeatDaily
                  ? "border-gray-800 bg-gray-50 dark:border-gray-300 dark:bg-gray-800"
                  : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              } text-gray-700 dark:text-gray-300`}
            >
              Quest diaria
            </button>
            <button
              type="button"
              onClick={() => setRepeatDaily(false)}
              className={`rounded-md border px-2 py-2 text-sm ${
                !repeatDaily
                  ? "border-gray-800 bg-gray-50 dark:border-gray-300 dark:bg-gray-800"
                  : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              } text-gray-700 dark:text-gray-300`}
            >
              Pendiente puntual
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {repeatDaily
              ? "Reaparece todos los días hasta que la archives; contribuye a la penalización si no la completás."
              : "Una sola vez, con fecha límite opcional."}
          </p>
        </div>

        {!repeatDaily && (
          <div className="space-y-1">
            <label className={LABEL_CLASS}>Fecha límite (opcional)</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        )}

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Dificultad (XP)</label>
          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setDifficulty(opt.value)}
                className={`rounded-md border px-2 py-2 text-sm ${
                  difficulty === opt.value
                    ? "border-gray-800 bg-gray-50 dark:border-gray-300 dark:bg-gray-800"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                } text-gray-700 dark:text-gray-300`}
              >
                {opt.label} · {opt.xp} XP
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Categoría (stat)</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.color}
                type="button"
                onClick={() => setColor(cat.color)}
                className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left text-sm sm:py-1.5 ${
                  color === cat.color
                    ? "border-gray-800 bg-gray-50 dark:border-gray-300 dark:bg-gray-800"
                    : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                } text-gray-700 dark:text-gray-300`}
              >
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: cat.color }}
                />
                {cat.label}
              </button>
            ))}
          </div>
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
