"use client";

import { X } from "lucide-react";
import { useId } from "react";
import { cn } from "@/lib/cn";
import { useNativeDialog } from "./dialog";

export type SheetProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** Sticky bottom bar — the primary action stays under the thumb. */
  footer?: React.ReactNode;
  className?: string;
};

/**
 * Bottom sheet on a phone, side panel from ≥768px. It rises from the edge it
 * will fall back to, which is the only reason the movement exists.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className,
}: SheetProps) {
  const { ref, closing, requestClose, onAnimationEnd, onBackdropMouseDown } =
    useNativeDialog(open, onClose);

  // Per instance, not per component. The map mounts two sheets at once (the
  // parking and the filters), and a shared literal id made `aria-labelledby`
  // resolve to whichever <h2> came first in the document — so opening a parking
  // announced it as "Filtry".
  const titleId = useId();

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn(
        "m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0",
        "backdrop:bg-overlay",
        closing ? "backdrop:animate-fade-out" : "backdrop:animate-fade-in",
      )}
    >
      <div
        onMouseDown={onBackdropMouseDown}
        className="flex h-full w-full items-end justify-center md:items-stretch md:justify-end"
      >
        <div
          onAnimationEnd={onAnimationEnd}
          className={cn(
            "flex max-h-[88dvh] w-full flex-col rounded-t-sheet border border-line bg-surface shadow-float",
            "md:h-full md:max-h-none md:w-[26rem] md:rounded-none md:rounded-l-sheet",
            closing
              ? "animate-sheet-down md:animate-sheet-out-right"
              : "animate-sheet-up md:animate-sheet-in-right",
            className,
          )}
        >
          <div className="flex items-center justify-between gap-4 border-b border-line px-4 py-3">
            <h2
              id={titleId}
              className="font-display text-h3 font-bold text-ink"
            >
              {title}
            </h2>
            <button
              type="button"
              onClick={requestClose}
              aria-label="Zamknij"
              className="-mr-2 inline-flex h-touch w-touch items-center justify-center rounded-button text-muted transition-colors duration-micro ease-out hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4">
            {children}
          </div>

          {footer ? (
            <div className="border-t border-line bg-surface p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              {footer}
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
