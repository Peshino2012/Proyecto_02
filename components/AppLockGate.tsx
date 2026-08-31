"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import { startAuthentication } from "@simplewebauthn/browser";

type LockState = "checking" | "locked" | "open";

export default function AppLockGate({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [lock, setLock] = useState<LockState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Si el usuario tiene el bloqueo activado, para saber si hay que volver a
  // pedir la huella cuando la app vuelve a primer plano.
  const requiredRef = useRef(false);

  async function attemptUnlock() {
    setBusy(true);
    setError(null);
    try {
      const optionsRes = await fetch("/api/webauthn/auth-options");
      if (!optionsRes.ok) throw new Error("no options");
      const options = await optionsRes.json();
      const assertion = await startAuthentication(options);
      const verifyRes = await fetch("/api/webauthn/auth-verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(assertion),
      });
      if (!verifyRes.ok) throw new Error("no verified");
      setLock("open");
    } catch {
      setError("No se pudo verificar. Probá de nuevo.");
    }
    setBusy(false);
  }

  useEffect(() => {
    if (status === "loading") return;

    if (status !== "authenticated") {
      // Páginas públicas (login/registro): nada que bloquear.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- refleja el estado de sesión, no hay bloqueo posible sin sesión
      setLock("open");
      return;
    }

    let cancelled = false;
    fetch("/api/webauthn/status")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const required =
          !!data?.requireBiometricAppLock && (data?.credentials?.length ?? 0) > 0;
        requiredRef.current = required;
        if (!required) {
          setLock("open");
          return;
        }
        setLock("locked");
        attemptUnlock();
      })
      .catch(() => {
        if (!cancelled) setLock("open");
      });
    return () => {
      cancelled = true;
    };
  }, [status]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState === "visible" && requiredRef.current) {
        setLock("locked");
        attemptUnlock();
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  if (lock === "checking") {
    return <div className="fixed inset-0 z-[100] bg-gray-50 dark:bg-gray-950" />;
  }

  if (lock === "locked") {
    return (
      <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-4 bg-gray-50 px-6 dark:bg-gray-950">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-indigo-100 text-3xl dark:bg-indigo-500/15">
          🔒
        </div>
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Verificá tu identidad para entrar a Calendario.
        </p>
        {error && <p className="text-center text-xs text-red-500 dark:text-red-400">{error}</p>}
        <button
          onClick={attemptUnlock}
          disabled={busy}
          className="rounded-full bg-indigo-600 px-6 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          {busy ? "Verificando..." : "Desbloquear con huella"}
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
