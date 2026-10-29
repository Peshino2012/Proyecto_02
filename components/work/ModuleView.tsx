"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import ModuleModal from "./ModuleModal";
import WorkChat, { capitalize } from "./WorkChat";
import WorkItemModal from "./WorkItemModal";
import { notifyWorkChanged } from "./useWorkAttention";
import { KIND_LABELS, type WorkItemData, type WorkItemStatus, type WorkModuleData } from "./types";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEKDAYS_MOBILE = ["L", "M", "M", "J", "V", "S", "D"];

type Tab = "calendario" | "pendientes" | "chat";

// Una sola vista montada a la vez (celular o compu), así el chat no se carga dos veces.
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 768px)");
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return isDesktop;
}

function statusColor(status: WorkItemStatus, moduleColor: string) {
  if (status === "overdue") return "#dc2626";
  if (status === "today") return "#d97706";
  if (status === "done") return "#9ca3af";
  return moduleColor;
}

function whenLabel(item: WorkItemData) {
  if (!item.date) return "Sin fecha";
  const day = format(new Date(`${item.date}T00:00:00`), "EEE d MMM", { locale: es });
  return item.time ? `${day} · ${item.time}` : day;
}

function ItemRow({
  item,
  color,
  onToggle,
  onOpen,
}: {
  item: WorkItemData;
  color: string;
  onToggle: (item: WorkItemData) => void;
  onOpen: (item: WorkItemData) => void;
}) {
  const isEvent = item.kind === "EVENT";
  return (
    <li className="flex items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-gray-50 dark:hover:bg-gray-800/60">
      {isEvent ? (
        <span
          className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color }}
          aria-hidden
        />
      ) : (
        <button
          onClick={() => onToggle(item)}
          aria-label={item.done ? "Marcar como no hecho" : "Marcar como hecho"}
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors ${
            item.done
              ? "border-indigo-600 bg-indigo-600 text-white dark:border-indigo-500 dark:bg-indigo-500"
              : "border-gray-300 text-transparent hover:border-indigo-400 dark:border-gray-600"
          }`}
        >
          ✓
        </button>
      )}
      <button onClick={() => onOpen(item)} className="min-w-0 flex-1 text-left">
        <span className="flex flex-wrap items-center gap-1.5">
          <span
            className={`text-sm ${
              item.done ? "text-gray-400 line-through dark:text-gray-500" : "text-gray-800 dark:text-gray-100"
            }`}
          >
            {item.kind === "DEADLINE" && "⚑ "}
            {item.title}
          </span>
          {item.isNew && (
            <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              Nuevo
            </span>
          )}
        </span>
        <span className="block text-xs" style={{ color: item.status === "overdue" || item.status === "today" ? statusColor(item.status, color) : undefined }}>
          <span className={item.status === "overdue" || item.status === "today" ? "font-medium" : "text-gray-400 dark:text-gray-500"}>
            {item.status === "overdue" ? "Vencido · " : item.status === "today" ? "Hoy · " : ""}
            {whenLabel(item)}
            {isEvent ? ` · ${KIND_LABELS.EVENT}` : ""}
          </span>
        </span>
        {item.notes && (
          <span className="mt-0.5 line-clamp-2 block text-xs text-gray-500 dark:text-gray-400">{item.notes}</span>
        )}
      </button>
    </li>
  );
}

export default function ModuleView({ moduleId }: { moduleId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mod, setMod] = useState<WorkModuleData | null>(null);
  const [items, setItems] = useState<WorkItemData[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [month, setMonth] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState(() => new Date());
  const [tab, setTab] = useState<Tab>(() => (searchParams.get("tab") === "chat" ? "chat" : "calendario"));
  const [sideTab, setSideTab] = useState<"pendientes" | "chat">(() =>
    searchParams.get("tab") === "chat" ? "chat" : "pendientes"
  );
  const [itemModal, setItemModal] = useState<
    { open: false } | { open: true; item: WorkItemData | null; date: string | null }
  >({ open: false });
  const [editingModule, setEditingModule] = useState(false);
  const isDesktop = useIsDesktop();

  const { gridStart, gridEnd } = useMemo(
    () => ({
      gridStart: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      gridEnd: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    }),
    [month]
  );
  const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

  const loadModule = useCallback(async () => {
    const res = await fetch(`/api/work/modules/${moduleId}`);
    if (res.status === 404) {
      router.replace("/trabajo");
      return;
    }
    if (!res.ok) {
      setError("No se pudo cargar el módulo. Revisá la conexión y recargá la página.");
      return;
    }
    const data = await res.json();
    setMod(data.module);
  }, [moduleId, router]);

  const loadItems = useCallback(async () => {
    const res = await fetch(
      `/api/work/items?moduleId=${moduleId}&from=${gridStart.toISOString()}&to=${gridEnd.toISOString()}`
    );
    if (!res.ok) {
      setError("No se pudieron cargar los pendientes. Revisá la conexión y recargá la página.");
      return;
    }
    const data = await res.json();
    setItems(data.items);
    setError(null);
  }, [moduleId, gridStart, gridEnd]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del módulo
    loadModule();
  }, [loadModule]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de ítems al cambiar de mes
    loadItems();
  }, [loadItems]);

  // Lo nuevo de Claude se muestra como "Nuevo" en esta visita y queda visto.
  useEffect(() => {
    fetch("/api/work/seen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId }),
    })
      .then(() => notifyWorkChanged())
      .catch(() => {});
  }, [moduleId]);

  const color = mod?.color ?? "#4f46e5";

  const itemsByDay = useMemo(() => {
    const map = new Map<string, WorkItemData[]>();
    for (const item of items) {
      if (!item.date) continue;
      const list = map.get(item.date) ?? [];
      list.push(item);
      map.set(item.date, list);
    }
    return map;
  }, [items]);

  const groups = useMemo(() => {
    const pending = items.filter((i) => !i.done && i.kind !== "EVENT");
    const todayKey = format(new Date(), "yyyy-MM-dd");
    return [
      { title: "Vencidos", items: pending.filter((i) => i.status === "overdue") },
      { title: "Hoy", items: pending.filter((i) => i.status === "today") },
      { title: "Próximos", items: pending.filter((i) => i.status === "upcoming") },
      { title: "Sin fecha", items: pending.filter((i) => i.status === "undated") },
      {
        title: "Eventos",
        items: items.filter((i) => i.kind === "EVENT" && i.date && i.date >= todayKey),
      },
    ].filter((g) => g.items.length > 0);
  }, [items]);

  const selectedKey = format(selectedDay, "yyyy-MM-dd");
  const selectedItems = itemsByDay.get(selectedKey) ?? [];

  async function toggleDone(item: WorkItemData) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, done: !i.done, status: !i.done ? "done" : i.status } : i)));
    const res = await fetch(`/api/work/items/${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ done: !item.done }),
    });
    if (!res.ok) setError("No se pudo guardar. Probá de nuevo.");
    loadItems();
    notifyWorkChanged();
  }

  const openItem = (item: WorkItemData) => setItemModal({ open: true, item, date: item.date });
  const newItem = (date: string | null) => setItemModal({ open: true, item: null, date });

  const calendar = (
    <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-900/5 sm:p-5 dark:bg-gray-900 dark:ring-white/10">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-medium capitalize tracking-tight text-gray-900 dark:text-gray-100">
          {format(month, "MMMM yyyy", { locale: es })}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Mes anterior"
          >
            ←
          </button>
          <button
            onClick={() => {
              setMonth(new Date());
              setSelectedDay(new Date());
            }}
            className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Hoy
          </button>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            aria-label="Mes siguiente"
          >
            →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 border-b border-gray-100 pb-2 text-xs font-medium text-gray-400 dark:border-gray-800 dark:text-gray-500">
        {WEEKDAYS.map((d, i) => (
          <div key={d} className="text-center">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{WEEKDAYS_MOBILE[i]}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 divide-x divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 dark:divide-gray-800 dark:border-gray-800">
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayItems = itemsByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          const isToday = isSameDay(day, new Date());
          const isSelected = isSameDay(day, selectedDay);
          return (
            <button
              key={key}
              onClick={() => setSelectedDay(day)}
              onDoubleClick={() => newItem(key)}
              className={`relative flex min-h-14 flex-col items-center gap-1 p-1 text-left sm:min-h-20 sm:items-start sm:p-1.5 ${
                inMonth
                  ? "bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/60"
                  : "bg-gray-50/50 text-gray-300 dark:bg-gray-900/40 dark:text-gray-600"
              } ${isSelected && !isToday ? "bg-indigo-50/70 dark:bg-indigo-500/10" : ""}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
                  isToday
                    ? "text-white"
                    : inMonth
                      ? "text-gray-700 dark:text-gray-300"
                      : "text-gray-300 dark:text-gray-600"
                }`}
                style={isToday ? { backgroundColor: color } : undefined}
              >
                {format(day, "d")}
              </span>
              <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                {dayItems.slice(0, 4).map((i) => (
                  <span
                    key={i.id}
                    className="h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: statusColor(i.status, color) }}
                  />
                ))}
              </div>
              <div className="hidden w-full flex-col gap-1 overflow-hidden sm:flex">
                {dayItems.slice(0, 3).map((i) => (
                  <span
                    key={i.id}
                    className={`truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${i.done ? "line-through" : ""}`}
                    style={{
                      backgroundColor: `${statusColor(i.status, color)}1a`,
                      color: statusColor(i.status, color),
                    }}
                  >
                    {i.kind === "DEADLINE" ? "⚑ " : ""}
                    {i.title}
                  </span>
                ))}
                {dayItems.length > 3 && (
                  <span className="pl-1 text-[10px] text-gray-400">+{dayItems.length - 3} más</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 border-t border-gray-100 pt-3 dark:border-gray-800">
        <div className="mb-1 flex items-center justify-between">
          <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {capitalize(format(selectedDay, "EEEE d 'de' MMMM", { locale: es }))}
          </h3>
          <button
            onClick={() => newItem(selectedKey)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
          >
            + Agregar
          </button>
        </div>
        {selectedItems.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500">Nada este día.</p>
        ) : (
          <ul>
            {selectedItems.map((i) => (
              <ItemRow key={i.id} item={i} color={color} onToggle={toggleDone} onOpen={openItem} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );

  const pendingList = (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-medium text-gray-900 dark:text-gray-100">Pendientes</h2>
        <button
          onClick={() => newItem(null)}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
        >
          + Pendiente
        </button>
      </div>
      {groups.length === 0 && <p className="text-sm text-gray-400 dark:text-gray-500">Todo al día. 🎉</p>}
      {groups.map((g) => (
        <section key={g.title}>
          <h3
            className={`mb-1 text-xs font-semibold uppercase tracking-wide ${
              g.title === "Vencidos"
                ? "text-red-600 dark:text-red-400"
                : g.title === "Hoy"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-gray-400 dark:text-gray-500"
            }`}
          >
            {g.title} · {g.items.length}
          </h3>
          <ul>
            {g.items.map((i) => (
              <ItemRow key={i.id} item={i} color={color} onToggle={toggleDone} onOpen={openItem} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );

  const chat = mod && (
    <WorkChat moduleId={moduleId} accentColor={color} items={items} onProposalApplied={loadItems} />
  );

  const tabButton = (value: Tab, label: string) => (
    <button
      key={value}
      onClick={() => setTab(value)}
      className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
        tab === value
          ? "bg-white text-gray-900 shadow-sm dark:bg-gray-800 dark:text-gray-100"
          : "text-gray-500 dark:text-gray-400"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-3 sm:p-4 md:p-6">
      <div className="flex items-start gap-3">
        <Link
          href="/trabajo"
          className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          aria-label="Volver a Trabajo"
        >
          ←
        </Link>
        {mod && (
          <>
            <span
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-2xl"
              style={{ backgroundColor: `${color}1f` }}
            >
              {mod.icon}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-medium tracking-tight text-gray-900 dark:text-gray-100">{mod.name}</h1>
              {mod.description && (
                <p className="line-clamp-2 text-sm text-gray-500 md:line-clamp-none dark:text-gray-400">{mod.description}</p>
              )}
            </div>
            <button
              onClick={() => setEditingModule(true)}
              className="rounded-full px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
            >
              Editar
            </button>
          </>
        )}
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">{error}</p>
      )}

      {/* Celular: pestañas. Compu: calendario a la izquierda, pendientes/chat a la derecha. */}
      {!isDesktop ? (
        <>
          <div className="flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-900">
            {tabButton("calendario", "Calendario")}
            {tabButton("pendientes", "Pendientes")}
            {tabButton("chat", "Chat")}
          </div>
          {tab === "calendario" && calendar}
          {tab === "pendientes" && (
            <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
              {pendingList}
            </div>
          )}
          {tab === "chat" && (
            <div className="flex h-[calc(100dvh-20rem)] flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
              {chat}
            </div>
          )}
        </>
      ) : (
        <div className="flex gap-6">
          <div className="flex-1">{calendar}</div>
          <div className="flex h-[calc(100vh-11rem)] w-96 flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
            <div className="mb-3 flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800/60">
              {(["pendientes", "chat"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setSideTab(v)}
                  className={`flex-1 rounded-full px-3 py-1.5 text-sm font-medium ${
                    sideTab === v
                      ? "bg-white text-gray-900 shadow-sm dark:bg-gray-900 dark:text-gray-100"
                      : "text-gray-500 dark:text-gray-400"
                  }`}
                >
                  {v === "pendientes" ? "Pendientes" : "Chat con Claude"}
                </button>
              ))}
            </div>
            {sideTab === "pendientes" ? (
              <div className="min-h-0 flex-1 overflow-y-auto">{pendingList}</div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col">{chat}</div>
            )}
          </div>
        </div>
      )}

      {itemModal.open && (
        <WorkItemModal
          moduleId={moduleId}
          item={itemModal.item}
          initialDate={itemModal.date}
          onClose={() => setItemModal({ open: false })}
          onSaved={() => {
            setItemModal({ open: false });
            loadItems();
          }}
        />
      )}

      {editingModule && mod && (
        <ModuleModal
          module={mod}
          onClose={() => setEditingModule(false)}
          onSaved={(id) => {
            setEditingModule(false);
            if (id) loadModule();
            else router.push("/trabajo");
          }}
        />
      )}
    </div>
  );
}
