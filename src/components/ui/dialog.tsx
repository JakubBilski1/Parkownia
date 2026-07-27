"use client";

import { X } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/cn";

/**
 * Built on <dialog showModal()>: focus trap, Escape and the top layer come from
 * the platform. Rolling our own would mean rolling our own accessibility bugs.
 */
export function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  const [closing, setClosing] = useState(false);

  const finishClose = useCallback(() => {
    ref.current?.close();
    setClosing(false);
    onClose();
  }, [onClose]);

  const requestClose = useCallback(() => {
    if (!ref.current?.open) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      finishClose();
      return;
    }
    setClosing(true);
  }, [finishClose]);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (open && !node.open) {
      node.showModal();
      setClosing(false);
      return;
    }

    /**
     * The owner closed it without anybody touching the dialog: the manual-code
     * sheet after "Sprawdź kod", the parking sheet when the driver taps the map.
     *
     * `open` is set imperatively by showModal(), so React does not manage it and
     * a re-render with open={false} did NOT close the element. It stayed in the
     * top layer — still modal, still backdropped — and swallowed every tap aimed
     * at what was behind it. At the gate that meant one manual code, and then a
     * host tapping a dead screen with a queue in front of him.
     */
    if (!open && node.open && !closing) {
      requestClose();
    }
  }, [open, closing, requestClose]);

  // Escape fires "cancel"; intercept it so the exit animation gets to run.
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const onCancel = (event: Event) => {
      event.preventDefault();
      requestClose();
    };
    node.addEventListener("cancel", onCancel);
    return () => node.removeEventListener("cancel", onCancel);
  }, [requestClose]);

  const onAnimationEnd = useCallback(() => {
    if (closing) finishClose();
  }, [closing, finishClose]);

  const onBackdropMouseDown = useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (event.target === event.currentTarget) requestClose();
    },
    [requestClose],
  );

  return { ref, closing, requestClose, onAnimationEnd, onBackdropMouseDown };
}

export type DialogProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** Buttons. Destructive actions never sit next to the confirming one. */
  actions?: React.ReactNode;
  className?: string;
};

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  actions,
  className,
}: DialogProps) {
  const { ref, closing, requestClose, onAnimationEnd, onBackdropMouseDown } =
    useNativeDialog(open, onClose);

  // Unique per instance: the admin screens mount several dialogs side by side,
  // and a literal id would label them all with the first one's heading.
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
        className="flex h-full w-full items-center justify-center p-4"
      >
        {/* A column with a scrollable middle, not one tall box: the multi-step
            lead wizard is taller than a 13" laptop's viewport, and a dialog that
            overflows puts its own submit button off-screen with no way to reach
            it. Header and actions stay pinned; only the body scrolls. */}
        <div
          onAnimationEnd={onAnimationEnd}
          className={cn(
            "flex max-h-[calc(100dvh-2rem)] w-full max-w-[28rem] flex-col rounded-card border border-line bg-surface shadow-float",
            closing ? "animate-dialog-out" : "animate-dialog-in",
            className,
          )}
        >
          <div className="flex shrink-0 items-start justify-between gap-4 p-4 pb-0">
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
              className="-mr-2 -mt-2 inline-flex h-touch w-touch items-center justify-center rounded-button text-muted transition-colors duration-micro ease-out hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>

          {description ? (
            <p className="shrink-0 px-4 pt-2 text-body text-muted">{description}</p>
          ) : null}

          {children ? <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div> : null}

          {actions ? (
            <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line p-4 sm:flex-row sm:justify-end">
              {actions}
            </div>
          ) : null}
        </div>
      </div>
    </dialog>
  );
}
