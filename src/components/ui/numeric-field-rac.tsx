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
  // Destructure so we can override minValue / formatOptions safely
  const { minValue, formatOptions, ...restProps } = props;

  // No negatives
  const finalMinValue = minValue ?? 0;

  // Force integer-only (no fraction digits) – blocks 122,22 / 122.22 as decimal
  const mergedFormatOptions: Intl.NumberFormatOptions = {
    ...formatOptions,
    maximumFractionDigits: 0,
  };

  return (
    <NumberField
      {...restProps}
      minValue={finalMinValue}
      formatOptions={mergedFormatOptions}
    >
      <div className={cn("*:not-first:mt-2", className)}>
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
