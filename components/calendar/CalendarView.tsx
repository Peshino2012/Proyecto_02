"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import type { CalendarEvent } from "@/lib/types";
import EventModal from "./EventModal";

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEKDAYS_MOBILE = ["L", "M", "M", "J", "V", "S", "D"];

export default function CalendarView() {
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [modalState, setModalState] = useState<
    | { open: false }
    | { open: true; date: Date; event: CalendarEvent | null }
  >({ open: false });
  const [defaultReminderMinutes, setDefaultReminderMinutes] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/account")
      .then((r) => r.json())
      .then((data) => {
         
        setDefaultReminderMinutes(data.account?.defaultReminderMinutes ?? null);
      })
      .catch(() => {});
  }, []);

  const { gridStart, gridEnd } = useMemo(() => {
    return {
      gridStart: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      gridEnd: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    };
  }, [month]);

  const days = useMemo(
    () => eachDayOfInterval({ start: gridStart, end: gridEnd }),
    [gridStart, gridEnd]
  );

  const loadEvents = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/events?from=${gridStart.toISOString()}&to=${gridEnd.toISOString()}`
    );
    if (res.ok) {
      const data = await res.json();
      setEvents(data.events);
    }
    setLoading(false);
  }, [gridStart, gridEnd]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga de datos al cambiar de mes
    loadEvents();
  }, [loadEvents]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = format(new Date(ev.startAt), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(ev);
      map.set(key, list);
    }
    return map;
  }, [events]);

  const selectedKey = format(selectedDay, "yyyy-MM-dd");
  const selectedEvents = (eventsByDay.get(selectedKey) ?? []).sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  function openNewEvent(day: Date) {
    const withCurrentTime = new Date(day);
    const now = new Date();
    withCurrentTime.setHours(now.getHours(), now.getMinutes(), 0, 0);
    setModalState({ open: true, date: withCurrentTime, event: null });
  }

  function openEditEvent(ev: CalendarEvent) {
    setModalState({ open: true, date: new Date(ev.startAt), event: ev });
  }

  function closeModal() {
    setModalState({ open: false });
  }

  function handleSaved() {
    closeModal();
    loadEvents();
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-3 sm:p-4 md:flex-row md:gap-6 md:p-6">
      <div className="flex-1 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-gray-900/5 sm:p-6 dark:bg-gray-900 dark:ring-white/10">
        <div className="mb-4 flex items-center justify-between sm:mb-5">
          <h2 className="text-lg font-medium capitalize tracking-tight text-gray-900 sm:text-xl dark:text-gray-100">
            {format(month, "MMMM yyyy", { locale: es })}
          </h2>
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              aria-label="Mes anterior"
            >
              ←
            </button>
            <button
              onClick={() => {
                const today = new Date();
                setMonth(today);
                setSelectedDay(today);
              }}
              className="rounded-full border border-gray-200 px-3 py-1.5 text-sm text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
            >
              Hoy
            </button>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              aria-label="Mes siguiente"
            >
              →
            </button>
            <button
              onClick={() => openNewEvent(selectedDay)}
              className="ml-1 hidden rounded-full bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white shadow-sm transition-shadow hover:bg-indigo-700 hover:shadow-md sm:ml-2 sm:inline-block dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              + Evento
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
            const dayEvents = eventsByDay.get(key) ?? [];
            const inMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, selectedDay);

            return (
              <button
                key={key}
                onClick={() => setSelectedDay(day)}
                onDoubleClick={() => openNewEvent(day)}
                className={`flex min-h-14 flex-col items-center gap-1 p-1 text-left transition-colors sm:min-h-20 sm:items-start sm:p-1.5 md:min-h-[88px] md:p-2 ${
                  inMonth
                    ? "bg-white hover:bg-gray-50 dark:bg-gray-900 dark:hover:bg-gray-800/60"
                    : "bg-gray-50/50 text-gray-300 hover:bg-gray-50 dark:bg-gray-900/40 dark:text-gray-600 dark:hover:bg-gray-800/40"
                } ${
                  isSelected && !isToday
                    ? "bg-indigo-50/70 hover:bg-indigo-50 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/15"
                    : ""
                }`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-indigo-600 font-medium text-white dark:bg-indigo-500"
                      : inMonth
                        ? "text-gray-700 dark:text-gray-300"
                        : "text-gray-300 dark:text-gray-600"
                  }`}
                >
                  {format(day, "d")}
                </span>

                {/* Mobile: puntos de color por evento, más legibles en celdas chicas */}
                <div className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                  {dayEvents.slice(0, 4).map((ev) => (
                    <span
                      key={ev.id}
                      className="h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: ev.color }}
                    />
                  ))}
                </div>

                {/* Desktop/tablet: chips con texto */}
                <div className="hidden w-full flex-col gap-1 overflow-hidden sm:flex">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className="flex items-center gap-1 truncate rounded-md px-1.5 py-0.5 text-[10.5px] font-medium"
                      style={{ backgroundColor: `${ev.color}17`, color: ev.color }}
                    >
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: ev.color }}
                      />
                      <span className="truncate">{ev.title}</span>
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="pl-1 text-[10px] text-gray-400 dark:text-gray-500">
                      +{dayEvents.length - 3} más
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {loading && (
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">Cargando…</p>
        )}
        <p className="mt-3 hidden text-xs text-gray-400 sm:block dark:text-gray-500">
          Doble clic en un día para crear un evento rápido.
        </p>
      </div>

      <div className="w-full rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 sm:p-5 md:w-80 dark:bg-gray-900 dark:ring-white/10">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-medium capitalize tracking-tight text-gray-900 dark:text-gray-100">
            {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
          </h3>
          <button
            onClick={() => openNewEvent(selectedDay)}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
          >
            + Agregar
          </button>
        </div>

        {selectedEvents.length === 0 && (
          <p className="text-sm text-gray-400 dark:text-gray-500">Sin eventos este día.</p>
        )}

        <ul className="space-y-1.5">
          {selectedEvents.map((ev) => (
            <li key={ev.id}>
              <button
                onClick={() => openEditEvent(ev)}
                className="w-full rounded-xl p-3 text-left ring-1 ring-gray-900/5 transition-colors hover:bg-gray-50 hover:ring-gray-900/10 dark:ring-white/10 dark:hover:bg-gray-800 dark:hover:ring-white/20"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ev.color }}
                  />
                  <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {ev.title}
                  </span>
                </div>
                <p className="ml-4.5 text-xs text-gray-500 dark:text-gray-400">
                  {format(new Date(ev.startAt), "HH:mm")} –{" "}
                  {format(new Date(ev.endAt), "HH:mm")}
                  {ev.location ? ` · ${ev.location}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Botón flotante para crear evento en mobile (thumb-reachable, por arriba de la bottom nav) */}
      <button
        onClick={() => openNewEvent(selectedDay)}
        aria-label="Nuevo evento"
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-600 text-2xl font-light text-white shadow-lg transition-transform hover:bg-indigo-700 active:scale-95 sm:hidden dark:bg-indigo-500 dark:hover:bg-indigo-400"
      >
        +
      </button>

      {modalState.open && (
        <EventModal
          initialDate={modalState.date}
          event={modalState.event}
          onClose={closeModal}
          onSaved={handleSaved}
          defaultReminderMinutes={defaultReminderMinutes}
        />
      )}
    </div>
  );
}
