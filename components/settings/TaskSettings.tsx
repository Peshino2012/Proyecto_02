"use client";

import { useEffect, useState } from "react";

export default function TaskSettings() {
  const [shareCategories, setShareCategories] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {

        setShareCategories(data.account?.taskShareEventCategories ?? true);
        setLoaded(true);
      });
  }, []);

  async function toggle() {
    const next = !shareCategories;
    setShareCategories(next);
    setSaving(true);
    await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ taskShareEventCategories: next }),
    });
    setSaving(false);
  }

  if (!loaded) return null;

  return (
    <div className="flex items-center justify-between rounded-xl p-3 ring-1 ring-gray-900/5 dark:ring-white/10">
      <div className="pr-3">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Compartir categorías con Eventos
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Las quests usan las mismas categorías con nombre que tus eventos (Facultad, Laburo,
          Fe...). Si lo apagás, las quests usan su propio set de categorías (Intelecto,
          Disciplina, Espíritu, Vitalidad, Fuerza).
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={saving}
        role="switch"
        aria-checked={shareCategories}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
          shareCategories ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-200 dark:bg-gray-700"
        }`}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
            shareCategories ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
