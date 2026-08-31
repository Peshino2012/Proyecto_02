"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TASK_STATS } from "@/lib/taskStats";
import TaskModal, { type TaskData } from "./TaskModal";

type Task = TaskData & { stat: string; done: boolean };

type Progress = {
  level: number;
  xp: number;
  xpToNext: number;
  totalXp: number;
  intelecto: number;
  disciplina: number;
  espiritu: number;
  vitalidad: number;
  fuerza: number;
  penaltyStrikes: number;
  inPenaltyZone: boolean;
};

const STAT_VALUE_KEY = {
  INTELECTO: "intelecto",
  DISCIPLINA: "disciplina",
  ESPIRITU: "espiritu",
  VITALIDAD: "vitalidad",
  FUERZA: "fuerza",
} as const;

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<
    { open: false } | { open: true; task: TaskData | null }
  >({ open: false });
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    // Secuencial (no Promise.all): pedir /api/tasks y /api/progress en
    // paralelo puede hacer que sus queries a la base choquen en la misma
    // conexión del pool (el upsert de progreso corriendo a la vez que otra
    // query desincroniza el protocolo). Ver lib/prisma.ts (withDbRetry).
    const tasksRes = await fetch("/api/tasks");
    if (tasksRes.ok) setTasks((await tasksRes.json()).tasks);
    const progressRes = await fetch("/api/progress");
    if (progressRes.ok) setProgress((await progressRes.json()).progress);
    setLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  async function toggleTask(task: Task) {
    setTogglingId(task.id);
    const res = await fetch(`/api/tasks/${task.id}/complete`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: data.done } : t)));
      setProgress(data.progress);
      if (data.leveledUp) setToast(`¡Subiste a nivel ${data.progress.level}! 🎉`);
      else if (data.leveledDown) setToast(`Bajaste a nivel ${data.progress.level}.`);
      else if (data.done) setToast(`+${task.xpReward} XP`);
    }
    setTogglingId(null);
  }

  function handleSaved() {
    setModalState({ open: false });
    loadAll();
  }

  const dailyQuests = useMemo(() => tasks.filter((t) => t.repeatDaily), [tasks]);
  const pendingQuests = useMemo(
    () =>
      tasks
        .filter((t) => !t.repeatDaily)
        .sort((a, b) => (a.dueDate ?? "9999").localeCompare(b.dueDate ?? "9999")),
    [tasks]
  );

  const xpPct = progress ? Math.min(100, Math.round((progress.xp / progress.xpToNext) * 100)) : 0;

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-3 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Quests</h1>
        <button
          onClick={() => setModalState({ open: true, task: null })}
          className="hidden rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 hover:shadow-md sm:inline-block dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          + Quest
        </button>
      </div>

      {loading && <p className="text-sm text-gray-400 dark:text-gray-500">Cargando…</p>}

      {!loading && progress && (
        <div className="mb-4 space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
          {progress.inPenaltyZone && (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-500/10 dark:text-red-300">
              ⚠️ Zona de penalización: completá tus quests de hoy sin fallar para salir.
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Nivel {progress.level}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">
              {progress.xp} / {progress.xpToNext} XP
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all dark:bg-indigo-500"
              style={{ width: `${xpPct}%` }}
            />
          </div>

          <div className="grid grid-cols-5 gap-1.5 pt-1">
            {TASK_STATS.map((s) => (
              <div key={s.key} className="flex flex-col items-center gap-0.5">
                <span className="text-base leading-none">{s.icon}</span>
                <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">
                  {progress[STAT_VALUE_KEY[s.key]]}
                </span>
                <span className="text-center text-[9px] leading-none text-gray-400 dark:text-gray-500">
                  {s.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && tasks.length === 0 && (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Todavía no tenés quests. Creá una para empezar a subir de nivel.
          </p>
        </div>
      )}

      {dailyQuests.length > 0 && (
        <div className="mb-4">
          <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Hoy
          </h2>
          <ul className="space-y-2">
            {dailyQuests.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                busy={togglingId === task.id}
                onToggle={() => toggleTask(task)}
                onEdit={() => setModalState({ open: true, task })}
              />
            ))}
          </ul>
        </div>
      )}

      {pendingQuests.length > 0 && (
        <div>
          <h2 className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
            Pendientes
          </h2>
          <ul className="space-y-2">
            {pendingQuests.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                busy={togglingId === task.id}
                onToggle={() => toggleTask(task)}
                onEdit={() => setModalState({ open: true, task })}
              />
            ))}
          </ul>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded-full bg-gray-900 px-4 py-2 text-sm font-medium text-white shadow-lg dark:bg-gray-100 dark:text-gray-900">
          {toast}
        </div>
      )}

      <button
        onClick={() => setModalState({ open: true, task: null })}
        aria-label="Nueva quest"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl font-light text-white shadow-lg transition-transform hover:bg-indigo-700 active:scale-95 sm:hidden dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        +
      </button>

      {modalState.open && (
        <TaskModal
          task={modalState.task}
          onClose={() => setModalState({ open: false })}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}

function TaskRow({
  task,
  busy,
  onToggle,
  onEdit,
}: {
  task: Task;
  busy: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const overdue = !task.repeatDaily && !task.done && !!task.dueDate && task.dueDate < todayStr();

  return (
    <li className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-900/5 sm:p-4 dark:bg-gray-900 dark:ring-white/10">
      <button
        onClick={onToggle}
        disabled={busy}
        aria-label={task.done ? "Marcar como no cumplida" : "Marcar como cumplida"}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg transition-transform active:scale-90 disabled:opacity-60"
        style={{
          backgroundColor: task.done ? task.color : `${task.color}17`,
          color: task.done ? "#fff" : task.color,
        }}
      >
        {task.done ? "✓" : ""}
      </button>

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <p
          className={`truncate text-sm font-medium ${
            task.done
              ? "text-gray-400 line-through dark:text-gray-500"
              : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {task.title}
        </p>
        <p
          className={`text-xs ${overdue ? "font-medium text-red-500 dark:text-red-400" : "text-gray-500 dark:text-gray-400"}`}
        >
          {task.repeatDaily
            ? `Diaria · ${task.xpReward} XP`
            : `${task.dueDate ? `Vence ${task.dueDate}` : "Sin fecha"} · ${task.xpReward} XP`}
        </p>
      </button>
    </li>
  );
}

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
