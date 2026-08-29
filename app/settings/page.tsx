import NavBar from "@/components/NavBar";
import PushSubscribeToggle from "@/components/settings/PushSubscribeToggle";
import McpTokenManager from "@/components/settings/McpTokenManager";
import ThemeToggle from "@/components/settings/ThemeToggle";
import SignOutButton from "@/components/settings/SignOutButton";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16 dark:bg-gray-950 md:pb-0">
      <NavBar />
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Ajustes</h1>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Apariencia
          </h2>
          <ThemeToggle />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Notificaciones
          </h2>
          <PushSubscribeToggle />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            Integración con Claude
          </h2>
          <McpTokenManager />
        </section>

        <section className="pt-2 md:hidden">
          <SignOutButton />
        </section>
      </div>
    </div>
  );
}
