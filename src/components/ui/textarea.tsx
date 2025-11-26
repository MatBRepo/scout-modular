import * as React from "react";

import { cn } from "@/lib/utils";

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.ComponentProps<"textarea">
>(({ className, rows = 4, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(
        // 2px cut from left & right (4px total) + center
        "flex min-h-[96px] w-[calc(100%-4px)] mx-auto",
        // base styles
        "rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background",
        "placeholder:text-muted-foreground",
        // focus styles (same as Input)
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-dark focus-visible:ring-offset-1",
        // disabled state
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  );
});
Textarea.displayName = "Textarea";

export { Textarea };
