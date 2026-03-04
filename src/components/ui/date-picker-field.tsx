"use client";

import * as React from "react";
import { format, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// react-day-picker locale: use date-fns ptBR (DayPicker accepts date-fns Locale)
const locale = ptBR;

interface DatePickerFieldProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled,
  className,
  id,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);

  const date = React.useMemo(() => {
    if (!value || value.length !== 10) return undefined;
    try {
      return parse(value, "yyyy-MM-dd", new Date());
    } catch {
      return undefined;
    }
  }, [value]);

  const displayStr = date
    ? format(date, "dd/MM/yyyy", { locale: ptBR })
    : "";

  const handleSelect = (d: Date | undefined) => {
    if (!d) return;
    onChange(format(d, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <PopoverPrimitive.Trigger asChild>
        <Button
          type="button"
          id={id}
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start text-left font-normal h-9",
            !displayStr && "text-muted-foreground",
            className
          )}
          onClick={() => !open && setOpen(true)}
        >
          <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
          {displayStr || placeholder}
        </Button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-[100] p-0 rounded-xl border bg-popover shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          align="start"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            locale={locale}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
