import Link from "next/link";
import type { ComponentProps } from "react";
import { buttonVariants } from "@/components/ui";
import { cn } from "@/lib/cn";

type Variant = "accent" | "quiet" | "ghost";

export type LinkButtonProps = ComponentProps<typeof Link> & {
  variant?: Variant;
  size?: "sm" | "md" | "lg";
  block?: boolean;
};

/**
 * A link that looks like a button. Lives here, not in src/components/ui (owned by
 * another agent) — worth promoting during integration; it is not events-specific.
 */
export function LinkButton({
  className,
  variant = "quiet",
  size = "md",
  block = false,
  ...props
}: LinkButtonProps) {
  return <Link className={cn(buttonVariants({ variant, size, block }), className)} {...props} />;
}
