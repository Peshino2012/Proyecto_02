"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { notifyWorkChanged } from "./useWorkAttention";
import { KIND_LABELS, type ProposalChange, type WorkItemData, type WorkMessageData } from "./types";

type Props = {
  /** null = chat general del apartado Trabajo. */
  moduleId: string | null;
  accentColor?: string;
  /** Ítems del módulo, para mostrar el nombre de lo que una propuesta cambia o borra. */
  items?: WorkItemData[];
  /** Se llama después de confirmar una propuesta (para recargar los ítems). */
  onProposalApplied?: () => void;
};

// "jueves 29 de octubre" → "Jueves 29 de octubre" (la clase capitalize de CSS pondría "De Octubre").
export function capitalize(text: string) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function describeWhen(data: { date?: string | null; time?: string | null }) {
  if (!data.date) return null;
  const day = format(new Date(`${data.date}T00:00:00`), "EEE d 'de' MMM", { locale: es });
  return data.time ? `${day}, ${data.time}` : day;
}

function describeChange(change: ProposalChange, items: WorkItemData[]) {
  if (change.op === "create") {
    const when = describeWhen(change.data);
    const kind = change.data.kind ? KIND_LABELS[change.data.kind] : KIND_LABELS.TASK;
    return { verb: "Agregar", text: `${kind}: ${change.data.title}${when ? ` · ${when}` : ""}` };
  }
  const item = items.find((i) => i.id === change.itemId);
  const name = item?.title ?? "un ítem";
  if (change.op === "delete") return { verb: "Borrar", text: name };

  const parts: string[] = [];
  if (change.data.title && change.data.title !== item?.title) parts.push(`nombre: "${change.data.title}"`);
  if (change.data.date !== undefined) parts.push(change.data.date ? `fecha: ${describeWhen(change.data)}` : "sin fecha");
  if (change.data.done !== undefined) parts.push(change.data.done ? "marcar como hecho" : "marcar como no hecho");
  if (change.data.kind) parts.push(`tipo: ${KIND_LABELS[change.data.kind]}`);
  if (change.data.notes !== undefined) parts.push("notas");
  return { verb: "Cambiar", text: `${name}${parts.length ? ` → ${parts.join(", ")}` : ""}` };
}

export default function WorkChat({ moduleId, accentColor = "#4f46e5", items = [], onProposalApplied }: Props) {
  const [messages, setMessages] = useState<WorkMessageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/work/messages?markRead=1${moduleId ? `&moduleId=${moduleId}` : ""}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages(data.messages);
      setError(null);
      notifyWorkChanged();
    } catch {
      setError("No se pudo cargar el chat. Revisá la conexión y volvé a intentar.");
    } finally {
      setLoading(false);
    }
  }, [moduleId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial del chat
    load();
    // Si Claude contesta mientras el chat está abierto, aparece solo.
    const interval = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, 30_000);
    return () => clearInterval(interval);
  }, [load]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send() {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      const res = await fetch("/api/work/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moduleId, text: trimmed }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((prev) => [...prev, data.message]);
      setText("");
      setError(null);
    } catch {
      setError("No se pudo mandar el mensaje. Probá de nuevo.");
    } finally {
      setSending(false);
    }
  }

  async function resolve(message: WorkMessageData, action: "apply" | "reject") {
    setResolving(message.id);
    try {
      const res = await fetch(`/api/work/messages/${message.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error);
      }
      setMessages((prev) =>
        prev.map((m) =>
          m.id === message.id ? { ...m, proposalStatus: action === "apply" ? "APPLIED" : "REJECTED" } : m
        )
      );
      if (action === "apply") onProposalApplied?.();
      notifyWorkChanged();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "No se pudo aplicar el cambio.");
    } finally {
      setResolving(null);
    }
  }

  const waitingReply = messages.length > 0 && messages[messages.length - 1].author === "USER";

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        {loading && <p className="text-sm text-gray-400 dark:text-gray-500">Cargando chat…</p>}
        {!loading && messages.length === 0 && (
          <p className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-800/60 dark:text-gray-400">
            Escribime lo que necesites de este proyecto: una duda, un recordatorio, un cambio de fecha.
            Te contesto acá mismo.
          </p>
        )}

        {messages.map((m, i) => {
          const mine = m.author === "USER";
          const showDay = i === 0 || !isSameDay(new Date(messages[i - 1].createdAt), new Date(m.createdAt));
          return (
            <div key={m.id}>
              {showDay && (
                <p className="my-2 text-center text-[11px] font-medium text-gray-400 dark:text-gray-500">
                  {capitalize(format(new Date(m.createdAt), "EEEE d 'de' MMMM", { locale: es }))}
                </p>
              )}
              <div className={`flex items-end gap-2 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine && (
                  <span
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white"
                    style={{ backgroundColor: accentColor }}
                    aria-hidden
                  >
                    C
                  </span>
                )}
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    mine
                      ? "rounded-br-md bg-indigo-600 text-white dark:bg-indigo-500"
                      : "rounded-bl-md bg-white text-gray-800 ring-1 ring-gray-900/5 dark:bg-gray-800 dark:text-gray-100 dark:ring-white/10"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{m.text}</p>

                  {m.proposal && m.proposal.length > 0 && (
                    <div className="mt-2.5 space-y-1.5 rounded-xl bg-gray-50 p-2.5 dark:bg-gray-900/60">
                      <ul className="space-y-1">
                        {m.proposal.map((change, j) => {
                          const d = describeChange(change, items);
                          return (
                            <li key={j} className="text-[13px] text-gray-700 dark:text-gray-200">
                              <span className="font-semibold">{d.verb}</span> {d.text}
                            </li>
                          );
                        })}
                      </ul>
                      {m.proposalStatus === "PENDING" ? (
                        <div className="flex gap-2 pt-1">
                          <button
                            onClick={() => resolve(m, "apply")}
                            disabled={resolving === m.id}
                            className="flex-1 rounded-full bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                          >
                            Confirmar
                          </button>
                          <button
                            onClick={() => resolve(m, "reject")}
                            disabled={resolving === m.id}
                            className="flex-1 rounded-full border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 disabled:opacity-60 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800"
                          >
                            Rechazar
                          </button>
                        </div>
                      ) : (
                        <p
                          className={`pt-1 text-xs font-medium ${
                            m.proposalStatus === "APPLIED"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : "text-gray-400 dark:text-gray-500"
                          }`}
                        >
                          {m.proposalStatus === "APPLIED" ? "✓ Confirmado" : "Rechazado"}
                        </p>
                      )}
                    </div>
                  )}

                  <p className={`mt-1 text-right text-[10px] ${mine ? "text-indigo-200" : "text-gray-400"}`}>
                    {format(new Date(m.createdAt), "HH:mm")}
                  </p>
                </div>
              </div>
            </div>
          );
        })}

        {waitingReply && (
          <p className="text-center text-xs text-gray-400 dark:text-gray-500">
            Claude lo lee en la próxima revisión y te contesta acá (te llega una notificación).
          </p>
        )}
        <div ref={bottomRef} />
      </div>

      {error && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-3 flex items-end gap-2 border-t border-gray-100 pt-3 dark:border-gray-800"
      >
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          maxLength={4000}
          placeholder="Escribile a Claude…"
          className="max-h-32 min-h-10 flex-1 resize-none rounded-2xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:border-indigo-400 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
        />
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="h-10 shrink-0 rounded-full bg-indigo-600 px-4 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 dark:bg-indigo-500"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
