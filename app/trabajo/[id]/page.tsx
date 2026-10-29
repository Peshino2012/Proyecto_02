import { Suspense } from "react";
import NavBar from "@/components/NavBar";
import ModuleView from "@/components/work/ModuleView";

export default async function TrabajoModulePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16 dark:bg-gray-950 md:pb-0">
      <NavBar />
      <Suspense>
        <ModuleView moduleId={id} />
      </Suspense>
    </div>
  );
}
