export type TaskStat = "INTELECTO" | "DISCIPLINA" | "ESPIRITU" | "VITALIDAD" | "FUERZA" | "OTRO";

export const TASK_STATS: { key: Exclude<TaskStat, "OTRO">; label: string; icon: string }[] = [
  { key: "INTELECTO", label: "Intelecto", icon: "🧠" },
  { key: "DISCIPLINA", label: "Disciplina", icon: "⚔️" },
  { key: "ESPIRITU", label: "Espíritu", icon: "🙏" },
  { key: "VITALIDAD", label: "Vitalidad", icon: "❤️" },
  { key: "FUERZA", label: "Fuerza", icon: "💪" },
];

// Categorías propias de las quests para cuando el usuario prefiere NO
// compartir las categorías de Eventos (ajuste en Ajustes → Tareas). Cada una
// mapea 1:1 a un stat.
export const TASK_CATEGORIES: { label: string; color: string; stat: TaskStat }[] = [
  { label: "Intelecto", color: "#0ea5e9", stat: "INTELECTO" },
  { label: "Disciplina", color: "#eab308", stat: "DISCIPLINA" },
  { label: "Espíritu", color: "#16a34a", stat: "ESPIRITU" },
  { label: "Vitalidad", color: "#dc2626", stat: "VITALIDAD" },
  { label: "Fuerza", color: "#9333ea", stat: "FUERZA" },
];

// Cuando sí se comparten categorías con Eventos, cada color de
// EVENT_CATEGORIES mapea a un stat (mismos colores que lib/categories.ts).
export const EVENT_COLOR_TO_STAT: Record<string, TaskStat> = {
  "#0ea5e9": "INTELECTO", // Facultad
  "#eab308": "DISCIPLINA", // Laburo / Proyectos
  "#16a34a": "ESPIRITU", // Fe
  "#d97706": "VITALIDAD", // Personal / Hábitos
  "#dc2626": "FUERZA", // Salud
  "#9333ea": "OTRO", // Otro
};

export function statForColor(color: string, shareEventCategories: boolean): TaskStat {
  if (shareEventCategories) return EVENT_COLOR_TO_STAT[color] ?? "OTRO";
  return TASK_CATEGORIES.find((c) => c.color === color)?.stat ?? "OTRO";
}

// Una quest puede tener varias categorías (ej. Salud + Facultad); cada una
// mapea a su stat, sin duplicados, en el orden en que se eligieron.
export function statsForColors(colors: string[], shareEventCategories: boolean): TaskStat[] {
  const stats: TaskStat[] = [];
  for (const color of colors) {
    const stat = statForColor(color, shareEventCategories);
    if (!stats.includes(stat)) stats.push(stat);
  }
  return stats;
}

export const DIFFICULTY_OPTIONS = [
  { label: "Fácil", value: "10", xp: 10 },
  { label: "Media", value: "20", xp: 20 },
  { label: "Difícil", value: "35", xp: 35 },
] as const;

// XP necesaria para subir del nivel L al L+1: creciente, para que subir de
// nivel cueste cada vez un poco más.
export function xpForLevel(level: number): number {
  return 100 + (level - 1) * 40;
}

// Insignia de rango por nivel (estilo cazadores de Solo Leveling), puramente
// cosmética: crece cada 5 niveles, de E (recién empezando) a S (el tope).
const RANKS = ["E", "D", "C", "B", "A", "S"] as const;
export type Rank = (typeof RANKS)[number];

export function rankForLevel(level: number): Rank {
  const idx = Math.min(RANKS.length - 1, Math.floor((level - 1) / 5));
  return RANKS[idx];
}

export type ProgressState = { level: number; xp: number; totalXp: number };

/**
 * Aplica un delta de XP (positivo al completar una quest, negativo por
 * penalidad) subiendo o bajando de nivel según corresponda. El nivel nunca
 * baja de 1; totalXp (histórico) nunca baja de 0.
 */
export function applyXpDelta(state: ProgressState, delta: number): ProgressState {
  let { level, xp } = state;
  const totalXp = Math.max(0, state.totalXp + delta);
  xp += delta;

  while (xp >= xpForLevel(level)) {
    xp -= xpForLevel(level);
    level += 1;
  }
  while (xp < 0 && level > 1) {
    level -= 1;
    xp += xpForLevel(level);
  }
  if (level <= 1 && xp < 0) xp = 0;

  return { level, xp, totalXp };
}
