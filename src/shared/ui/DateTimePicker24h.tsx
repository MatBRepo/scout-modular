"use client";

import { useEffect, useState } from "react";
import type * as React from "react";
import type { DropdownNavProps, DropdownProps } from "react-day-picker";
import { format } from "date-fns";
import { CalendarDaysIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export type DateTimeValue = {
  date: string; // "YYYY-MM-DD" or ""
  time: string; // "HH:mm" or ""
};

type Props = {
  value: DateTimeValue;
  onChange: (value: DateTimeValue) => void;
  placeholder?: string;
};

export function DateTimePicker24h({
  value,
  onChange,
  placeholder = "Data i godzina meczu",
}: Props) {
  const [isOpen, setIsOpen] = useState(false);

  const [dateObj, setDateObj] = useState<Date | undefined>(() => {
    if (value.date) {
      const d = new Date(`${value.date}T${value.time || "12:00"}:00`);
      return Number.isNaN(d.getTime()) ? undefined : d;
    }
    return undefined;
  });

  useEffect(() => {
    if (!value.date) {
      setDateObj(undefined);
      return;
    }
    const d = new Date(`${value.date}T${value.time || "12:00"}:00`);
    if (!Number.isNaN(d.getTime())) {
      setDateObj(d);
    }
  }, [value.date, value.time]);

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  // ✅ Use local parts instead of toISOString (no timezone shift)
  function emit(next: Date | undefined) {
    if (!next) {
      setDateObj(undefined);
      onChange({ date: "", time: "" });
      return;
    }

    setDateObj(next);

    const year = next.getFullYear();
    const month = String(next.getMonth() + 1).padStart(2, "0");
    const day = String(next.getDate()).padStart(2, "0");
    const hoursStr = String(next.getHours()).padStart(2, "0");
    const minutesStr = String(next.getMinutes()).padStart(2, "0");

    const dateStr = `${year}-${month}-${day}`; // YYYY-MM-DD
    const timeStr = `${hoursStr}:${minutesStr}`; // HH:mm

    onChange({ date: dateStr, time: timeStr });
  }

  function handleDateSelect(selected: Date | undefined) {
    if (!selected) {
      emit(undefined);
      return;
    }
    const base = dateObj ?? new Date();
    const next = new Date(selected);
    next.setHours(base.getHours());
    next.setMinutes(base.getMinutes());
    emit(next);
  }

  function handleTimeChange(type: "hour" | "minute", raw: string) {
    const base = dateObj ?? new Date();
    const next = new Date(base);
    const val = parseInt(raw, 10);
    if (Number.isNaN(val)) return;
    if (type === "hour") {
      next.setHours(val);
    } else {
      next.setMinutes(val);
    }
    emit(next);
  }

  const handleCalendarChange = (
    _value: string | number,
    _e: React.ChangeEventHandler<HTMLSelectElement>,
  ) => {
    const _event = {
      target: {
        value: String(_value),
      },
    } as React.ChangeEvent<HTMLSelectElement>;
    _e(_event);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal border-gray-300 dark:border-neutral-700",
            !dateObj && "text-muted-foreground",
          )}
        >
          <CalendarDaysIcon className="mr-2 h-4 w-4" />
          {dateObj ? (
            format(dateObj, "dd.MM.yyyy HH:mm")
          ) : (
            <span>{placeholder}</span>
          )}
        </Button>
      </PopoverTrigger>

      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        className="w-auto max-w-[100vw] p-0"
      >
        <div className="sm:flex">
          {/* Calendar with dropdown month/year */}
          <div className="flex-1">
            <Calendar
              mode="single"
              selected={dateObj}
              onSelect={handleDateSelect}
              initialFocus
              captionLayout="dropdown"
              hideNavigation
              defaultMonth={dateObj || new Date()}
              className="p-2"
              classNames={{
                month_caption: "mx-0",
              }}
              components={{
                Dropdown: (props: DropdownProps) => {
                  return (
                    <Select
                      onValueChange={(value) => {
                        if (props.onChange) {
                          handleCalendarChange(value, props.onChange);
                        }
                      }}
                      value={String(props.value)}
                    >
                      <SelectTrigger className="h-8 w-fit font-medium first:grow">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-[min(26rem,var(--radix-select-content-available-height))]">
                        {props.options?.map((option) => (
                          <SelectItem
                            disabled={option.disabled}
                            key={option.value}
                            value={String(option.value)}
                          >
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                },
                DropdownNav: (props: DropdownNavProps) => {
                  return (
                    <div className="flex w-full items-center gap-2">
                      {props.children}
                    </div>
                  );
                },
              }}
            />
          </div>

          {/* Time picker */}
          <div className="flex flex-col sm:flex-row sm:divide-x">
            {/* Hours column */}
            <div className="flex w-32 flex-col bg-stone-50 sm:w-36 dark:bg-stone-900/70">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                Godzina
              </div>
              <ScrollArea className="h-64 w-full">
                <div className="space-y-1 p-2">
                  {hours.map((hour) => (
                    <Button
                      key={hour}
                      type="button"
                      variant={
                        dateObj && dateObj.getHours() === hour
                          ? "default"
                          : "ghost"
                      }
                      className="h-7 w-full justify-center px-2 text-xs"
                      onClick={() => handleTimeChange("hour", hour.toString())}
                    >
                      {hour.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </div>

            {/* Minutes column */}
            <div className="flex w-32 flex-col bg-stone-50 sm:w-36 dark:bg-stone-900/70">
              <div className="px-3 py-1 text-xs font-medium text-muted-foreground">
                Minuta
              </div>
              <ScrollArea className="h-64 w-full">
                <div className="space-y-1 p-2">
                  {minutes.map((minute) => (
                    <Button
                      key={minute}
                      type="button"
                      variant={
                        dateObj && dateObj.getMinutes() === minute
                          ? "default"
                          : "ghost"
                      }
                      className="h-7 w-full justify-center px-2 text-xs"
                      onClick={() =>
                        handleTimeChange("minute", minute.toString())
                      }
                    >
                      {minute.toString().padStart(2, "0")}
                    </Button>
                  ))}
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateTimePicker24h;
