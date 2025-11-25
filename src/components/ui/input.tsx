import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type = "text", ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          // size & layout
          "flex h-10 w-full px-3 py-2 text-sm",
          // base visual: 1px inset ring works as the border
          "rounded-md bg-background/90 text-foreground shadow-sm",
          "ring-1 ring-inset ring-border",
          // placeholder
          "placeholder:text-muted-foreground",
          // focus – same thickness, only color change
          "focus-visible:outline-none",
          "focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-emerald-500",
          // disabled
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          // optional invalid state: <Input data-invalid />
          "data-[invalid=true]:ring-destructive",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";

export { Input };
