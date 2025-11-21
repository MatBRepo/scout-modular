// src/shared/ui/RadioChipGroup.tsx
"use client";

import { useId } from "react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { cn } from "@/lib/utils";

type RadioChipOption = {
  value: string;
  label: string;
  disabled?: boolean;
};

type RadioChipGroupProps = {
  legend?: string;
  options: RadioChipOption[];
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  className?: string;
  /**
   * Tailwind grid columns, e.g. "grid-cols-3".
   * If not set, it just wraps with flex.
   */
  layout?: "grid-2" | "grid-3" | "grid-4" | "wrap";
};

export function RadioChipGroup({
  legend,
  options,
  value,
  defaultValue,
  onChange,
  className,
  layout = "wrap",
}: RadioChipGroupProps) {
  const id = useId();

  const layoutClass =
    layout === "wrap"
      ? "flex flex-wrap gap-2"
      : cn(
          "grid gap-2",
          layout === "grid-2" && "grid-cols-2",
          layout === "grid-3" && "grid-cols-3",
          layout === "grid-4" && "grid-cols-4"
        );

  return (
    <fieldset className={cn("w-full space-y-2", className)}>
      {legend && (
        <legend className="text-sm font-medium text-foreground">
          {legend}
        </legend>
      )}

      <RadioGroup
        value={value}
        defaultValue={defaultValue}
        onValueChange={onChange}
        className={layoutClass}
      >
        {options.map((item) => {
          const itemId = `${id}-${item.value}`;
          return (
            <label
              key={itemId}
              htmlFor={itemId}
              className={cn(
                // base “tile”
                "relative flex cursor-pointer select-none items-center justify-center rounded-md border border-input px-4 py-2 text-center text-sm shadow-sm transition-[color,box-shadow,border-color,background-color]",
                // when the inner RadioGroupItem is checked
                "has-[data-state=checked]:border-black has-[data-state=checked]:bg-slate-50",
                // focus ring when the radio has focus-visible
                "has-[data-state=checked]:ring-[1.5px] has-[data-state=checked]:ring-black/40 has-[data-focus-visible]:border-ring has-[data-focus-visible]:ring-[3px] has-[data-focus-visible]:ring-ring/50",
                // disabled
                "has-[data-disabled]:cursor-not-allowed has-[data-disabled]:opacity-50"
              )}
            >
              <RadioGroupItem
                id={itemId}
                value={item.value}
                disabled={item.disabled}
                className="sr-only"
                aria-label={item.label}
              />
              <p className="text-sm font-medium text-foreground">
                {item.label}
              </p>
            </label>
          );
        })}
      </RadioGroup>
    </fieldset>
  );
}
