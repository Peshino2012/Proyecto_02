"use client";

import { useEffect, useState } from "react";

const INPUT_CLASS =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400";

export default function AccountSettings() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMessage, setNameMessage] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ text: string; ok: boolean } | null>(
    null
  );

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
         
        setName(data.account?.name ?? "");
        setEmail(data.account?.email ?? "");
      });
  }, []);

  async function handleSaveName(e: React.FormEvent) {
    e.preventDefault();
    setNameSaving(true);
    setNameMessage(null);
    const res = await fetch("/api/account", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setNameSaving(false);
    setNameMessage(res.ok ? "Guardado." : "No se pudo guardar.");
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage(null);
    const res = await fetch("/api/account/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    setPasswordSaving(false);
    if (res.ok) {
      setPasswordMessage({ text: "Contraseña actualizada.", ok: true });
      setCurrentPassword("");
      setNewPassword("");
    } else {
      setPasswordMessage({ text: data.error ?? "No se pudo cambiar.", ok: false });
    }
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
      <form onSubmit={handleSaveName} className="space-y-2">
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
          <input value={email} disabled className={`${INPUT_CLASS} opacity-60`} />
        </div>
        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Nombre</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={INPUT_CLASS}
            />
            <button
              type="submit"
              disabled={nameSaving}
              className="shrink-0 rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Guardar
            </button>
          </div>
          {nameMessage && (
            <p className="text-xs text-gray-500 dark:text-gray-400">{nameMessage}</p>
          )}
        </div>
      </form>

      <hr className="border-gray-100 dark:border-gray-800" />

      <form onSubmit={handleChangePassword} className="space-y-2">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Cambiar contraseña
        </p>
        <input
          type="password"
          required
          placeholder="Contraseña actual"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={INPUT_CLASS}
        />
        <input
          type="password"
          required
          minLength={8}
          placeholder="Nueva contraseña (mínimo 8 caracteres)"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={INPUT_CLASS}
        />
        <button
          type="submit"
          disabled={passwordSaving}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Actualizar contraseña
        </button>
        {passwordMessage && (
          <p
            className={`text-xs ${
              passwordMessage.ok
                ? "text-green-600 dark:text-green-400"
                : "text-red-600 dark:text-red-400"
            }`}
          >
            {passwordMessage.text}
          </p>
        )}
      </form>
    </div>
  );
}
