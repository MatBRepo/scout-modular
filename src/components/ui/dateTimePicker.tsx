"use client";

import { useId, useState } from "react";
import type * as React from "react";
import type { DropdownNavProps, DropdownProps } from "react-day-picker";

import { ClockIcon } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function Component() {
  const id = useId();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("12:00:00");

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
    <div>
      <div className="rounded-md border">
        <Calendar
          captionLayout="dropdown"
          className="rounded-md border-0 p-2"
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
          defaultMonth={new Date()}
          hideNavigation
          mode="single"
          onSelect={setDate}
          selected={date}
          startMonth={new Date(1980, 6)}
        />

        {/* Time input footer */}
        <div className="border-t p-3">
          <div className="flex items-center gap-3">
            <Label className="text-xs" htmlFor={id}>
              Enter time
            </Label>
            <div className="relative grow">
              <Input
                id={id}
                type="time"
                step="1"
                className="peer appearance-none ps-9 [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
              <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center justify-center ps-3 text-muted-foreground/80 peer-disabled:opacity-50">
                <ClockIcon aria-hidden="true" size={16} />
              </div>
            </div>
          </div>
        </div>
      </div>

      <p
        aria-live="polite"
        className="mt-4 text-center text-xs text-muted-foreground"
        role="region"
      >
        Date &amp; time picker –{" "}
        <a
          className="underline hover:text-foreground"
          href="https://daypicker.dev/"
          rel="noreferrer noopener nofollow"
          target="_blank"
        >
          React DayPicker
        </a>
      </p>
    </div>
  );
}
