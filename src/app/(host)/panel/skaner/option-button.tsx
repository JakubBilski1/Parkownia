"use client";

/**
 * A chosen option (gate, event) is marked by inverting ink and background —
 * never by the accent. The accent belongs to the CTA, and a screen where "the
 * gate I picked" looks like "the button that acts" teaches the host nothing.
 */
export function OptionButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "press flex min-h-touch w-full flex-col items-start gap-0.5 rounded-card border p-3 text-left",
        "transition-colors duration-micro ease-out",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus",
        selected
          ? "border-selected bg-selected text-selected-ink"
          : "border-line bg-surface text-ink hover:bg-surface-2",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
