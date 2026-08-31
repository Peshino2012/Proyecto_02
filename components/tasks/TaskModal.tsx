"use client";

import { useEffect, useState } from "react";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { DIFFICULTY_OPTIONS, TASK_CATEGORIES } from "@/lib/taskStats";

const INPUT_CLASS =
  "w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-600 focus:border-cyan-400/50";
const LABEL_CLASS = "text-xs font-bold uppercase tracking-wide text-slate-400";

function optionClass(active: boolean) {
  return `rounded-md border px-2 py-2 text-sm ${
    active
      ? "border-cyan-400/50 bg-cyan-400/10 text-cyan-300"
      : "border-white/10 text-slate-400 hover:bg-white/5"
  }`;
}

export type TaskData = {
  id: string;
  title: string;
  color: string;
  xpReward: number;
  target: number | null;
  targetUnit: string | null;
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
  const [target, setTarget] = useState(task?.target != null ? String(task.target) : "");
  const [targetUnit, setTargetUnit] = useState(task?.targetUnit ?? "");
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
      target: target === "" ? null : Number(target),
      targetUnit: target === "" ? null : targetUnit || null,
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl border border-cyan-400/20 bg-[#070b14] p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-slate-200 shadow-[0_0_50px_-18px_rgba(34,211,238,0.4)] sm:max-w-md sm:rounded-2xl sm:p-6 sm:pb-6"
      >
        <div className="mx-auto -mt-1 mb-1 h-1.5 w-10 rounded-full bg-white/10 sm:hidden" />

        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold uppercase tracking-wide text-cyan-300">
            {isEditing ? "Editar quest" : "Nueva quest"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-300"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-300">
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
              className={optionClass(repeatDaily)}
            >
              Quest diaria
            </button>
            <button
              type="button"
              onClick={() => setRepeatDaily(false)}
              className={optionClass(!repeatDaily)}
            >
              Pendiente puntual
            </button>
          </div>
          <p className="text-xs text-slate-500">
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
                className={optionClass(difficulty === opt.value)}
              >
                {opt.label} · {opt.xp} XP
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Objetivo (opcional)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder="100"
              className={`${INPUT_CLASS} w-24`}
            />
            <input
              value={targetUnit}
              onChange={(e) => setTargetUnit(e.target.value)}
              placeholder="flexiones, min, páginas..."
              className={INPUT_CLASS}
            />
          </div>
          <p className="text-xs text-slate-500">
            Solo informativo, para recordar la meta — se sigue completando con un toque.
          </p>
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Categoría (stat)</label>
          <div className="grid grid-cols-2 gap-2">
            {categories.map((cat) => (
              <button
                key={cat.color}
                type="button"
                onClick={() => setColor(cat.color)}
                className={`flex items-center gap-2 text-left ${optionClass(color === cat.color)}`}
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
                className="text-sm font-medium text-red-400 hover:underline"
              >
                Borrar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-slate-400 hover:bg-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-bold text-cyan-300 hover:bg-cyan-400/20 disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
