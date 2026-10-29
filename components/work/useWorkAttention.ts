"use client";

import { useEffect, useState } from "react";

// Avisa a la barra de navegación que algo cambió en Trabajo (se tildó un
// pendiente, se leyó el chat) para que actualice el número sin esperar.
export const WORK_CHANGED_EVENT = "trabajo:cambio";

export function notifyWorkChanged() {
  window.dispatchEvent(new Event(WORK_CHANGED_EVENT));
}

/** Total de cosas que piden atención en el apartado Trabajo (se refresca solo). */
export function useWorkAttention() {
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch("/api/work/summary");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setTotal(data.total ?? 0);
      } catch {
        // Sin conexión: se deja el último número conocido.
      }
    }

    load();
    const interval = setInterval(load, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener(WORK_CHANGED_EVENT, load);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener(WORK_CHANGED_EVENT, load);
    };
  }, []);

  return total;
}
