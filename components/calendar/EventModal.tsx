"use client";

import { useState } from "react";
import type { CalendarEvent } from "@/lib/types";

const COLORS = [
  "#4f46e5",
  "#0ea5e9",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#9333ea",
];

const REMINDER_OPTIONS = [
  { label: "Sin recordatorio", value: "" },
  { label: "En el momento", value: "0" },
  { label: "10 minutos antes", value: "10" },
  { label: "30 minutos antes", value: "30" },
  { label: "1 hora antes", value: "60" },
  { label: "1 día antes", value: "1440" },
];

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

type Props = {
  initialDate: Date;
  event: CalendarEvent | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function EventModal({ initialDate, event, onClose, onSaved }: Props) {
  const isEditing = !!event;

  const defaultStart = event ? toLocalInput(event.startAt) : toLocalInput(initialDate.toISOString());
  const defaultEndDate = event
    ? new Date(event.endAt)
    : new Date(initialDate.getTime() + 60 * 60 * 1000);

  const [title, setTitle] = useState(event?.title ?? "");
  const [description, setDescription] = useState(event?.description ?? "");
  const [location, setLocation] = useState(event?.location ?? "");
  const [startAt, setStartAt] = useState(defaultStart);
  const [endAt, setEndAt] = useState(toLocalInput(defaultEndDate.toISOString()));
  const [color, setColor] = useState(event?.color ?? COLORS[0]);
  const [reminder, setReminder] = useState(
    event?.reminderMinutesBefore != null ? String(event.reminderMinutesBefore) : ""
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload = {
      title,
      description: description || null,
      location: location || null,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      color,
      reminderMinutesBefore: reminder === "" ? null : Number(reminder),
    };

    const url = isEditing ? `/api/events/${event!.id}` : "/api/events";
    const method = isEditing ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "No se pudo guardar el evento");
      return;
    }

    onSaved();
  }

  async function handleDelete() {
    if (!event) return;
    if (!confirm("¿Borrar este evento?")) return;
    setLoading(true);
    const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
    setLoading(false);
    if (res.ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md space-y-4 rounded-2xl bg-white p-6 shadow-lg"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isEditing ? "Editar evento" : "Nuevo evento"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Título</label>
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Inicio</label>
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-medium text-gray-700">Fin</label>
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Ubicación</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Recordatorio</label>
          <select
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-gray-700">Color</label>
          <div className="flex gap-2">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`h-7 w-7 rounded-full border-2 ${
                  color === c ? "border-gray-800" : "border-transparent"
                }`}
                style={{ backgroundColor: c }}
                aria-label={`Color ${c}`}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="text-sm font-medium text-red-600 hover:underline"
              >
                Borrar
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
