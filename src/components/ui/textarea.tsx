import { forwardRef } from "react";
import { cn } from "@/lib/cn";
import { inputBase } from "./input";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, rows = 4, ...props }, ref) {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(inputBase, "min-h-[6rem] resize-y", className)}
        {...props}
      />
    );
  },
);
