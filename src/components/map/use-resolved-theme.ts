"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/theme-toggle";

export type ResolvedTheme = "light" | "dark";

/**
 * The toggle stores a *preference* (system / light / dark); MapLibre needs an
 * answer. "system" has to keep tracking the OS while the map is open, so the
 * media query is watched, not read once.
 */
/**
 * Read once, synchronously, so the map can be built with the right style on the
 * first frame. Starting at "light" and correcting in an effect meant a dark page
 * flashed a white map for a beat on every load. Safe to call during render only
 * because the value never reaches the server-rendered markup — MapView applies
 * it to the MapLibre instance and to the canvas class, both imperatively.
 */
function readSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function useResolvedTheme(): ResolvedTheme {
  const { preference } = useTheme();
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(readSystemTheme);

  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemTheme(query.matches ? "dark" : "light");
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  return preference === "system" ? systemTheme : preference;
}
