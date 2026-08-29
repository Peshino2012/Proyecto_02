"use client";

import { useEffect, useState } from "react";

type TokenSummary = {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export default function McpTokenManager() {
  const [tokens, setTokens] = useState<TokenSummary[]>([]);
  const [name, setName] = useState("Claude Cowork");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [mcpUrl, setMcpUrl] = useState("");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valor derivado de window solo disponible en cliente
    setMcpUrl(`${window.location.origin}/api/mcp`);
    loadTokens();
  }, []);

  async function loadTokens() {
    const res = await fetch("/api/tokens");
    if (res.ok) {
      const data = await res.json();
      setTokens(data.tokens);
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/tokens", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setLoading(false);
    if (res.ok) {
      const data = await res.json();
      setNewToken(data.token);
      loadTokens();
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("¿Revocar este token? Dejará de funcionar de inmediato.")) return;
    await fetch(`/api/tokens/${id}`, { method: "DELETE" });
    loadTokens();
  }

  return (
    <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-gray-900/5 dark:bg-gray-900 dark:ring-white/10">
      <div>
        <h3 className="font-semibold text-gray-900 dark:text-gray-100">
          Conectar con Claude / Claude Cowork
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Generá un token y agregá este calendario como conector MCP remoto.
        </p>
      </div>

      <div className="rounded-lg bg-gray-50 p-3 text-sm dark:bg-gray-800">
        <p className="font-medium text-gray-900 dark:text-gray-100">URL del servidor MCP</p>
        <code className="mt-1 block break-all rounded bg-gray-100 px-2 py-1 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-300">
          {mcpUrl}
        </code>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1 space-y-1">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Nombre del token
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:focus:border-indigo-400"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-60 dark:bg-indigo-500 dark:hover:bg-indigo-400"
        >
          Generar token
        </button>
      </form>

      {newToken && (
        <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Copiá este token ahora, no se va a volver a mostrar:
          </p>
          <code className="block break-all rounded bg-white px-2 py-1 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-300">
            {newToken}
          </code>
        </div>
      )}

      <ul className="divide-y divide-gray-100 dark:divide-gray-800">
        {tokens.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2 text-sm">
            <div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{t.name}</p>
              <p className="text-xs text-gray-400 dark:text-gray-500">
                Creado {new Date(t.createdAt).toLocaleDateString("es-AR")}
                {t.lastUsedAt
                  ? ` · Usado ${new Date(t.lastUsedAt).toLocaleDateString("es-AR")}`
                  : " · Sin uso"}
              </p>
            </div>
            <button
              onClick={() => handleRevoke(t.id)}
              className="text-xs font-medium text-red-600 hover:underline dark:text-red-400"
            >
              Revocar
            </button>
          </li>
        ))}
        {tokens.length === 0 && (
          <p className="py-2 text-sm text-gray-400 dark:text-gray-500">
            Todavía no generaste ningún token.
          </p>
        )}
      </ul>
    </div>
  );
}
