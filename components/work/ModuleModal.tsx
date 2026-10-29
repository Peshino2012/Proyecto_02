"use client";

import { useState } from "react";
import { notifyWorkChanged } from "./useWorkAttention";
import type { WorkModuleData } from "./types";

const COLORS = ["#eab308", "#7c3aed", "#0d9488", "#2563eb", "#dc2626", "#db2777", "#16a34a", "#ea580c"];
const ICONS = ["💼", "🛒", "🏆", "🤝", "📱", "🎓", "💡", "📦", "🧾", "🎨", "⚙️", "🚀"];

const INPUT_CLASS =
  "w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";
const LABEL_CLASS = "mb-1 block text-xs font-medium text-gray-500 dark:text-gray-400";

type Props = {
  module: Pick<WorkModuleData, "id" | "name" | "description" | "icon" | "color"> | null;
  onClose: () => void;
  onSaved: (id: string | null) => void;
};

export default function ModuleModal({ module, onClose, onSaved }: Props) {
  const [name, setName] = useState(module?.name ?? "");
  const [description, setDescription] = useState(module?.description ?? "");
  const [icon, setIcon] = useState(module?.icon ?? ICONS[0]);
  const [color, setColor] = useState(module?.color ?? COLORS[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!name.trim()) {
      setError("Poné un nombre.");
      return;
    }
    setSaving(true);
    const res = await fetch(module ? `/api/work/modules/${module.id}` : "/api/work/modules", {
      method: module ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null, icon, color }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "No se pudo guardar.");
      return;
    }
    const data = await res.json();
    onSaved(data.module?.id ?? null);
  }

  async function archive() {
    if (!module || !confirm(`¿Sacar "${module.name}" del apartado Trabajo?`)) return;
    setSaving(true);
    const res = await fetch(`/api/work/modules/${module.id}`, { method: "DELETE" });
    setSaving(false);
    if (!res.ok) {
      setError("No se pudo borrar.");
      return;
    }
    notifyWorkChanged();
    onSaved(null);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-2xl dark:bg-gray-900"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
          {module ? "Editar módulo" : "Nuevo módulo"}
        </h2>
        <div className="space-y-4">
          <div>
            <label className={LABEL_CLASS} htmlFor="module-name">
              Nombre
            </label>
            <input
              id="module-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              autoFocus={!module}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <label className={LABEL_CLASS} htmlFor="module-description">
              De qué se trata (opcional)
            </label>
            <textarea
              id="module-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              maxLength={300}
              className={INPUT_CLASS}
            />
          </div>
          <div>
            <span className={LABEL_CLASS}>Ícono</span>
            <div className="flex flex-wrap gap-1.5">
              {ICONS.map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIcon(i)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-lg ${
                    icon === i
                      ? "bg-indigo-50 ring-2 ring-indigo-400 dark:bg-indigo-500/15"
                      : "hover:bg-gray-100 dark:hover:bg-gray-800"
                  }`}
                >
                  {i}
                </button>
              ))}
            </div>
          </div>
          <div>
            <span className={LABEL_CLASS}>Color</span>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Color ${c}`}
                  className={`h-7 w-7 rounded-full ${color === c ? "ring-2 ring-gray-900 ring-offset-2 dark:ring-white dark:ring-offset-gray-900" : ""}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex items-center gap-2 pt-1">
            {module && (
              <button
                onClick={archive}
                disabled={saving}
                className="rounded-full px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                Borrar módulo
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
