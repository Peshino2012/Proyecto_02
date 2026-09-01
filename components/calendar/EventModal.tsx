"use client";

import { useRef, useState } from "react";
import type { CalendarEvent } from "@/lib/types";
import { EVENT_CATEGORIES } from "@/lib/categories";
import { REMINDER_OPTIONS } from "@/lib/reminders";

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  onresult: ((event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

const RECURRENCE_OPTIONS = [
  { label: "No se repite", value: "NONE" },
  { label: "Todos los días", value: "DAILY" },
  { label: "Todas las semanas", value: "WEEKLY" },
  { label: "Todos los meses", value: "MONTHLY" },
];

const INPUT_CLASS =
  "w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400";
const LABEL_CLASS = "text-sm font-medium text-gray-700 dark:text-gray-300";

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function todayLocalDateStr() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type Props = {
  initialDate: Date;
  event: CalendarEvent | null;
  onClose: () => void;
  onSaved: () => void;
  defaultReminderMinutes?: number | null;
};

export default function EventModal({
  initialDate,
  event,
  onClose,
  onSaved,
  defaultReminderMinutes,
}: Props) {
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
  const [categoryColors, setCategoryColors] = useState<string[]>(
    event?.categoryColors && event.categoryColors.length > 0
      ? event.categoryColors
      : [event?.color ?? EVENT_CATEGORIES[0].color]
  );

  function toggleCategory(color: string) {
    setCategoryColors((prev) =>
      prev.includes(color)
        ? prev.length > 1
          ? prev.filter((c) => c !== color)
          : prev
        : [...prev, color]
    );
  }
  const [reminder, setReminder] = useState(() => {
    if (event?.reminderMinutesBefore != null) return String(event.reminderMinutesBefore);
    if (!isEditing && defaultReminderMinutes != null) return String(defaultReminderMinutes);
    return "";
  });
  const [recurrence, setRecurrence] = useState(event?.recurrence ?? "NONE");
  const [recurrenceEndAt, setRecurrenceEndAt] = useState(
    event?.recurrenceEndAt ? event.recurrenceEndAt.slice(0, 10) : ""
  );
  const [countdownEnabled, setCountdownEnabled] = useState(event?.countdownFrom != null);
  const [countdownFromMode, setCountdownFromMode] = useState<"hoy" | "custom">(() =>
    event?.countdownFrom && event.countdownFrom !== todayLocalDateStr() ? "custom" : "hoy"
  );
  const [countdownFromDate, setCountdownFromDate] = useState(
    event?.countdownFrom ?? todayLocalDateStr()
  );
  const [countdownToMode, setCountdownToMode] = useState<"evento" | "custom">(() =>
    event?.countdownTo && event.countdownTo !== event.startAt.slice(0, 10) ? "custom" : "evento"
  );
  const [countdownToDate, setCountdownToDate] = useState(
    event?.countdownTo ?? defaultStart.slice(0, 10)
  );
  const [countdownTime, setCountdownTime] = useState(
    event?.countdownHour != null
      ? `${String(event.countdownHour).padStart(2, "0")}:${String(
          event.countdownMinute ?? 0
        ).padStart(2, "0")}`
      : "09:00"
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [listening, setListening] = useState(false);
  const [conflicts, setConflicts] = useState<
    { id: string; title: string; startAt: string; endAt: string }[] | null
  >(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  function toggleVoiceInput() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionCtor =
      (window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike })
        .SpeechRecognition ??
      (window as unknown as { webkitSpeechRecognition?: new () => SpeechRecognitionLike })
        .webkitSpeechRecognition;

    if (!SpeechRecognitionCtor) {
      setError("Tu navegador no soporta el dictado por voz.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = "es-AR";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      setTitle((prev) => (prev ? `${prev} ${transcript}` : transcript));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const [countdownHour, countdownMinute] = countdownTime.split(":").map(Number);
    const effectiveCountdownFrom =
      countdownFromMode === "hoy" ? todayLocalDateStr() : countdownFromDate;
    const effectiveCountdownTo = countdownToMode === "evento" ? startAt.slice(0, 10) : countdownToDate;

    const payload = {
      title,
      description: description || null,
      location: location || null,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString(),
      categoryColors,
      reminderMinutesBefore: reminder === "" ? null : Number(reminder),
      recurrence,
      recurrenceEndAt:
        recurrence !== "NONE" && recurrenceEndAt
          ? new Date(`${recurrenceEndAt}T23:59:59`).toISOString()
          : null,
      countdownFrom: countdownEnabled ? effectiveCountdownFrom : null,
      countdownTo: countdownEnabled ? effectiveCountdownTo : null,
      countdownHour: countdownEnabled ? countdownHour : null,
      countdownMinute: countdownEnabled ? countdownMinute : null,
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

    const data = await res.json().catch(() => ({}));

    if (data.conflicts?.length > 0) {
      // Ya se guardó; solo avisamos, no bloqueamos.
      setConflicts(data.conflicts);
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="max-h-[92vh] w-full space-y-4 overflow-y-auto rounded-t-2xl bg-white p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-lg sm:max-w-md sm:rounded-2xl sm:p-6 sm:pb-6 dark:bg-gray-900"
      >
        <div className="mx-auto -mt-1 mb-1 h-1.5 w-10 rounded-full bg-gray-200 sm:hidden dark:bg-gray-700" />

        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            {isEditing ? "Editar evento" : "Nuevo evento"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
            {error}
          </p>
        )}

        {conflicts && conflicts.length > 0 && (
          <div className="space-y-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
            <p className="font-medium">Se guardó, pero se superpone con:</p>
            <ul className="list-disc pl-4">
              {conflicts.map((c) => (
                <li key={c.id}>
                  {c.title} ({new Date(c.startAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  –
                  {new Date(c.endAt).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  )
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Título</label>
          <div className="flex gap-2">
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={INPUT_CLASS}
            />
            <button
              type="button"
              onClick={toggleVoiceInput}
              title="Dictar por voz"
              aria-pressed={listening}
              className={`shrink-0 rounded-md border px-3 text-sm ${
                listening
                  ? "animate-pulse border-red-400 bg-red-50 text-red-600 dark:border-red-500/40 dark:bg-red-500/10 dark:text-red-300"
                  : "border-gray-200 text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800"
              }`}
            >
              🎤
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className={LABEL_CLASS}>Inicio</label>
            <input
              type="datetime-local"
              required
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
          <div className="space-y-1">
            <label className={LABEL_CLASS}>Fin</label>
            <input
              type="datetime-local"
              required
              value={endAt}
              onChange={(e) => setEndAt(e.target.value)}
              className={INPUT_CLASS}
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Ubicación</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Descripción</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Repetir</label>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as typeof recurrence)}
            className={INPUT_CLASS}
          >
            {RECURRENCE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {recurrence !== "NONE" && (
            <>
              <label className="mt-2 block text-xs text-gray-500 dark:text-gray-400">
                Hasta (opcional, dejar vacío para que no termine)
              </label>
              <input
                type="date"
                value={recurrenceEndAt}
                onChange={(e) => setRecurrenceEndAt(e.target.value)}
                className={INPUT_CLASS}
              />
              {isEditing && (
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  Editar o borrar afecta a toda la serie repetida, no solo a esta fecha.
                </p>
              )}
            </>
          )}
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Recordatorio</label>
          <select
            value={reminder}
            onChange={(e) => setReminder(e.target.value)}
            className={INPUT_CLASS}
          >
            {REMINDER_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-2 rounded-md border border-gray-200 p-3 dark:border-gray-700">
          <label className="flex items-center justify-between">
            <span className={LABEL_CLASS}>⏳ Cuenta regresiva</span>
            <input
              type="checkbox"
              checked={countdownEnabled}
              onChange={(e) => setCountdownEnabled(e.target.checked)}
              className="h-4 w-4 accent-indigo-600"
            />
          </label>
          {countdownEnabled ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Recordatorio diario (sin repetir el evento) entre estas dos fechas, a la hora que
                elijas.
              </p>

              <div className="space-y-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Desde</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
                    {(["hoy", "custom"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setCountdownFromMode(mode)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          countdownFromMode === mode
                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        {mode === "hoy" ? "Hoy" : "Elegir fecha"}
                      </button>
                    ))}
                  </div>
                  {countdownFromMode === "custom" && (
                    <input
                      type="date"
                      value={countdownFromDate}
                      onChange={(e) => setCountdownFromDate(e.target.value)}
                      className={`${INPUT_CLASS} flex-1`}
                    />
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">Hasta</span>
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 rounded-full bg-gray-100 p-1 dark:bg-gray-800">
                    {(["evento", "custom"] as const).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => setCountdownToMode(mode)}
                        className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                          countdownToMode === mode
                            ? "bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-gray-100"
                            : "text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        }`}
                      >
                        {mode === "evento" ? "Día del evento" : "Elegir fecha"}
                      </button>
                    ))}
                  </div>
                  {countdownToMode === "custom" && (
                    <input
                      type="date"
                      value={countdownToDate}
                      max={startAt.slice(0, 10)}
                      onChange={(e) => setCountdownToDate(e.target.value)}
                      className={`${INPUT_CLASS} flex-1`}
                    />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-600 dark:text-gray-300">A las</span>
                <input
                  type="time"
                  value={countdownTime}
                  onChange={(e) => setCountdownTime(e.target.value)}
                  className={`${INPUT_CLASS} w-28`}
                />
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Ej. &ldquo;faltan 4 días para el examen&rdquo; todos los días hasta la fecha.
            </p>
          )}
        </div>

        <div className="space-y-1">
          <label className={LABEL_CLASS}>Categorías (elegí una o más)</label>
          <div className="grid grid-cols-2 gap-2">
            {EVENT_CATEGORIES.map((cat) => {
              const active = categoryColors.includes(cat.color);
              return (
                <button
                  key={cat.color}
                  type="button"
                  onClick={() => toggleCategory(cat.color)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-md border px-2 py-2 text-left text-sm sm:py-1.5 ${
                    active
                      ? "border-gray-800 bg-gray-50 dark:border-gray-300 dark:bg-gray-800"
                      : "border-gray-200 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
                  } text-gray-700 dark:text-gray-300`}
                >
                  <span
                    className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm border ${
                      active ? "border-transparent" : "border-gray-300 dark:border-gray-600"
                    }`}
                    style={{ backgroundColor: active ? cat.color : "transparent" }}
                  >
                    {active && <span className="text-[9px] leading-none text-white">✓</span>}
                  </span>
                  {cat.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div>
            {isEditing && !conflicts && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={loading}
                className="text-sm font-medium text-red-600 hover:underline dark:text-red-400"
              >
                Borrar
              </button>
            )}
          </div>
          {conflicts ? (
            <button
              type="button"
              onClick={onSaved}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-400"
            >
              Entendido
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
              >
                {loading ? "Guardando..." : "Guardar"}
              </button>
            </div>
          )}
        </div>
      </form>
    </div>
  );
}
