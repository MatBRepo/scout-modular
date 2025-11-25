// src/components/ui/birthdate-picker-rac.tsx
"use client";

import { useMemo } from "react";
import { CalendarIcon } from "lucide-react";
import {
  Button,
  DatePicker,
  Group,
  Popover,
  Dialog,
  type DateValue,
} from "react-aria-components";
import { parseDate } from "@internationalized/date";

import { Calendar } from "@/components/ui/calendar-rac";
import { DateInput } from "@/components/ui/datefield-rac";
import { cn } from "@/lib/utils";

type BirthDatePickerProps = {
  // np. "2006"
  value?: string;
  // zwracamy tylko rok jako string, np. "2006"
  onChange: (value: string | null) => void;
  // Twój "np. 2006" – pokażemy to jako hint pod polem
  placeholder?: string;
  className?: string;
};

export function BirthDatePicker({
  value,
  onChange,
  placeholder,
  className,
}: BirthDatePickerProps) {
  // zamiana "2006" -> CalendarDate(2006-01-01) – tylko jako startowa data
  const defaultDate = useMemo(() => {
    if (!value) return undefined;
    const year = parseInt(value, 10);
    if (Number.isNaN(year)) return undefined;
    return parseDate(`${year}-01-01`);
  }, [value]);

  return (
    <div className={cn("space-y-1.5", className)}>
      <DatePicker
        // nie robimy controlled – jak w oryginalnym przykładzie React Aria
        defaultValue={defaultDate}
        onChange={(val: DateValue | null) => {
          // React Aria przekazuje CalendarDate – bierzemy tylko year
          onChange(val ? String(val.year) : null);
        }}
        className="w-full *:not-first:mt-2"
      >
        <div className="flex">
          <Group className="w-full">
            {/* UWAGA: bez placeholder prop – to powodowało błąd TS */}
            <DateInput className="pe-9" />
          </Group>
          <Button className="-ms-9 -me-px z-10 flex w-9 items-center justify-center rounded-e-md text-muted-foreground/80 outline-none transition-[color,box-shadow] hover:text-foreground data-focus-visible:border-ring data-focus-visible:ring-[3px] data-focus-visible:ring-ring/50">
            <CalendarIcon size={16} />
          </Button>
        </div>

        <Popover
          className="data-[entering]:fade-in-0 data-[entering]:zoom-in-95 data-[exiting]:fade-out-0 data-[exiting]:zoom-out-95 data-[placement=bottom]:slide-in-from-top-2 data-[placement=left]:slide-in-from-right-2 data-[placement=right]:slide-in-from-left-2 data-[placement=top]:slide-in-from-bottom-2 z-50 rounded-lg border bg-background text-popover-foreground shadow-lg outline-hidden data-entering:animate-in data-exiting:animate-out"
          offset={4}
        >
          <Dialog className="max-h-[inherit] overflow-auto p-2">
            <Calendar />
          </Dialog>
        </Popover>
      </DatePicker>

      {placeholder && (
        <p className="text-[11px] text-muted-foreground">{placeholder}</p>
      )}
    </div>
  );
}

export default BirthDatePicker;
