import NavBar from "@/components/NavBar";
import WorkHome from "@/components/work/WorkHome";

export default function TrabajoPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16 dark:bg-gray-950 md:pb-0">
      <NavBar />
      <WorkHome />
    </div>
  );
}
