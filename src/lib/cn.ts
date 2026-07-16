import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

/**
 * The type scale from tailwind.config.ts. tailwind-merge has to be told about it.
 *
 * Out of the box it only recognises Tailwind's own `text-sm|base|lg|…` as font
 * sizes, so a bespoke `text-lead` looks to it like a *colour* — and a colour
 * conflicts with a colour. Button composes `base → variant → size`, which puts
 * `text-lead` after `text-accent-ink`, so the later one won and the merge
 * silently deleted the button's text colour.
 *
 * That is not theoretical: it shipped. The accent CTA — "Zaloguj się", "Załóż
 * konto", "Zarezerwuj" — inherited --ink instead of --accent-ink and measured
 * 2.09:1 in the light theme and 4.33:1 in dark, against a 4.5:1 floor that
 * DESIGN_PRINCIPLES §4 calls non-negotiable. The `danger` variant lost its red
 * the same way. Nothing failed: tsc, lint and the tests were all green, because
 * the bug lived in a string.
 *
 * Keep this list in sync with `theme.fontSize` — a size missing here is a colour
 * silently dropped somewhere. tests/unit/design/cn.test.ts guards the pairing.
 */
const FONT_SIZES = ["ui", "body", "lead", "h1", "h2", "h3"];

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [{ text: FONT_SIZES }],
    },
  },
});

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
