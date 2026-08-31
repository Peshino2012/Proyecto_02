"use client";

import { useEffect, useState } from "react";
import { getThemeCookieClient, setTheme, type ThemePreference } from "@/lib/theme";

const OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: "Claro", value: "light" },
  { label: "Oscuro", value: "dark" },
  { label: "Sistema", value: "system" },
];

export default function ThemeToggle() {
  const [pref, setPref] = useState<ThemePreference | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valor derivado de la cookie solo disponible en cliente
    setPref(getThemeCookieClient());
  }, []);

  function handleChange(value: ThemePreference) {
    setPref(value);
    setTheme(value);
  }

  return (
    <div className="flex items-center justify-between rounded-xl p-3 ring-1 ring-gray-900/5 dark:ring-white/10">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Apariencia</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Elegí el tema de la app en este dispositivo.
        </p>
      </div>
      <div className="flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
        {OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => handleChange(opt.value)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              pref === opt.value
                ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
