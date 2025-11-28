import type * as React from "react";

import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      className={cn(
        // base
        "flex w-full min-w-0 rounded-md bg-transparent px-3 py-2 text-sm outline-none",
        "transition-[color,box-shadow,border-color]",
        // === DEFAULT BORDER & SHADOW (same idea as Input) ===
        "border border-stone-400",
        "shadow-[0_0_0_1px_#f5f5f4]",
        // placeholder / disabled
        "placeholder:text-muted-foreground/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        // focus
        "focus-visible:border-stone-500",
        "focus-visible:ring-[3px] focus-visible:ring-stone-200/70",
        // invalid
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
        // min height
        "min-h-[78px]", // ~19.5 * 4px, możesz zmienić
        className,
      )}
      data-slot="textarea"
      {...props}
    />
  );
}
Textarea.displayName = "Textarea";

export { Textarea };
