import NavBar from "@/components/NavBar";
import TasksView from "@/components/tasks/TasksView";

export default function TasksPage() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50 pb-16 dark:bg-gray-950 md:pb-0">
      <NavBar />
      <TasksView />
    </div>
  );
}
