"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TASK_STATS, rankForLevel } from "@/lib/taskStats";
import { verseForDate } from "@/lib/verses";
import TaskModal, { type TaskData } from "./TaskModal";

type Task = TaskData & { stats: string[]; done: boolean };

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
  cleanStreak: number;
  todayXp: number;
};

const STAT_VALUE_KEY = {
  INTELECTO: "intelecto",
  DISCIPLINA: "disciplina",
  ESPIRITU: "espiritu",
  VITALIDAD: "vitalidad",
  FUERZA: "fuerza",
} as const;

const STAT_ICON: Record<string, string> = Object.fromEntries(
  TASK_STATS.map((s) => [s.key, s.icon])
);

const HEX_CLIP = "polygon(25% 4%, 75% 4%, 100% 50%, 75% 96%, 25% 96%, 0% 50%)";
const PANEL_CLIP =
  "polygon(0 0, calc(100% - 14px) 0, 100% 14px, 100% 100%, 14px 100%, 0 calc(100% - 14px))";

export default function TasksView() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalState, setModalState] = useState<
    { open: false } | { open: true; task: TaskData | null }
  >({ open: false });
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [justCompletedId, setJustCompletedId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pulseTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  async function toggleTask(task: Task) {
    setTogglingId(task.id);
    const res = await fetch(`/api/tasks/${task.id}/complete`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, done: data.done } : t)));
      // El nivel/rango/stats no cambian acá (se bancan una sola vez al otro
      // día); solo actualizamos la XP acumulada hoy.
      setProgress((prev) => (prev ? { ...prev, todayXp: data.todayXp } : prev));

      if (data.done) {
        setToast(`+${task.xpReward} XP`);
        if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
        setJustCompletedId(task.id);
        pulseTimeout.current = setTimeout(() => setJustCompletedId(null), 700);
      }
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
  const rank = progress ? rankForLevel(progress.level) : "E";

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 p-3 sm:p-6">
      <div
        className="relative overflow-hidden rounded-2xl border border-cyan-400/20 bg-[#070b14] p-4 text-slate-200 shadow-[0_0_50px_-18px_rgba(34,211,238,0.4)] sm:p-6"
        style={{
          backgroundImage:
            "radial-gradient(circle at 15% -10%, rgba(34,211,238,0.12), transparent 45%), radial-gradient(circle at 100% 0%, rgba(99,102,241,0.12), transparent 40%)",
        }}
      >
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-lg font-bold uppercase tracking-widest text-cyan-300">Quests</h1>
          <button
            onClick={() => setModalState({ open: true, task: null })}
            className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-cyan-300 transition-colors hover:bg-cyan-400/20"
          >
            + Quest
          </button>
        </div>

        {loading && <p className="text-sm text-slate-500">Cargando…</p>}

        {!loading && progress && (
          <div className="mb-5 space-y-3">
            {progress.inPenaltyZone && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-medium text-red-300">
                ⚠ Zona de penalización: completá tus quests de hoy sin fallar para salir.
              </div>
            )}

            <div className="flex items-center gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center bg-gradient-to-br from-cyan-300 to-blue-600 text-base font-black text-slate-950"
                style={{ clipPath: HEX_CLIP }}
                title={`Rango ${rank}`}
              >
                {rank}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-slate-100">Nivel {progress.level}</span>
                  <span className="font-mono text-xs text-slate-400">
                    {progress.xp} / {progress.xpToNext} XP
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-800">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 shadow-[0_0_8px_rgba(34,211,238,0.7)] transition-all"
                    style={{ width: `${xpPct}%` }}
                  />
                </div>
              </div>
              {progress.cleanStreak > 0 && (
                <span className="flex shrink-0 items-center gap-1 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-1 text-xs font-bold text-amber-300">
                  🔥 {progress.cleanStreak}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
              <span className="text-[11px] uppercase tracking-wide text-slate-500">
                XP acumulada hoy
              </span>
              <span className="font-mono text-sm font-bold text-emerald-300">
                +{progress.todayXp}
              </span>
            </div>
            <p className="-mt-2 px-0.5 text-[10px] text-slate-600">
              Se guarda mañana junto con el nivel — así no sube y baja en el mismo día.
            </p>

            <div className="grid grid-cols-5 gap-1.5">
              {TASK_STATS.map((s) => (
                <div
                  key={s.key}
                  className="flex flex-col items-center gap-0.5 rounded-md border border-white/5 bg-white/[0.03] py-1.5"
                >
                  <span className="text-sm leading-none">{s.icon}</span>
                  <span className="font-mono text-xs font-bold text-slate-100">
                    {Math.round(progress[STAT_VALUE_KEY[s.key]])}
                  </span>
                  <span className="text-center text-[8.5px] uppercase leading-none text-slate-500">
                    {s.label}
                  </span>
                </div>
              ))}
            </div>

            <ResetTimer />
            <DailyVerse />
          </div>
        )}

        {!loading && tasks.length === 0 && (
          <div className="rounded-lg border border-white/5 bg-white/[0.02] p-6 text-center">
            <p className="text-sm text-slate-400">
              Todavía no tenés quests. Creá una para empezar a subir de nivel.
            </p>
          </div>
        )}

        {dailyQuests.length > 0 && (
          <div className="mb-4">
            <h2 className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400/70">
              Hoy
            </h2>
            <ul className="space-y-2">
              {dailyQuests.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  busy={togglingId === task.id}
                  pulsing={justCompletedId === task.id}
                  onToggle={() => toggleTask(task)}
                  onEdit={() => setModalState({ open: true, task })}
                />
              ))}
            </ul>
          </div>
        )}

        {pendingQuests.length > 0 && (
          <div>
            <h2 className="mb-1.5 px-0.5 text-[11px] font-bold uppercase tracking-[0.15em] text-cyan-400/70">
              Pendientes
            </h2>
            <ul className="space-y-2">
              {pendingQuests.map((task) => (
                <TaskRow
                  key={task.id}
                  task={task}
                  busy={togglingId === task.id}
                  pulsing={justCompletedId === task.id}
                  onToggle={() => toggleTask(task)}
                  onEdit={() => setModalState({ open: true, task })}
                />
              ))}
            </ul>
          </div>
        )}
      </div>

      {toast && (
        <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] left-1/2 z-40 -translate-x-1/2 rounded-full border border-cyan-400/40 bg-slate-950 px-4 py-2 font-mono text-sm font-bold text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.5)]">
          {toast}
        </div>
      )}

      <button
        onClick={() => setModalState({ open: true, task: null })}
        aria-label="Nueva quest"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full border border-cyan-400/40 bg-slate-950 text-2xl font-light text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.45)] transition-transform active:scale-95 sm:hidden"
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
  pulsing,
  onToggle,
  onEdit,
}: {
  task: Task;
  busy: boolean;
  pulsing: boolean;
  onToggle: () => void;
  onEdit: () => void;
}) {
  const overdue = !task.repeatDaily && !task.done && !!task.dueDate && task.dueDate < todayStr();

  return (
    <li
      className={`relative flex items-center gap-3 border border-white/5 bg-white/[0.03] p-3 pl-4 transition-shadow ${
        pulsing ? "animate-quest-pulse" : ""
      }`}
      style={{ clipPath: PANEL_CLIP }}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 flex w-1 flex-col">
        {task.categoryColors.map((c) => (
          <span key={c} className="flex-1" style={{ backgroundColor: c }} />
        ))}
      </span>

      <button
        onClick={onToggle}
        disabled={busy}
        aria-label={task.done ? "Marcar como no cumplida" : "Marcar como cumplida"}
        className="flex h-9 w-9 shrink-0 items-center justify-center border text-sm font-bold transition-transform active:scale-90 disabled:opacity-60"
        style={{
          borderColor: task.done ? task.color : "rgba(255,255,255,0.15)",
          backgroundColor: task.done ? task.color : "transparent",
          color: task.done ? "#020617" : task.color,
        }}
      >
        {task.done ? "✓" : STAT_ICON[task.stats[0]] ?? "🎯"}
      </button>

      <button onClick={onEdit} className="min-w-0 flex-1 text-left">
        <div className="flex flex-wrap items-center gap-1.5">
          <p
            className={`truncate text-sm font-semibold ${
              task.done ? "text-slate-500 line-through" : "text-slate-100"
            }`}
          >
            {task.title}
          </p>
          {task.target != null && (
            <span className="shrink-0 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-300">
              {task.target}
              {task.targetUnit ? ` ${task.targetUnit}` : ""}
            </span>
          )}
        </div>
        <p
          className={`text-xs ${overdue ? "font-semibold text-red-400" : "text-slate-500"}`}
        >
          {task.repeatDaily
            ? "Diaria"
            : task.dueDate
              ? `Vence ${task.dueDate}`
              : "Sin fecha"}
        </p>
      </button>

      <span className="shrink-0 rounded border border-amber-400/30 bg-amber-400/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-amber-300">
        +{task.xpReward} XP
      </span>
    </li>
  );
}

function todayStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Próxima medianoche hora Argentina (UTC-3, sin horario de verano) = las
// 03:00 UTC del día siguiente (o de hoy, si todavía no pasó).
function nextArgMidnight(now: Date): Date {
  const target = new Date(now);
  target.setUTCHours(3, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setUTCDate(target.getUTCDate() + 1);
  return target;
}

function ResetTimer() {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    function tick() {
      const now = new Date();
      const ms = nextArgMidnight(now).getTime() - now.getTime();
      const h = Math.floor(ms / 3600000);
      const m = Math.floor((ms % 3600000) / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, "0");
      setRemaining(`${pad(h)}:${pad(m)}:${pad(s)}`);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
      <span className="text-[11px] uppercase tracking-wide text-slate-500">
        Quests diarias se reinician en
      </span>
      <span className="font-mono text-sm font-bold text-cyan-300">{remaining}</span>
    </div>
  );
}

function DailyVerse() {
  // Se calcula en el cliente con la fecha local — un versículo por día,
  // visible siempre (independiente de si se completó alguna quest).
  const [verse, setVerse] = useState<{ text: string; ref: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- depende de la fecha local del dispositivo
    setVerse(verseForDate(todayStr()));
  }, []);

  if (!verse) return null;

  return (
    <div className="rounded-md border border-amber-400/20 bg-amber-400/[0.04] px-3 py-2.5 text-center">
      <p className="text-xs italic text-amber-200/90">&ldquo;{verse.text}&rdquo;</p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-amber-400/70">
        {verse.ref}
      </p>
    </div>
  );
}
