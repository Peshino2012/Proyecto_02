export const EVENT_CATEGORIES = [
  { label: "Facultad", color: "#0ea5e9" },
  { label: "Laburo / Proyectos", color: "#4f46e5" },
  { label: "Fe", color: "#16a34a" },
  { label: "Personal / Hábitos", color: "#d97706" },
  { label: "Salud", color: "#dc2626" },
  { label: "Otro", color: "#9333ea" },
] as const;

export function categoryLabelForColor(color: string): string {
  return EVENT_CATEGORIES.find((c) => c.color === color)?.label ?? "Otro";
}
