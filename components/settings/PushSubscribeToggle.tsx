"use client";

import { useEffect, useState } from "react";
import {
  getPushSubscriptionStatus,
  subscribeToPush,
  unsubscribeFromPush,
} from "@/lib/push-client";

export default function PushSubscribeToggle() {
  const [subscribed, setSubscribed] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getPushSubscriptionStatus().then(setSubscribed);
  }, []);

  async function handleToggle() {
    setLoading(true);
    setMessage(null);

    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
    } else {
      const result = await subscribeToPush();
      if (result === "subscribed") {
        setSubscribed(true);
      } else if (result === "denied") {
        setMessage("Bloqueaste los permisos de notificación en el navegador.");
      } else if (result === "server-error") {
        setMessage(
          "No se pudo guardar la suscripción en el servidor. Probá de nuevo en unos segundos."
        );
      } else {
        setMessage("Este navegador no soporta notificaciones push.");
      }
    }

    setLoading(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between rounded-xl p-3 ring-1 ring-gray-900/5 dark:ring-white/10">
        <div>
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Notificaciones push
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Avisos en este dispositivo antes de cada evento con recordatorio.
          </p>
        </div>
        <button
          onClick={handleToggle}
          disabled={loading || subscribed === null}
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${
            subscribed
              ? "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
              : "bg-indigo-600 text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
          } disabled:opacity-60`}
        >
          {subscribed ? "Desactivar" : "Activar"}
        </button>
      </div>
      {message && (
        <p className="text-xs text-amber-600 dark:text-amber-400">{message}</p>
      )}
    </div>
  );
}
