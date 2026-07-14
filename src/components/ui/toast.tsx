"use client";

import { AlertTriangle, Check, Info, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@/lib/cn";

export type ToastTone = "ok" | "error" | "info";

export type Toast = {
  id: string;
  tone: ToastTone;
  /** What happened. Active voice, Polish, no apology. */
  message: string;
  /** For errors: did it cost money, and what to do next. */
  detail?: string;
};

type ToastInput = Omit<Toast, "id">;

type ToastContextValue = {
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 6000;

const TONE_ICON: Record<ToastTone, typeof Check> = {
  ok: Check,
  error: AlertTriangle,
  info: Info,
};

const TONE_CLASS: Record<ToastTone, string> = {
  // Success is one of the three sanctioned uses of the accent.
  ok: "border-accent text-ink",
  error: "border-danger text-ink",
  info: "border-line text-ink",
};

const TONE_ICON_CLASS: Record<ToastTone, string> = {
  ok: "text-accent",
  error: "text-danger",
  info: "text-muted",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const toast = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((current) => [...current, { ...input, id }]);
      // Errors stay until dismissed: an error that scrolls away is an error twice.
      if (input.tone !== "error") {
        timers.current.set(
          id,
          setTimeout(() => dismiss(id), AUTO_DISMISS_MS),
        );
      }
    },
    [dismiss],
  );

  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
      >
        {toasts.map((item) => {
          const Icon = TONE_ICON[item.tone];
          return (
            <div
              key={item.id}
              className={cn(
                "pointer-events-auto flex w-full max-w-[26rem] animate-sheet-up items-start gap-3 rounded-card border bg-surface p-3 shadow-float",
                TONE_CLASS[item.tone],
              )}
            >
              <Icon
                size={20}
                aria-hidden="true"
                className={cn("mt-0.5 shrink-0", TONE_ICON_CLASS[item.tone])}
              />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <p className="text-body font-semibold">{item.message}</p>
                {item.detail ? (
                  <p className="text-ui text-muted">{item.detail}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Zamknij powiadomienie"
                className="-m-1 inline-flex h-touch w-touch shrink-0 items-center justify-center rounded-button text-muted transition-colors duration-micro ease-out hover:bg-surface-2 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return context;
}
