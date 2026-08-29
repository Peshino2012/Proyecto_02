export type ThemePreference = "light" | "dark" | "system";

const STORAGE_KEY = "theme";

export function getStoredTheme(): ThemePreference {
  if (typeof window === "undefined") return "system";
  const value = window.localStorage.getItem(STORAGE_KEY);
  return value === "light" || value === "dark" ? value : "system";
}

export function applyTheme(pref: ThemePreference) {
  if (typeof document === "undefined") return;
  const isDark =
    pref === "dark" ||
    (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", isDark);
}

export function setTheme(pref: ThemePreference) {
  if (pref === "system") {
    window.localStorage.removeItem(STORAGE_KEY);
  } else {
    window.localStorage.setItem(STORAGE_KEY, pref);
  }
  applyTheme(pref);
}

// Script inline para aplicar el tema antes del primer paint y evitar flash.
export const THEME_INIT_SCRIPT = `
(function() {
  try {
    var pref = localStorage.getItem('${STORAGE_KEY}');
    var isDark = pref === 'dark' || (pref !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', isDark);
  } catch (e) {}
})();
`;
