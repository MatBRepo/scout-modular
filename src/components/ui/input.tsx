import type * as React from "react";
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={cn(
        // base
        "flex h-9 w-full min-w-0 rounded-md bg-transparent px-3 py-1 outline-none",
        "transition-[color,box-shadow,border-color]",

        // ✅ prevent iOS zoom: >=16px on mobile, keep sm on desktop
        "text-[16px] sm:text-sm",

        // border + shadow
        "border border-stone-400",
        "shadow-[0_0_0_1px_#f5f5f4]",

        "file:inline-flex file:h-7 file:border-0 file:bg-transparent file:font-medium file:text-foreground file:text-sm",
        "placeholder:text-muted-foreground/70 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",

        "focus-visible:border-stone-500",
        "focus-visible:ring-[3px] focus-visible:ring-stone-200/70",

        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40",

        type === "search" &&
          "[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none [&::-webkit-search-results-button]:appearance-none [&::-webkit-search-results-decoration]:appearance-none",
        type === "file" &&
          "p-0 pr-3 text-muted-foreground/70 italic file:me-3 file:h-full file:border-0 file:border-input file:border-r file:border-solid file:bg-transparent file:px-3 file:font-medium file:text-foreground file:text-sm file:not-italic",

        className,
      )}
      data-slot="input"
      type={type}
      {...props}
    />
  );
}

export { Input };
