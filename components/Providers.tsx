"use client";

import { SessionProvider } from "next-auth/react";
import AppLockGate from "./AppLockGate";

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <AppLockGate>{children}</AppLockGate>
    </SessionProvider>
  );
}
