// src/components/ui/checkbox.tsx
"use client";

import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxProps
  extends React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> {}

export const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  CheckboxProps
>(({ className, ...props }, ref) => {
  return (
    <CheckboxPrimitive.Root
      ref={ref}
      {...props}
className={cn(
  // base box
  "grid place-content-center h-4 w-4 shrink-0 rounded border",
  // colors (light/dark)
  "border-stone-300 bg-background text-primary dark:border-neutral-700 rounded",
  // focus
  "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded",
  // disabled
  "disabled:cursor-not-allowed disabled:opacity-50",
  // checked
  "data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground rounded",
  // indeterminate
  "data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary data-[state=indeterminate]:text-primary-foreground rounded",
  className
)}

    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
        {/* will render either check or minus via aria state */}
        <Check className="h-3.5 w-3.5 data-[state=checked]:block" />
        <Minus className="h-3.5 w-3.5 data-[state=indeterminate]:block hidden" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  );
});
Checkbox.displayName = "Checkbox";
export default Checkbox;
