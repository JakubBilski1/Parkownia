"use client";

import type { Appearance } from "@stripe/stripe-js";
import { useEffect, useState } from "react";

/**
 * Stripe renders the Payment Element in an iframe, so it inherits nothing from
 * this page — not the theme, not the fonts, not a single token. Left alone it
 * paints a white box with Stripe's blue on our "Zmierzch" dark theme, and the one
 * screen where the driver hands over 35 zł is the one screen that must not look
 * like it belongs to somebody else (DESIGN_PRINCIPLES §0.1: trust > flair).
 *
 * So the tokens are read from the live document and handed across the iframe
 * boundary. One source of truth (globals.css) either way — nothing here invents
 * a colour.
 */
const TOKENS = [
  "--bg",
  "--surface",
  "--surface-2",
  "--ink",
  "--muted",
  "--line",
  "--accent",
  "--accent-ink",
  "--danger",
  "--focus",
  "--radius-button",
] as const;

type TokenName = (typeof TOKENS)[number];
type Tokens = Record<TokenName, string>;

function readTokens(): Tokens | null {
  if (typeof window === "undefined") return null;

  const style = getComputedStyle(document.documentElement);
  const tokens = {} as Tokens;

  for (const token of TOKENS) {
    tokens[token] = style.getPropertyValue(token).trim();
  }

  return tokens;
}

function toAppearance(tokens: Tokens): Appearance {
  return {
    // "stripe" is the base we override, not the look we ship: every colour below
    // comes from our own palette.
    theme: "stripe",
    variables: {
      colorPrimary: tokens["--accent"],
      colorBackground: tokens["--surface"],
      colorText: tokens["--ink"],
      colorTextSecondary: tokens["--muted"],
      colorTextPlaceholder: tokens["--muted"],
      colorDanger: tokens["--danger"],
      borderRadius: tokens["--radius-button"] || "10px",
      // IBM Plex Sans is the body face; the iframe cannot see our @font-face, so
      // it falls back to the same system stack the rest of the UI does.
      fontFamily: '"IBM Plex Sans", ui-sans-serif, system-ui, sans-serif',
      spacingUnit: "4px",
    },
    rules: {
      ".Input": {
        backgroundColor: tokens["--surface"],
        border: `1px solid ${tokens["--line"]}`,
        boxShadow: "none",
        // 44 px touch target, same as every other control (DESIGN_SYSTEM).
        padding: "12px",
      },
      ".Input:focus": {
        border: `1px solid ${tokens["--line"]}`,
        outline: `2px solid ${tokens["--focus"]}`,
        outlineOffset: "2px",
        boxShadow: "none",
      },
      ".Label": {
        color: tokens["--muted"],
        fontWeight: "600",
      },
      ".Tab, .Block": {
        backgroundColor: tokens["--surface"],
        border: `1px solid ${tokens["--line"]}`,
        boxShadow: "none",
      },
      ".Tab--selected": {
        // Selection is a neutral inversion, never the accent — the accent is
        // reserved for the CTA and the active pin (DESIGN_SYSTEM §colours).
        backgroundColor: tokens["--surface-2"],
        border: `1px solid ${tokens["--ink"]}`,
        color: tokens["--ink"],
      },
    },
  };
}

/**
 * Re-reads the tokens whenever the theme flips, in either direction: the toggle
 * stamps `data-theme` on <html>, and the OS preference can change under a user
 * who never touched the toggle.
 */
export function useStripeAppearance(): Appearance | undefined {
  const [appearance, setAppearance] = useState<Appearance | undefined>(undefined);

  useEffect(() => {
    const sync = () => {
      const tokens = readTokens();
      if (tokens) setAppearance(toAppearance(tokens));
    };

    sync();

    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);

    return () => {
      observer.disconnect();
      media.removeEventListener("change", sync);
    };
  }, []);

  return appearance;
}
