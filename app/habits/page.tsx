import NavBar from "@/components/NavBar";
import HabitsView from "@/components/habits/HabitsView";

export default function HabitsPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16 dark:bg-gray-950 md:pb-0">
      <NavBar />
      <HabitsView />
    </div>
  );
}
