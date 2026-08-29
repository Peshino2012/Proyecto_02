"use client";

import { useCallback, useEffect, useState } from "react";
import HabitModal, { type HabitData } from "./HabitModal";

type Habit = HabitData & { streak: number; completedToday: boolean };

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<
    { open: false } | { open: true; habit: HabitData | null }
  >({ open: false });
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadHabits = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/habits");
    if (res.ok) {
      const data = await res.json();
      setHabits(data.habits);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de hábitos
    loadHabits();
  }, [loadHabits]);

  async function toggleToday(habit: Habit) {
    setTogglingId(habit.id);
    const res = await fetch(`/api/habits/${habit.id}/log`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id
            ? { ...h, completedToday: data.completedToday, streak: data.streak }
            : h
        )
      );
    }
    setTogglingId(null);
  }

  function handleSaved() {
    setModalState({ open: false });
    loadHabits();
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-3 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Hábitos</h1>
        <button
          onClick={() => setModalState({ open: true, habit: null })}
          className="hidden rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 hover:shadow-md sm:inline-block dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          + Hábito
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400 dark:text-gray-500">Cargando…</p>}

      {!loading && habits.length === 0 && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Todavía no tenés hábitos. Creá uno para empezar a llevar la racha.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {habits.map((habit) => (
          <li
            key={habit.id}
            className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-900/5 sm:p-4 dark:bg-gray-900 dark:ring-white/10"
          >
            <button
              onClick={() => toggleToday(habit)}
              disabled={togglingId === habit.id}
              aria-label={habit.completedToday ? "Marcar como no cumplido hoy" : "Marcar como cumplido hoy"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg transition-transform active:scale-90 disabled:opacity-60"
              style={{
                backgroundColor: habit.completedToday ? habit.color : `${habit.color}17`,
                color: habit.completedToday ? "#fff" : habit.color,
              }}
            >
              {habit.completedToday ? "✓" : ""}
            </button>

            <button
              onClick={() => setModalState({ open: true, habit })}
              className="min-w-0 flex-1 text-left"
            >
              <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                {habit.title}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {habit.recurrence === "DAILY" ? "Todos los días" : "Semanal"}
                {habit.reminderHour != null &&
                  ` · ${String(habit.reminderHour).padStart(2, "0")}:${String(
                    habit.reminderMinute ?? 0
                  ).padStart(2, "0")}`}
              </p>
            </button>

            <div className="shrink-0 text-right">
              <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                🔥 {habit.streak}
              </span>
            </div>
          </li>
        ))}
      </ul>

      {/* FAB para mobile */}
      <button
        onClick={() => setModalState({ open: true, habit: null })}
        aria-label="Nuevo hábito"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl font-light text-white shadow-lg transition-transform hover:bg-indigo-700 active:scale-95 sm:hidden dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        +
      </button>

      {modalState.open && (
        <HabitModal
          habit={modalState.habit}
          onClose={() => setModalState({ open: false })}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
