/**
 * The shape every admin server action answers with, and its initial value.
 *
 * This is NOT in actions.ts, and that is not a matter of taste: actions.ts carries
 * "use server", and such a file may only export async functions. Exporting the
 * `IDLE` object from there made Next.js throw
 *
 *   Error: A "use server" file can only export async functions, found object.
 *
 * at the moment an action was invoked — so every admin action answered 500:
 * approving a parking, rejecting one, refunds, payouts, commissions, venues,
 * events. The admin panel rendered perfectly and did nothing.
 *
 * `next build` does not catch it. It is thrown when the action bundle loads.
 */
export type ActionResult =
  | { status: "idle" }
  | {
      status: "ok";
      message: string;
      detail?: string;
      /**
       * Something the operator must read and pass on — a temporary password.
       * Separate from `detail` because it must NOT be flashed in a toast that
       * disappears after four seconds: the screen keeps it until dismissed, and
       * it is the only time it can be read. Never logged, never mailed.
       */
      secret?: { label: string; value: string };
    }
  | { status: "error"; message: string; fields?: Record<string, string> };

export const IDLE: ActionResult = { status: "idle" };
