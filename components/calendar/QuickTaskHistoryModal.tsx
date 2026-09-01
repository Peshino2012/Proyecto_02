"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

type HistoryTask = { id: string; title: string; done: boolean };
type HistoryDay = { date: string; tasks: HistoryTask[] };

type Props = {
  onClose: () => void;
};

export default function QuickTaskHistoryModal({ onClose }: Props) {
  const [days, setDays] = useState<HistoryDay[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadPage(before: string | null) {
    const url = before
      ? `/api/quick-tasks/history?before=${before}`
      : "/api/quick-tasks/history";
    const res = await fetch(url);
    if (!res.ok) {
      setError("No se pudo cargar el historial.");
      return null;
    }
    return res.json() as Promise<{ days: HistoryDay[]; nextCursor: string | null }>;
  }

  async function loadFirstPage() {
    const data = await loadPage(null);
    if (data) {
      setDays(data.days);
      setNextCursor(data.nextCursor);
    }
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del historial
    loadFirstPage();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- carga solo al montar
  }, []);

  async function handleLoadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    const data = await loadPage(nextCursor);
    if (data) {
      setDays((prev) => [...prev, ...data.days]);
      setNextCursor(data.nextCursor);
    }
    setLoadingMore(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <div className="flex max-h-[85vh] w-full flex-col rounded-t-2xl bg-white pb-[env(safe-area-inset-bottom)] shadow-lg sm:max-w-md sm:rounded-2xl dark:bg-gray-900">
        <div className="mx-auto -mt-1 mb-1 h-1.5 w-10 shrink-0 rounded-full bg-gray-200 sm:hidden dark:bg-gray-700" />

        <div className="flex shrink-0 items-center justify-between px-5 pt-4 sm:pt-5">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Historial de tareas rápidas
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error && (
            <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
              {error}
            </p>
          )}

          {loading ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">Cargando…</p>
          ) : days.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500">
              Todavía no hay tareas rápidas en el historial.
            </p>
          ) : (
            <div className="space-y-4">
              {days.map((day) => (
                <div key={day.date}>
                  <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                    {format(new Date(`${day.date}T00:00:00`), "EEEE d 'de' MMMM", {
                      locale: es,
                    })}
                  </h3>
                  <ul className="space-y-1">
                    {day.tasks.map((t) => (
                      <li key={t.id} className="flex items-center gap-2 px-1.5 py-0.5 text-sm">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] ${
                            t.done
                              ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
                              : "border-gray-300 text-transparent dark:border-gray-600"
                          }`}
                        >
                          ✓
                        </span>
                        <span
                          className={
                            t.done
                              ? "text-gray-400 line-through dark:text-gray-500"
                              : "text-gray-800 dark:text-gray-200"
                          }
                        >
                          {t.title}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}

              {nextCursor && (
                <button
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                  className="w-full rounded-md py-2 text-center text-sm font-medium text-indigo-600 hover:bg-gray-50 disabled:opacity-60 dark:text-indigo-400 dark:hover:bg-gray-800"
                >
                  {loadingMore ? "Cargando…" : "Cargar más"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
