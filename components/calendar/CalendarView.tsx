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

export default function CalendarView() {
  const [month, setMonth] = useState(() => new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<Date>(() => new Date());
  const [modalState, setModalState] = useState<
    | { open: false }
    | { open: true; date: Date; event: CalendarEvent | null }
  >({ open: false });

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
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
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 p-4 md:flex-row">
      <div className="flex-1 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold capitalize">
            {format(month, "MMMM yyyy", { locale: es })}
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
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
              className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
            >
              Hoy
            </button>
            <button
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="rounded-md border border-gray-300 px-2 py-1 text-sm hover:bg-gray-50"
              aria-label="Mes siguiente"
            >
              →
            </button>
            <button
              onClick={() => openNewEvent(selectedDay)}
              className="ml-2 rounded-md bg-indigo-600 px-3 py-1 text-sm font-medium text-white hover:bg-indigo-700"
            >
              + Evento
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg bg-gray-200 text-xs font-medium text-gray-500">
          {WEEKDAYS.map((d) => (
            <div key={d} className="bg-gray-50 px-2 py-1 text-center">
              {d}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-b-lg bg-gray-200">
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
                className={`flex min-h-20 flex-col items-start gap-1 bg-white p-1.5 text-left align-top ${
                  inMonth ? "" : "bg-gray-50 text-gray-400"
                } ${isSelected ? "ring-2 ring-indigo-500 ring-inset" : ""}`}
              >
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                    isToday ? "bg-indigo-600 text-white" : ""
                  }`}
                >
                  {format(day, "d")}
                </span>
                <div className="flex w-full flex-col gap-0.5 overflow-hidden">
                  {dayEvents.slice(0, 3).map((ev) => (
                    <span
                      key={ev.id}
                      className="truncate rounded px-1 py-0.5 text-[10px] text-white"
                      style={{ backgroundColor: ev.color }}
                    >
                      {ev.title}
                    </span>
                  ))}
                  {dayEvents.length > 3 && (
                    <span className="text-[10px] text-gray-500">
                      +{dayEvents.length - 3} más
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {loading && <p className="mt-2 text-xs text-gray-400">Cargando…</p>}
        <p className="mt-2 text-xs text-gray-400">
          Doble clic en un día para crear un evento rápido.
        </p>
      </div>

      <div className="w-full rounded-2xl border border-gray-200 bg-white p-4 shadow-sm md:w-80">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="font-semibold capitalize">
            {format(selectedDay, "EEEE d 'de' MMMM", { locale: es })}
          </h3>
          <button
            onClick={() => openNewEvent(selectedDay)}
            className="text-sm font-medium text-indigo-600 hover:underline"
          >
            + Agregar
          </button>
        </div>

        {selectedEvents.length === 0 && (
          <p className="text-sm text-gray-400">Sin eventos este día.</p>
        )}

        <ul className="space-y-2">
          {selectedEvents.map((ev) => (
            <li key={ev.id}>
              <button
                onClick={() => openEditEvent(ev)}
                className="w-full rounded-lg border border-gray-200 p-2 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: ev.color }}
                  />
                  <span className="text-sm font-medium">{ev.title}</span>
                </div>
                <p className="ml-4.5 text-xs text-gray-500">
                  {format(new Date(ev.startAt), "HH:mm")} –{" "}
                  {format(new Date(ev.endAt), "HH:mm")}
                  {ev.location ? ` · ${ev.location}` : ""}
                </p>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {modalState.open && (
        <EventModal
          initialDate={modalState.date}
          event={modalState.event}
          onClose={closeModal}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
