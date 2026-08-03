import { useEffect, useSyncExternalStore } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "buildflow-theme";
const listeners = new Set<() => void>();
let theme: Theme = readInitialTheme();

function readInitialTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

function applyTheme(next: Theme) {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", next === "dark");
}

function setTheme(next: Theme) {
  theme = next;
  window.localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return theme;
}

// Apply immediately on module load so there's no flash of the wrong theme.
if (typeof document !== "undefined") {
  applyTheme(theme);
}

export function useTheme() {
  const current = useSyncExternalStore(subscribe, getSnapshot, (): Theme => "light");

  useEffect(() => {
    applyTheme(current);
  }, [current]);

  return {
    theme: current,
    toggleTheme: () => setTheme(current === "dark" ? "light" : "dark"),
    setTheme,
  };
}
