"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export default function NavBar() {
  const pathname = usePathname();

  const linkClass = (href: string) =>
    `rounded-md px-3 py-1.5 text-sm font-medium ${
      pathname?.startsWith(href)
        ? "bg-indigo-600 text-white"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <span className="text-lg font-semibold text-indigo-700">Calendario</span>
        <nav className="flex items-center gap-2">
          <Link href="/calendar" className={linkClass("/calendar")}>
            Calendario
          </Link>
          <Link href="/settings" className={linkClass("/settings")}>
            Ajustes
          </Link>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            Salir
          </button>
        </nav>
      </div>
    </header>
  );
}
