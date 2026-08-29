"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export default function NavBar() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
      pathname?.startsWith(href)
        ? "bg-indigo-50 text-indigo-700"
        : "text-gray-500 hover:bg-gray-100 hover:text-gray-900"
    }`;

  return (
    <header className="border-b border-gray-100 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
        <span className="text-lg font-medium tracking-tight text-gray-900">Calendario</span>
        <nav className="flex items-center gap-1">
          <Link href="/calendar" className={linkClass("/calendar")}>
            Calendario
          </Link>
          <Link href="/settings" className={linkClass("/settings")}>
            Ajustes
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-full px-3 py-1.5 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900"
          >
            Salir
          </button>
        </nav>
      </div>
    </header>
  );
}
