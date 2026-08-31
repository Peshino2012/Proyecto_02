"use client";

import { useEffect, useState } from "react";
import { browserSupportsWebAuthn, startRegistration } from "@simplewebauthn/browser";

type Credential = { id: string; deviceLabel: string | null; createdAt: string };

export default function BiometricSettings() {
  const [supported, setSupported] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/webauthn/status");
    if (res.ok) {
      const data = await res.json();
      setEnabled(data.requireBiometricAppLock);
      setCredentials(data.credentials);
    }
    setLoaded(true);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- detección de soporte del navegador, solo al montar
    setSupported(browserSupportsWebAuthn());
    load();
  }, []);

  async function handleRegister() {
    setBusy(true);
    setMessage(null);

    const optionsRes = await fetch("/api/webauthn/register-options");
    if (!optionsRes.ok) {
      setMessage("No se pudo iniciar el registro.");
      setBusy(false);
      return;
    }
    const options = await optionsRes.json();

    try {
      const attestation = await startRegistration(options);
      const verifyRes = await fetch("/api/webauthn/register-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...attestation, deviceLabel: guessDeviceLabel() }),
      });
      if (!verifyRes.ok) {
        const data = await verifyRes.json().catch(() => ({}));
        setMessage(data.error ?? "No se pudo registrar el dispositivo.");
      } else {
        setMessage("Dispositivo registrado.");
        await load();
      }
    } catch {
      setMessage("Se canceló o falló el registro de huella/Face ID.");
    }
    setBusy(false);
  }

  async function handleRemove(id: string) {
    if (!confirm("¿Quitar este dispositivo?")) return;
    setBusy(true);
    await fetch(`/api/webauthn/credentials/${id}`, { method: "DELETE" });
    await load();
    setBusy(false);
  }

  async function handleToggle() {
    const next = !enabled;
    setBusy(true);
    setMessage(null);
    const res = await fetch("/api/webauthn/status", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requireBiometricAppLock: next }),
    });
    if (res.ok) {
      setEnabled(next);
    } else {
      const data = await res.json().catch(() => ({}));
      setMessage(data.error ?? "No se pudo guardar.");
    }
    setBusy(false);
  }

  if (!loaded) return null;

  if (!supported) {
    return (
      <div className="rounded-xl p-3 text-sm text-gray-500 ring-1 ring-gray-900/5 dark:text-gray-400 dark:ring-white/10">
        Este navegador no soporta huella/Face ID (WebAuthn).
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Bloquear la app con huella / Face ID
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Como Mercado Pago: pide verificación biométrica cada vez que abrís la app o volvés a
          ella, sin importar por dónde entraste (ícono, atajo o pantalla de bloqueo).
        </p>
      </div>

      {credentials.length > 0 && (
        <ul className="space-y-1">
          {credentials.map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm dark:bg-gray-800"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {c.deviceLabel ?? "Dispositivo"}
              </span>
              <button
                onClick={() => handleRemove(c.id)}
                disabled={busy}
                className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={handleRegister}
          disabled={busy}
          className="rounded-md bg-gray-100 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 disabled:opacity-60 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
        >
          Registrar este dispositivo
        </button>

        {credentials.length > 0 && (
          <button
            onClick={handleToggle}
            disabled={busy}
            role="switch"
            aria-checked={enabled}
            className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-60 ${
              enabled ? "bg-indigo-600 dark:bg-indigo-500" : "bg-gray-200 dark:bg-gray-700"
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                enabled ? "translate-x-5" : "translate-x-0.5"
              }`}
            />
          </button>
        )}
      </div>

      {message && <p className="text-xs text-gray-500 dark:text-gray-400">{message}</p>}
    </div>
  );
}

function guessDeviceLabel(): string {
  if (typeof navigator === "undefined") return "Dispositivo";
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad/i.test(ua)) return "iPhone/iPad";
  return "Este dispositivo";
}
