"use client";

import { useEffect, useMemo, useState } from "react";
import type * as React from "react";
import type { DropdownNavProps, DropdownProps } from "react-day-picker";
import { format } from "date-fns";
import { CalendarDaysIcon, X, Clock, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

/**
 * Small hook: detect "mobile" by CSS media query.
 * No extra deps, no SSR crash (runs in effect).
 */
function useIsMobileQuery(query = "(max-width: 640px)") {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, [query]);

  return isMobile;
}

export function DateTimePicker24h({
  value,
  onChange,
  placeholder = "Data i godzina meczu",
}: Props) {
  const isMobile = useIsMobileQuery();
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
    if (!Number.isNaN(d.getTime())) setDateObj(d);
  }, [value.date, value.time]);

  const hours = useMemo(() => Array.from({ length: 24 }, (_, i) => i), []);
  const minutes = useMemo(() => Array.from({ length: 12 }, (_, i) => i * 5), []);

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

    onChange({
      date: `${year}-${month}-${day}`,
      time: `${hoursStr}:${minutesStr}`,
    });
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
    if (type === "hour") next.setHours(val);
    else next.setMinutes(val);
    emit(next);
  }

  const handleCalendarChange = (
    _value: string | number,
    _e: React.ChangeEventHandler<HTMLSelectElement>,
  ) => {
    const _event = { target: { value: String(_value) } } as React.ChangeEvent<
      HTMLSelectElement
    >;
    _e(_event);
  };

  function setNow() {
    const now = new Date();
    // round minutes to nearest 5 (nice for your 5-min UI)
    const m = now.getMinutes();
    const rounded = Math.round(m / 5) * 5;
    now.setMinutes(rounded === 60 ? 55 : rounded);
    emit(now);
  }

  function clearAll() {
    emit(undefined);
  }

  const TriggerButton = (
    <Button
      type="button"
      variant="outline"
      className={cn(
        "w-full justify-start text-left font-normal border-gray-300 dark:border-neutral-700",
        "h-10 sm:h-10",
        !dateObj && "text-muted-foreground",
      )}
    >
      <CalendarDaysIcon className="mr-2 h-4 w-4" />
      {dateObj ? format(dateObj, "dd.MM.yyyy HH:mm") : <span>{placeholder}</span>}
    </Button>
  );

  /**
   * --- Shared Calendar block ---
   * Using dropdown month/year as you already do.
   */
  const CalendarBlock = (
    <Calendar
      mode="single"
      selected={dateObj}
      onSelect={handleDateSelect}
      initialFocus
      captionLayout="dropdown"
      hideNavigation
      defaultMonth={dateObj || new Date()}
      className={cn("w-full sm:w-fit p-3 sm:p-2", isMobile && "p-3")}
      classNames={{
        month_caption: "mx-0",
      }}
      components={{
        Dropdown: (props: DropdownProps) => {
          return (
            <Select
              onValueChange={(val) => {
                if (props.onChange) handleCalendarChange(val, props.onChange);
              }}
              value={String(props.value)}
            >
              <SelectTrigger className="h-9 font-medium first:grow">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-[min(26rem,var(--radix-select-content-available-height))]">
                {props.options?.map((opt) => (
                  <SelectItem
                    disabled={opt.disabled}
                    key={opt.value}
                    value={String(opt.value)}
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        },
        DropdownNav: (props: DropdownNavProps) => (
          <div className="flex w-full items-center gap-2">{props.children}</div>
        ),
      }}
    />
  );

  /**
   * --- Mobile time UI: horizontal chips (big, comfy) ---
   */
  const MobileTimeBlock = (
    <div className="px-3 pb-2">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="h-4 w-4" />
          Godzina
        </div>

        <div className="text-xs text-muted-foreground">
          {dateObj ? format(dateObj, "HH:mm") : "--:--"}
        </div>
      </div>

      {/* Hours chips */}
      <ScrollArea className="w-full">
        <div className="flex gap-2 pb-2">
          {hours.map((h) => {
            const active = !!dateObj && dateObj.getHours() === h;
            return (
              <Button
                key={h}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                className={cn(
                  "h-9 min-w-12 rounded-full px-3 text-sm",
                  "active:scale-[0.98] transition-transform",
                )}
                onClick={() => handleTimeChange("hour", String(h))}
              >
                {String(h).padStart(2, "0")}
              </Button>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Minutes chips */}
      <div className="mt-3 mb-2 flex items-center justify-between">
        <div className="text-sm font-medium">Minuty</div>
        <div className="text-xs text-muted-foreground">co 5 min</div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {minutes.map((m) => {
          const active = !!dateObj && dateObj.getMinutes() === m;
          return (
            <Button
              key={m}
              type="button"
              size="sm"
              variant={active ? "default" : "outline"}
              className={cn(
                "h-9 rounded-xl text-sm",
                "active:scale-[0.98] transition-transform",
              )}
              onClick={() => handleTimeChange("minute", String(m))}
            >
              {String(m).padStart(2, "0")}
            </Button>
          );
        })}
      </div>
    </div>
  );

  /**
   * --- Desktop time UI: your two columns (kept), but nicer sizing ---
   */
  const DesktopTimeBlock = (
    <div className="flex flex-col sm:flex-row sm:divide-x">
      <div className="flex w-32 flex-col bg-stone-50 sm:w-36 dark:bg-stone-900/70">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
          Godzina
        </div>
        <ScrollArea className="h-64 w-full">
          <div className="space-y-1 p-2">
            {hours.map((hour) => (
              <Button
                key={hour}
                type="button"
                variant={dateObj && dateObj.getHours() === hour ? "default" : "ghost"}
                className="h-8 w-full justify-center px-2 text-xs"
                onClick={() => handleTimeChange("hour", hour.toString())}
              >
                {hour.toString().padStart(2, "0")}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>

      <div className="flex w-32 flex-col bg-stone-50 sm:w-36 dark:bg-stone-900/70">
        <div className="px-3 py-2 text-xs font-medium text-muted-foreground">
          Minuta
        </div>
        <ScrollArea className="h-64 w-full">
          <div className="space-y-1 p-2">
            {minutes.map((minute) => (
              <Button
                key={minute}
                type="button"
                variant={
                  dateObj && dateObj.getMinutes() === minute ? "default" : "ghost"
                }
                className="h-8 w-full justify-center px-2 text-xs"
                onClick={() => handleTimeChange("minute", minute.toString())}
              >
                {minute.toString().padStart(2, "0")}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="vertical" />
        </ScrollArea>
      </div>
    </div>
  );

  /**
   * --- Mobile "bottom sheet" content ---
   * Implemented with Popover but styled to behave like a sheet.
   */
  const MobileSheetContent = (
    <PopoverContent
      side="bottom"
      align="center"
      sideOffset={0}
      className={cn(
        "w-[100vw] max-w-[100vw] p-0",
        "rounded-t-2xl border-t shadow-2xl",
        "max-h-[85vh] overflow-hidden",
      )}
    >
      {/* Grab handle */}
      <div className="flex items-center justify-center py-2">
        <div className="h-1.5 w-10 rounded-full bg-muted" />
      </div>

      {/* Header */}
      <div className="px-4 pb-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Wybierz datę i godzinę</div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setIsOpen(false)}
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="mt-1 text-xs text-muted-foreground">
          {dateObj ? format(dateObj, "dd.MM.yyyy HH:mm") : "Brak wybranej daty"}
        </div>
      </div>

      <div className="overflow-auto">
        {/* Calendar */}
        <div className="px-2">{CalendarBlock}</div>

        {/* Time */}
        <div className="mt-1">{MobileTimeBlock}</div>
      </div>

      {/* Sticky actions (safe-area friendly) */}
      <div className="sticky bottom-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <div className="flex gap-2 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={setNow}
          >
            <Clock className="mr-2 h-4 w-4" />
            Teraz
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            onClick={clearAll}
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Wyczyść
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => setIsOpen(false)}
          >
            Gotowe
          </Button>
        </div>
      </div>
    </PopoverContent>
  );

  /**
   * --- Desktop popover content ---
   */
  const DesktopPopoverContent = (
    <PopoverContent
      side="bottom"
      align="end"
      sideOffset={4}
      className="w-auto max-w-[100vw] p-0"
    >
      {/* Top action row */}
      <div className="flex items-center justify-between gap-2 border-b px-2 py-2">
        <div className="px-2 text-xs text-muted-foreground">
          {dateObj ? format(dateObj, "dd.MM.yyyy HH:mm") : "Wybierz datę i godzinę"}
        </div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="ghost" onClick={setNow}>
            Teraz
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={clearAll}>
            Wyczyść
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            onClick={() => setIsOpen(false)}
            aria-label="Zamknij"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="sm:flex">
        <div className="flex-1">{CalendarBlock}</div>
        {DesktopTimeBlock}
      </div>
    </PopoverContent>
  );

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{TriggerButton}</PopoverTrigger>
      {isMobile ? MobileSheetContent : DesktopPopoverContent}
    </Popover>
  );
}

export default DateTimePicker24h;
