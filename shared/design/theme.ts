/**
 * TRACE Design System — Theme Toggle
 *
 * Persists preference to localStorage.
 * Reporter: light default. Operator: dark default.
 */

const STORAGE_KEY = "trace_theme";

export type Theme = "light" | "dark";

export function getTheme(defaultTheme: Theme = "light"): Theme {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return defaultTheme;
}

export function setTheme(theme: Theme): void {
  localStorage.setItem(STORAGE_KEY, theme);
  applyTheme(theme);
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}

export function toggleTheme(defaultTheme: Theme = "light"): Theme {
  const current = getTheme(defaultTheme);
  const next = current === "light" ? "dark" : "light";
  setTheme(next);
  return next;
}

export function initTheme(defaultTheme: Theme = "light"): Theme {
  const theme = getTheme(defaultTheme);
  applyTheme(theme);
  return theme;
}
