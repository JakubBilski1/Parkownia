"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-toggle";

export type ResolvedTheme = "light" | "dark";

/**
 * The toggle stores a *preference* (system / light / dark); MapLibre needs an
 * answer. "system" has to keep tracking the OS while the map is open, so the
 * media query is watched, not read once.
 */
export function useResolvedTheme(): ResolvedTheme {
  const { preference } = useTheme();
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>("light");

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemTheme(query.matches ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return preference === "system" ? systemTheme : preference;
}
