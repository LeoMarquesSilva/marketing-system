"use client";

import * as React from "react";
import { format, isValid, parse } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Popover as PopoverPrimitive } from "radix-ui";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const locale = ptBR;

interface DatePickerFieldProps {
  value: string; // YYYY-MM-DD or ""
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  startYear?: number;
  endYear?: number;
}

function isoToDisplay(iso: string): string {
  if (!iso || iso.length !== 10) return "";
  const date = parse(iso, "yyyy-MM-dd", new Date());
  if (!isValid(date)) return "";
  return format(date, "dd/MM/yyyy");
}

function displayToIso(display: string): string | null {
  const cleaned = display.trim();
  if (!cleaned) return "";

  let normalized = cleaned;
  if (/^\d{8}$/.test(cleaned)) {
    normalized = `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
  }

  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(normalized)) return null;

  const date = parse(normalized, "dd/MM/yyyy", new Date());
  if (!isValid(date)) return null;
  // Evita parsing permissivo (ex.: 32/01/2024 → feb).
  if (format(date, "dd/MM/yyyy") !== normalized) return null;
  return format(date, "yyyy-MM-dd");
}

function maskDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function DatePickerField({
  value,
  onChange,
  placeholder = "DD/MM/AAAA",
  disabled,
  className,
  id,
  startYear,
  endYear,
}: DatePickerFieldProps) {
  const [open, setOpen] = React.useState(false);
  const [text, setText] = React.useState(() => isoToDisplay(value));

  React.useEffect(() => {
    setText(isoToDisplay(value));
  }, [value]);

  const date = React.useMemo(() => {
    if (!value || value.length !== 10) return undefined;
    const parsed = parse(value, "yyyy-MM-dd", new Date());
    return isValid(parsed) ? parsed : undefined;
  }, [value]);

  const year = new Date().getFullYear();
  const startMonth = new Date(startYear ?? year - 30, 0);
  const endMonth = new Date(endYear ?? year + 10, 11);

  const commitText = (next: string) => {
    const iso = displayToIso(next);
    if (iso === null) {
      setText(isoToDisplay(value));
      return;
    }
    onChange(iso);
    setText(iso === "" ? "" : isoToDisplay(iso));
  };

  const handleSelect = (selected: Date | undefined) => {
    if (!selected) return;
    onChange(format(selected, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen} modal={false}>
      <div className="relative w-full">
        <Input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={text}
          onChange={(event) => {
            const masked = maskDateInput(event.target.value);
            setText(masked);
            if (masked.length === 10) {
              const iso = displayToIso(masked);
              if (iso) onChange(iso);
            } else if (masked === "") {
              onChange("");
            }
          }}
          onBlur={() => commitText(text)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitText(text);
            }
            if (event.key === "ArrowDown" && event.altKey) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={cn("h-9 pr-9", className)}
        />
        <PopoverPrimitive.Trigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled}
            aria-label="Abrir calendário"
            aria-expanded={open}
            className="absolute top-1/2 right-0.5 h-8 w-8 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverPrimitive.Trigger>
      </div>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          className="z-[100] rounded-xl border bg-popover p-0 shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          align="end"
          sideOffset={4}
        >
          <Calendar
            mode="single"
            selected={date}
            onSelect={handleSelect}
            locale={locale}
            captionLayout="dropdown"
            startMonth={startMonth}
            endMonth={endMonth}
            defaultMonth={date}
            formatters={{
              formatMonthDropdown: (month) =>
                format(month, "LLL", { locale: ptBR }),
            }}
          />
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
