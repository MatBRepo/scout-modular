"use client";

import { useEffect, useState } from "react";
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

  function emit(next: Date | undefined) {
    if (!next) {
      setDateObj(undefined);
      onChange({ date: "", time: "" });
      return;
    }
    setDateObj(next);
    const iso = next.toISOString();
    const dateStr = iso.slice(0, 10); // YYYY-MM-DD
    const timeStr = iso.slice(11, 16); // HH:mm
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

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal border-gray-300 dark:border-neutral-700",
            !dateObj && "text-muted-foreground"
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

      <PopoverContent className="w-auto p-0" align="start">
        <div className="sm:flex">
          <Calendar
            mode="single"
            selected={dateObj}
            onSelect={handleDateSelect}
            initialFocus
          />

          <div className="flex flex-col divide-y sm:h-[300px] sm:flex-row sm:divide-y-0 sm:divide-x">
            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex p-2 sm:flex-col">
                {hours.map((hour) => (
                  <Button
                    key={hour}
                    type="button"
                    size="icon"
                    variant={
                      dateObj && dateObj.getHours() === hour
                        ? "default"
                        : "ghost"
                    }
                    className="aspect-square shrink-0 sm:w-full"
                    onClick={() => handleTimeChange("hour", hour.toString())}
                  >
                    {hour.toString().padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>

            <ScrollArea className="w-64 sm:w-auto">
              <div className="flex p-2 sm:flex-col">
                {minutes.map((minute) => (
                  <Button
                    key={minute}
                    type="button"
                    size="icon"
                    variant={
                      dateObj && dateObj.getMinutes() === minute
                        ? "default"
                        : "ghost"
                    }
                    className="aspect-square shrink-0 sm:w-full"
                    onClick={() =>
                      handleTimeChange("minute", minute.toString())
                    }
                  >
                    {minute.toString().padStart(2, "0")}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="sm:hidden" />
            </ScrollArea>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DateTimePicker24h;
