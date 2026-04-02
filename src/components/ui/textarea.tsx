import * as React from "react";
import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          // base
          "flex w-full min-w-0 rounded-md bg-transparent px-3 py-2 text-sm outline-none",
          "transition-[color,box-shadow,border-color]",
          // border
          "border",
          // placeholder / disabled
          "placeholder:text-muted-foreground/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
          // invalid
          "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",
          // min height
          "min-h-[78px]", 
          className,
        )}
        data-slot="textarea"
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
