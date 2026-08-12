import NavBar from "@/components/NavBar";
import CalendarView from "@/components/calendar/CalendarView";

export default function CalendarPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <NavBar />
      <CalendarView />
    </div>
  );
}
