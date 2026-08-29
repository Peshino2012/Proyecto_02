"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

const TABS = [
  { href: "/calendar", label: "Calendario", icon: "📅" },
  { href: "/habits", label: "Hábitos", icon: "✅" },
  { href: "/settings", label: "Ajustes", icon: "⚙️" },
];

export default function NavBar() {
  const pathname = usePathname();

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
              <Link key={tab.href} href={tab.href} className={linkClass(tab.href)}>
                {tab.label}
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
              <span className="text-lg leading-none">{tab.icon}</span>
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
