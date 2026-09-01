"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isAfter,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";
import { es } from "date-fns/locale";
import HabitModal, { type HabitData } from "./HabitModal";

type Habit = HabitData & { streak: number; completedToday: boolean; logDates: string[] };
type ViewMode = "week" | "month";

function dateKey(d: Date) {
  return format(d, "yyyy-MM-dd");
}

export default function HabitsView() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<
    { open: false } | { open: true; habit: HabitData | null }
  >({ open: false });
  const [togglingKey, setTogglingKey] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("week");
  const [anchor, setAnchor] = useState(() => new Date());

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

  const days = useMemo(() => {
    if (viewMode === "week") {
      return eachDayOfInterval({
        start: startOfWeek(anchor, { weekStartsOn: 1 }),
        end: endOfWeek(anchor, { weekStartsOn: 1 }),
      });
    }
    return eachDayOfInterval({ start: startOfMonth(anchor), end: endOfMonth(anchor) });
  }, [anchor, viewMode]);

  function goPrev() {
    setAnchor((d) => (viewMode === "week" ? subWeeks(d, 1) : subMonths(d, 1)));
  }
  function goNext() {
    setAnchor((d) => (viewMode === "week" ? addWeeks(d, 1) : addMonths(d, 1)));
  }
  function goToday() {
    setAnchor(new Date());
  }

  async function toggleDay(habit: Habit, day: Date) {
    if (isAfter(day, new Date()) && !isToday(day)) return;
    const key = `${habit.id}:${dateKey(day)}`;
    setTogglingKey(key);
    const res = await fetch(`/api/habits/${habit.id}/log`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: dateKey(day) }),
    });
    if (res.ok) {
      const data = await res.json();
      setHabits((prev) =>
        prev.map((h) =>
          h.id === habit.id
            ? {
                ...h,
                logDates: data.logDates,
                streak: data.streak,
                completedToday: data.completedToday,
              }
            : h
        )
      );
    }
    setTogglingKey(null);
  }

  function handleSaved() {
    setModalState({ open: false });
    loadHabits();
  }

  const rangeLabel =
    viewMode === "week"
      ? `${format(days[0], "d MMM", { locale: es })} – ${format(days[days.length - 1], "d MMM", {
          locale: es,
        })}`
      : format(anchor, "MMMM yyyy", { locale: es });

  return (
    <div className="mx-auto w-full max-w-4xl flex-1 p-3 sm:p-6">
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

      {!loading && habits.length > 0 && (
        <div className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 p-3 dark:border-gray-800">
            <div className="flex items-center gap-1">
              <button
                onClick={goPrev}
                aria-label="Anterior"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                ←
              </button>
              <span className="min-w-[8.5rem] text-center text-sm font-medium capitalize text-gray-700 dark:text-gray-300">
                {rangeLabel}
              </span>
              <button
                onClick={goNext}
                aria-label="Siguiente"
                className="flex h-8 w-8 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
              >
                →
              </button>
              <button
                onClick={goToday}
                className="ml-1 rounded-full border border-gray-200 px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Hoy
              </button>
            </div>

            <div className="flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
              {(["week", "month"] as ViewMode[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    viewMode === mode
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                      : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  }`}
                >
                  {mode === "week" ? "Semana" : "Mes"}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 min-w-[9.5rem] bg-white p-2 text-left text-xs font-medium text-gray-400 dark:bg-gray-900 dark:text-gray-500">
                    Hábito
                  </th>
                  {days.map((day) => (
                    <th
                      key={dateKey(day)}
                      className={`w-10 min-w-10 p-1 text-center text-[10px] font-medium ${
                        isToday(day)
                          ? "text-indigo-600 dark:text-indigo-400"
                          : "text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      <div className="uppercase">{format(day, "EEEEE", { locale: es })}</div>
                      <div
                        className={`mx-auto mt-0.5 flex h-5 w-5 items-center justify-center rounded-full ${
                          isToday(day) ? "bg-indigo-100 dark:bg-indigo-500/20" : ""
                        }`}
                      >
                        {format(day, "d")}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {habits.map((habit) => {
                  const logSet = new Set(habit.logDates);
                  return (
                    <tr
                      key={habit.id}
                      className="border-t border-gray-50 dark:border-gray-800/60"
                    >
                      <td className="sticky left-0 z-10 min-w-[9.5rem] bg-white p-2 dark:bg-gray-900">
                        <button
                          onClick={() => setModalState({ open: true, habit })}
                          className="flex w-full items-center gap-2 text-left"
                        >
                          <span className="flex shrink-0 gap-0.5">
                            {habit.categoryColors.map((c) => (
                              <span
                                key={c}
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: c }}
                              />
                            ))}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-xs font-medium text-gray-900 dark:text-gray-100">
                            {habit.title}
                          </span>
                          <span className="shrink-0 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
                            🔥{habit.streak}
                          </span>
                        </button>
                      </td>
                      {days.map((day) => {
                        const key = dateKey(day);
                        const checked = logSet.has(key);
                        const future = isAfter(day, new Date()) && !isToday(day);
                        const isBusy = togglingKey === `${habit.id}:${key}`;
                        return (
                          <td key={key} className="p-1 text-center">
                            <button
                              onClick={() => toggleDay(habit, day)}
                              disabled={future || isBusy}
                              aria-label={`${habit.title} · ${format(day, "d MMM", { locale: es })}${
                                checked ? " (cumplido)" : ""
                              }`}
                              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-md text-xs transition-transform active:scale-90 ${
                                future ? "opacity-30" : ""
                              } disabled:cursor-default`}
                              style={{
                                backgroundColor: checked ? habit.color : `${habit.color}14`,
                                color: checked ? "#fff" : "transparent",
                              }}
                            >
                              {checked ? "✓" : ""}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

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
