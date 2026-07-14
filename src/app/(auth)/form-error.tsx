import { AlertTriangle } from "lucide-react";

/**
 * Form-level failure: what happened, and what to do about it. Not a toast —
 * a toast about a failed login would slide away while the user is still reading
 * it, and the form is where the answer belongs.
 */
export function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="flex items-start gap-2 rounded-button border border-danger bg-danger-soft p-3 text-ui text-ink"
    >
      <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0 text-danger" />
      <span>{message}</span>
    </p>
  );
}
