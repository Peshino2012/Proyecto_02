export type ThemePreference = "light" | "dark" | "system";

export const THEME_COOKIE = "theme";

export function getThemeCookieClient(): ThemePreference {
  if (typeof document === "undefined") return "system";
  const match = document.cookie.match(/(?:^|;\s*)theme=(light|dark)(?:;|$)/);
  return match ? (match[1] as ThemePreference) : "system";
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
    // Cookie expirada -> "sin preferencia guardada", queda a criterio del SO.
    document.cookie = `${THEME_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  } else {
    // ~10 años: básicamente "para siempre" hasta que el usuario lo cambie.
    document.cookie = `${THEME_COOKIE}=${pref}; path=/; max-age=315360000; SameSite=Lax`;
  }
  applyTheme(pref);
}

// Solo se usa cuando no hay cookie guardada (preferencia "Sistema"): sigue el
// tema del SO en el cliente apenas carga, ya que eso no se puede leer en el
// servidor. Si hay cookie, el propio layout ya renderiza la clase "dark"
// correcta desde el primer byte, sin necesitar este script.
export const SYSTEM_THEME_INIT_SCRIPT = `
(function() {
  try {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    }
  } catch (e) {}
})();
`;
