"use client";

import { MinusIcon, PlusIcon } from "lucide-react";
import {
  Button,
  Group,
  Input,
  Label,
  NumberField,
  type NumberFieldProps,
} from "react-aria-components";
import { cn } from "@/lib/utils";

type NumericFieldProps = {
  label?: string;
  className?: string;
  placeholder?: string;
} & Omit<NumberFieldProps, "children">;

export function NumericField({
  label,
  className,
  placeholder,
  ...props
}: NumericFieldProps) {
  // Destructure so we can override safely
  const { minValue, formatOptions, step, onChange, ...restProps } = props;

  // No negatives
  const finalMinValue = minValue ?? 0;

  // Force integer-only formatting
  const mergedFormatOptions: Intl.NumberFormatOptions = {
    ...formatOptions,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  };

  // Integer step (prevents wheel/buttons from producing fractions)
  const finalStep = step ?? 1;

  return (
    <NumberField
      {...restProps}
      minValue={finalMinValue}
      step={finalStep}
      formatOptions={mergedFormatOptions}
      onChange={(value: any) => {
        // react-aria NumberField can pass number | null
        if (value == null) {
          onChange?.(value);
          return;
        }

        // Hard clamp to integer (no decimals ever)
        const intValue =
          typeof value === "number" && Number.isFinite(value)
            ? Math.trunc(value)
            : value;

        onChange?.(intValue);
      }}
    >
      <div className={cn("*:not-first:mt-2", className)} data-rz-integer>
        {label && (
          <Label className="mb-1 block text-sm font-medium text-foreground">
            {label}
          </Label>
        )}

        <Group className="w-full md:w-fit relative inline-flex h-9 items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-[3px] data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
          <Button
            className="-ms-px flex aspect-square h-[inherit] items-center justify-center rounded-s-md border border-input bg-background text-sm text-muted-foreground/80 transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            slot="decrement"
          >
            <MinusIcon aria-hidden="true" size={16} />
          </Button>

          <Input
            className="h-8 w-full sm:w-20 bg-background px-3 py-2 text-left text-foreground tabular-nums"
            placeholder={placeholder}
            inputMode="numeric"
            pattern="[0-9]*"
            onKeyDown={(e) => {
              // Block minus & decimals (including numpad + locale comma)
              if (
                e.key === "-" ||
                e.key === "Subtract" ||
                e.key === "." ||
                e.key === "Decimal" ||
                e.key === ","
              ) {
                e.preventDefault();
              }
            }}
            onPaste={(e) => {
              const text = e.clipboardData.getData("text");
              // allow only digits (no spaces, no separators, no minus)
              if (!/^\d+$/.test(text)) e.preventDefault();
            }}
          />

          <Button
            className="-me-px flex aspect-square h-[inherit] items-center justify-center rounded-e-md border border-input bg-background text-sm text-muted-foreground/80 transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            slot="increment"
          >
            <PlusIcon aria-hidden="true" size={16} />
          </Button>
        </Group>
      </div>
    </NumberField>
  );
}
