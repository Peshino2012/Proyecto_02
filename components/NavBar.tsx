"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { useWorkAttention } from "@/components/work/useWorkAttention";

const TABS = [
  { href: "/calendar", label: "Calendario", icon: "📅" },
  { href: "/trabajo", label: "Trabajo", icon: "💼" },
  { href: "/habits", label: "Hábitos", icon: "✅" },
  { href: "/tasks", label: "Quests", icon: "⚔️" },
  { href: "/settings", label: "Ajustes", icon: "⚙️" },
];

// Número rojo del botón "Trabajo": lo que pide atención en ese apartado
// (vencidos, lo de hoy, lo nuevo de Claude, mensajes sin leer).
function AttentionBadge({ count, className = "" }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return (
    <span
      className={`flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-none text-white ${className}`}
      aria-label={`${count} cosa${count > 1 ? "s" : ""} para ver en Trabajo`}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}

export default function NavBar() {
  const pathname = usePathname();
  const workAttention = useWorkAttention();

  const linkClass = (href: string) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      pathname?.startsWith(href)
        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
    }`;

  return (
    <>
      <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm dark:border-gray-800 dark:bg-gray-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <span className="text-lg font-medium tracking-tight text-gray-900 dark:text-gray-100">
            Calendario
          </span>
          <nav className="hidden items-center gap-1 md:flex">
            {TABS.map((tab) => (
              <Link
                key={tab.href}
                href={tab.href}
                className={`${linkClass(tab.href)} inline-flex items-center gap-1.5`}
              >
                {tab.label}
                {tab.href === "/trabajo" && <AttentionBadge count={workAttention} />}
              </Link>
            ))}
            <button
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              Salir
            </button>
          </nav>
        </div>
      </header>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-gray-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-sm md:hidden dark:border-gray-800 dark:bg-gray-950/95"
        aria-label="Navegación principal"
      >
        {TABS.map((tab) => {
          const active = pathname?.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
                active
                  ? "text-indigo-600 dark:text-indigo-400"
                  : "text-gray-400 dark:text-gray-500"
              }`}
            >
              <span className="relative text-lg leading-none">
                {tab.icon}
                {tab.href === "/trabajo" && (
                  <AttentionBadge count={workAttention} className="absolute -right-3 -top-1.5" />
                )}
              </span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
