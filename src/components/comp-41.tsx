"use client";

import { CalendarIcon } from "lucide-react";
import {
  Button,
  DatePicker,
  Dialog,
  Group,
  Label,
  Popover,
} from "react-aria-components";

import { Calendar } from "@/components/ui/calendar-rac";
import { DateInput } from "@/components/ui/datefield-rac";

export default function Component() {
  return (
    <DatePicker className="*:not-first:mt-2">
      <Label className="font-medium text-foreground text-sm">Date picker</Label>
      <div className="flex">
        <Group className="w-full">
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
      <p
        aria-live="polite"
        className="mt-2 text-muted-foreground text-xs"
        role="region"
      >
        Built with{" "}
        <a
          className="underline hover:text-foreground"
          href="https://react-spectrum.adobe.com/react-aria/DatePicker.html"
          rel="noreferrer noopener nofollow"
          target="_blank"
        >
          React Aria
        </a>
      </p>
    </DatePicker>
  );
}
