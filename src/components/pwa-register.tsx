"use client";

import { useEffect } from "react";

/**
 * Registers the Service Worker that keeps the scanner shell available with no
 * network. Mounted by the host panel pages, not by the root layout: a driver
 * buying a spot has no use for a Service Worker, and a worker registered on
 * every page is a worker that will eventually cache something it should not.
 *
 * Integration phase: if the app later wants an app-wide worker, move this into
 * the root layout — but keep the API exclusions in public/sw.js.
 */
export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return;

    const register = () => {
      void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
        // A failed registration means no offline shell — the queue and the
        // manifest in IndexedDB still work. Nothing to shout about here.
      });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
