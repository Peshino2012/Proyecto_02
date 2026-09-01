"use client";

import { useState } from "react";
import { EVENT_CATEGORIES } from "@/lib/categories";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400";
const LABEL_CLASS = "text-sm font-medium text-gray-700 dark:text-gray-300";

export type HabitData = {
  id: string;
  title: string;
  color: string;
  categoryColors: string[];
  recurrence: "DAILY" | "WEEKLY";
  reminderHour: number | null;
  reminderMinute: number | null;
};

type Props = {
  habit: HabitData | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function HabitModal({ habit, onClose, onSaved }: Props) {
  const isEditing = !!habit;

  const [title, setTitle] = useState(habit?.title ?? "");
  const [categoryColors, setCategoryColors] = useState<string[]>(
    habit?.categoryColors && habit.categoryColors.length > 0
      ? habit.categoryColors
      : [habit?.color ?? "#16a34a"]
  );

  function toggleCategory(color: string) {
    setCategoryColors((prev) =>
      prev.includes(color)
        ? prev.length > 1
          ? prev.filter((c) => c !== color)
          : prev
        : [...prev, color]
    );
  }

  const [recurrence, setRecurrence] = useState<"DAILY" | "WEEKLY">(
    habit?.recurrence ?? "DAILY"
  );
  const [reminderTime, setReminderTime] = useState(
    habit?.reminderHour != null
      ? `${String(habit.reminderHour).padStart(2, "0")}:${String(
          habit.reminderMinute ?? 0
        ).padStart(2, "0")}`
      : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const [reminderHour, reminderMinute] = reminderTime
      ? reminderTime.split(":").map(Number)
      : [null, null];

    const payload = { title, categoryColors, recurrence, reminderHour, reminderMinute };

    const url = isEditing ? `/api/habits/${habit!.id}` : "/api/habits";
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
    if (!habit) return;
    if (!confirm("¿Borrar este hábito? Se pierde el historial de rachas.")) return;
    setLoading(true);
    const res = await fetch(`/api/habits/${habit.id}`, { method: "DELETE" });
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
            {isEditing ? "Editar hábito" : "Nuevo hábito"}
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
            placeholder="Ej. Leer la Biblia, Gimnasio, Estudiar 1h"
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Frecuencia</label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as "DAILY" | "WEEKLY")}
            className={INPUT_CLASS}
          >
            <option value="DAILY">Todos los días</option>
            <option value="WEEKLY">Al menos una vez por semana</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Recordatorio (opcional)</label>
          <input
            type="time"
            value={reminderTime}
            onChange={(e) => setReminderTime(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Categorías (elegí una o más)</label>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_CATEGORIES.map((cat) => {
              const active = categoryColors.includes(cat.color);
              return (
                <button
                  key={cat.color}
                  type="button"
                  onClick={() => toggleCategory(cat.color)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left text-sm sm:py-1.5 ${
                    active
                      ? "border-gray-800 bg-gray-50 dark:border-gray-300 dark:bg-gray-800"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  } text-gray-700 dark:text-gray-300`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                      active ? "border-transparent" : "border-gray-300 dark:border-gray-600"
                    }`}
                    style={{ backgroundColor: active ? cat.color : "transparent" }}
                  >
                    {active && <span className="text-[9px] leading-none text-white">✓</span>}
                  </span>
                  {cat.label}
                </button>
              );
            })}
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
