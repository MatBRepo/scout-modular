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
  const finalMinValue = props.minValue ?? 0;

  return (
    <NumberField {...props} minValue={finalMinValue}>
      <div className={cn("*:not-first:mt-2", className)}>
        {label && (
          <Label className="mb-1 block text-sm font-medium text-foreground">
            {label}
          </Label>
        )}

        <Group className="relative inline-flex h-9  items-center overflow-hidden whitespace-nowrap rounded-md border border-input text-sm shadow-xs outline-none transition-[color,box-shadow] data-focus-within:border-ring data-disabled:opacity-50 data-focus-within:ring-[3px] data-focus-within:ring-ring/50 data-focus-within:has-aria-invalid:border-destructive data-focus-within:has-aria-invalid:ring-destructive/20 dark:data-focus-within:has-aria-invalid:ring-destructive/40">
          <Button
            className="-ms-px flex aspect-square h-[inherit] items-center justify-center rounded-s-md border border-input bg-background text-sm text-muted-foreground/80 transition-[color,box-shadow] hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50"
            slot="decrement"
          >
            <MinusIcon aria-hidden="true" size={16} />
          </Button>

          <Input
            className="h-8 w-[180px] grow bg-background px-3 py-2 text-left text-foreground tabular-nums"
            placeholder={placeholder}
            onKeyDown={(e) => {
              if (e.key === "-" || e.key === "Subtract") {
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
