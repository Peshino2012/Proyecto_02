"use client";

import { signOut } from "next-auth/react";

export default function SignOutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="w-full rounded-xl p-3 text-center text-sm font-medium text-red-600 ring-1 ring-gray-900/5 hover:bg-red-50 dark:text-red-400 dark:ring-white/10 dark:hover:bg-red-500/10"
    >
      Cerrar sesión
    </button>
  );
}
