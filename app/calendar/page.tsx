import NavBar from "@/components/NavBar";
import CalendarView from "@/components/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16 dark:bg-gray-950 md:pb-0">
      <NavBar />
      <CalendarView />
    </div>
  );
}
