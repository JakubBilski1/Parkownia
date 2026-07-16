import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

/**
 * Every colour is a CSS variable defined in src/app/globals.css, so a theme
 * switch is a single attribute on <html>. Tailwind's default palette is not
 * extended into the theme on purpose: if a value is not a token, it is a bug.
 */
const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx,mdx}"],
  theme: {
    colors: {
      transparent: "transparent",
      current: "currentColor",
      inherit: "inherit",

      bg: "var(--bg)",
      surface: "var(--surface)",
      "surface-2": "var(--surface-2)",
      ink: "var(--ink)",
      muted: "var(--muted)",
      line: "var(--line)",

      accent: {
        DEFAULT: "var(--accent)",
        ink: "var(--accent-ink)",
        hover: "var(--accent-hover)",
        active: "var(--accent-active)",
      },

      selected: {
        DEFAULT: "var(--selected-bg)",
        ink: "var(--selected-ink)",
      },

      danger: {
        DEFAULT: "var(--danger)",
        ink: "var(--danger-ink)",
        soft: "var(--danger-soft)",
      },

      "scan-ok": "var(--scan-ok)",
      "scan-bad": "var(--scan-bad)",

      focus: "var(--focus)",
      overlay: "var(--overlay)",
    },
    fontFamily: {
      display: ["var(--font-display)", "ui-sans-serif", "system-ui", "sans-serif"],
      body: ["var(--font-body)", "ui-sans-serif", "system-ui", "sans-serif"],
      mono: ["var(--font-mono)", "ui-monospace", "monospace"],
    },
    fontSize: {
      // Six levels. A seventh means the hierarchy is wrong.
      ui: ["0.875rem", { lineHeight: "1.25rem" }], // 14 — labels, meta, chips
      body: ["1rem", { lineHeight: "1.5rem" }], // 16 — body copy, inputs
      lead: ["1.125rem", { lineHeight: "1.625rem" }], // 18 — lead paragraph, price in list
      h3: ["1.375rem", { lineHeight: "1.75rem" }], // 22
      h2: ["1.75rem", { lineHeight: "2.125rem" }], // 28
      h1: ["2.25rem", { lineHeight: "2.5rem" }], // 36
    },
    borderRadius: {
      none: "0",
      chip: "var(--radius-chip)",
      button: "var(--radius-button)",
      card: "var(--radius-card)",
      sheet: "var(--radius-sheet)",
      pill: "var(--radius-pill)",
    },
    boxShadow: {
      card: "var(--shadow-card)",
      float: "var(--shadow-float)",
      none: "none",
    },
    transitionTimingFunction: {
      out: "var(--ease-out)",
      in: "var(--ease-in)",
    },
    transitionDuration: {
      micro: "var(--dur-micro)",
      layout: "var(--dur-layout)",
    },
    extend: {
      dropShadow: {
        // A masked element clips box-shadow; the ticket needs a filter shadow.
        ticket: ["var(--drop-ticket-1)", "var(--drop-ticket-2)"],
      },
      spacing: {
        // Minimum touch target. Never smaller.
        touch: "2.75rem", // 44px
      },
      minHeight: {
        touch: "2.75rem",
      },
      minWidth: {
        touch: "2.75rem",
      },
      screens: {
        // The floor is a 375px phone held in the rain, not a laptop.
        xs: "375px",
      },
      animation: {
        "fade-in": "ps-fade-in var(--dur-micro) var(--ease-out)",
        "fade-out": "ps-fade-out var(--dur-micro) var(--ease-in)",
        "sheet-up": "ps-sheet-up var(--dur-layout) var(--ease-out)",
        "sheet-down": "ps-sheet-down var(--dur-layout) var(--ease-in)",
        "sheet-in-right": "ps-sheet-in-right var(--dur-layout) var(--ease-out)",
        "sheet-out-right": "ps-sheet-out-right var(--dur-layout) var(--ease-in)",
        "dialog-in": "ps-dialog-in var(--dur-layout) var(--ease-out)",
        "dialog-out": "ps-dialog-out var(--dur-layout) var(--ease-in)",
        shimmer: "ps-shimmer 1.4s linear infinite",
      },
    },
  },
  plugins: [
    // Desktop hover affordances (rail card outline, pin cross-highlight) must never
    // fire on a touchscreen, where "hover" is a tap and the change reads as a glitch.
    // `hover-hover:` wraps a rule in `@media (hover: hover) and (pointer: fine)`,
    // so only a real mouse/trackpad gets it — phones and tablets are excluded by
    // construction, which is also how mobile stays byte-for-byte unchanged.
    plugin(({ addVariant }) => {
      addVariant("hover-hover", "@media (hover: hover) and (pointer: fine)");
    }),
  ],
};

export default config;
