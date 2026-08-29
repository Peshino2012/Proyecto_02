"use client";

import { useEffect, useState } from "react";
import { REMINDER_OPTIONS } from "@/lib/reminders";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-200 bg-white px-2 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400";

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => h);

export default function NotificationPrefs() {
  const [quietStart, setQuietStart] = useState("");
  const [quietEnd, setQuietEnd] = useState("");
  const [defaultReminder, setDefaultReminder] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
        const account = data.account ?? {};
         
        setQuietStart(account.quietHoursStart != null ? String(account.quietHoursStart) : "");
        setQuietEnd(account.quietHoursEnd != null ? String(account.quietHoursEnd) : "");
        setDefaultReminder(
          account.defaultReminderMinutes != null ? String(account.defaultReminderMinutes) : ""
        );
        setLoaded(true);
      });
  }, []);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quietHoursStart: quietStart === "" ? null : Number(quietStart),
        quietHoursEnd: quietEnd === "" ? null : Number(quietEnd),
        defaultReminderMinutes: defaultReminder === "" ? null : Number(defaultReminder),
      }),
    });
    setSaving(false);
    setMessage(res.ok ? "Guardado." : "No se pudo guardar.");
  }

  if (!loaded) return null;

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">No molestar</p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          En este horario no se manda ningún push ni mail — el recordatorio se reintenta
          apenas termina la franja, no se pierde.
        </p>
        <div className="mt-1 flex items-center gap-2">
          <select
            value={quietStart}
            onChange={(e) => setQuietStart(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Desde...</option>
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-400 dark:text-gray-500">a</span>
          <select
            value={quietEnd}
            onChange={(e) => setQuietEnd(e.target.value)}
            className={INPUT_CLASS}
          >
            <option value="">Hasta...</option>
            {HOUR_OPTIONS.map((h) => (
              <option key={h} value={h}>
                {String(h).padStart(2, "0")}:00
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Recordatorio por defecto
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Se precarga al crear un evento nuevo (lo podés cambiar igual en cada uno).
        </p>
        <select
          value={defaultReminder}
          onChange={(e) => setDefaultReminder(e.target.value)}
          className={INPUT_CLASS}
        >
          {REMINDER_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
      >
        Guardar
      </button>
      {message && <p className="text-xs text-gray-500 dark:text-gray-400">{message}</p>}
    </div>
  );
}
