"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ActionResult } from "../action-result";

/**
 * Every admin mutation reports back the same way: a toast that says what
 * happened, and — on failure — whether money moved (DESIGN_PRINCIPLES §6.10).
 */
export function useActionToast(state: ActionResult, onSuccess?: () => void) {
  const { toast } = useToast();
  const previous = useRef<ActionResult>(state);
  const successRef = useRef(onSuccess);
  successRef.current = onSuccess;

  useEffect(() => {
    if (state === previous.current) return;
    previous.current = state;

    if (state.status === "ok") {
      toast({ tone: "ok", message: state.message, ...(state.detail ? { detail: state.detail } : {}) });
      successRef.current?.();
      return;
    }

    if (state.status === "error") {
      const detail = state.fields ? Object.values(state.fields).join(" ") : undefined;
      toast({ tone: "error", message: state.message, ...(detail ? { detail } : {}) });
    }
  }, [state, toast]);
}

export type SubmitButtonProps = Omit<ButtonProps, "loading" | "type"> & {
  children: React.ReactNode;
};

/** Pending state comes from the form itself, so the label never lies. */
export function SubmitButton({ children, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" loading={pending} {...props}>
      {children}
    </Button>
  );
}

export function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-ui text-danger">
      {message}
    </p>
  );
}
