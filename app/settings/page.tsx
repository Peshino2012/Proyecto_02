import NavBar from "@/components/NavBar";
import PushSubscribeToggle from "@/components/settings/PushSubscribeToggle";
import McpTokenManager from "@/components/settings/McpTokenManager";

export default function SettingsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 p-4">
        <h1 className="text-xl font-semibold">Ajustes</h1>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Notificaciones
          </h2>
          <PushSubscribeToggle />
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
            Integración con Claude
          </h2>
          <McpTokenManager />
        </section>
      </div>
    </div>
  );
}
