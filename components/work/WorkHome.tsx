"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import ModuleModal from "./ModuleModal";
import { notifyWorkChanged } from "./useWorkAttention";
import type { WorkCounts, WorkModuleData } from "./types";

function CountChips({ counts }: { counts: WorkCounts | null }) {
  if (!counts) return <p className="text-xs text-gray-400 dark:text-gray-500">Al día</p>;
  const chips = [
    counts.overdue > 0 && {
      label: `${counts.overdue} vencido${counts.overdue > 1 ? "s" : ""}`,
      className: "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300",
    },
    counts.today > 0 && {
      label: `${counts.today} para hoy`,
      className: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
    counts.newItems > 0 && {
      label: `${counts.newItems} nuevo${counts.newItems > 1 ? "s" : ""}`,
      className: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
    },
  ].filter(Boolean) as { label: string; className: string }[];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-xs text-gray-500 dark:text-gray-400">
        {counts.pending === 0 ? "Sin pendientes" : `${counts.pending} pendiente${counts.pending > 1 ? "s" : ""}`}
      </span>
      {chips.map((c) => (
        <span key={c.label} className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${c.className}`}>
          {c.label}
        </span>
      ))}
    </div>
  );
}

export default function WorkHome() {
  const router = useRouter();
  const [modules, setModules] = useState<WorkModuleData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/work/modules");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setModules(data.modules);
      setError(null);
    } catch {
      setError("No se pudieron cargar los módulos. Revisá la conexión y recargá la página.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial
    load();
  }, [load]);

  async function seed() {
    setSeeding(true);
    const res = await fetch("/api/work/seed", { method: "POST" });
    setSeeding(false);
    if (!res.ok) {
      setError("No se pudieron crear los módulos.");
      return;
    }
    notifyWorkChanged();
    load();
  }

  return (
    <div className="mx-auto w-full max-w-5xl flex-1 p-3 sm:p-4 md:p-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100">Trabajo</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Un módulo por proyecto, separado de tu calendario personal.
            </p>
          </div>
          {modules.length > 0 && (
            <button
              onClick={() => setCreating(true)}
              className="shrink-0 whitespace-nowrap rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 dark:bg-indigo-500"
            >
              + Módulo
            </button>
          )}
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}
        {loading && <p className="text-sm text-gray-400 dark:text-gray-500">Cargando…</p>}

        {!loading && !error && modules.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
            <p className="text-3xl">💼</p>
            <h2 className="mt-2 font-medium text-gray-900 dark:text-gray-100">Todavía no hay módulos</h2>
            <p className="mx-auto mt-1 max-w-sm text-sm text-gray-500 dark:text-gray-400">
              Creá los de tus proyectos actuales (Mercado Libre, Hackathons, Prospectos y TPT, Apps y
              Tiendanube) con sus primeros pendientes, o armá uno desde cero.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button
                onClick={seed}
                disabled={seeding}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500"
              >
                Crear mis módulos
              </button>
              <button
                onClick={() => setCreating(true)}
                className="rounded-full border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Uno desde cero
              </button>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((m) => (
            <Link
              key={m.id}
              href={`/trabajo/${m.id}`}
              className="group relative overflow-hidden rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 transition hover:shadow-md hover:ring-gray-900/10 dark:bg-gray-900 dark:ring-white/10 dark:hover:ring-white/20"
            >
              <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: m.color }} aria-hidden />
              <div className="flex items-start gap-3">
                <span
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl"
                  style={{ backgroundColor: `${m.color}1f` }}
                >
                  {m.icon}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-medium text-gray-900 dark:text-gray-100">{m.name}</h2>
                    {m.counts && m.counts.attention > 0 && (
                      <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1.5 text-[11px] font-semibold text-white">
                        {m.counts.attention}
                      </span>
                    )}
                  </div>
                  {m.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-gray-500 dark:text-gray-400">{m.description}</p>
                  )}
                  <div className="mt-2">
                    <CountChips counts={m.counts} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {creating && (
        <ModuleModal
          module={null}
          onClose={() => setCreating(false)}
          onSaved={(id) => {
            setCreating(false);
            if (id) router.push(`/trabajo/${id}`);
            else load();
          }}
        />
      )}
    </div>
  );
}
