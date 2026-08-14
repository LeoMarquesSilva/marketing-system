"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import {
  brlNumberToFormString,
  formatBrlInput,
  numberToCentsDigits,
  parseBrlInput,
} from "@/lib/money-br";
import { cn } from "@/lib/utils";

interface CurrencyInputProps
  extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  /** Valor numérico em reais como string canônica ("2323.2") ou vazio. */
  value: string;
  onChange: (value: string) => void;
}

/**
 * Campo de dinheiro pt-BR: digita só números (centavos) e exibe R$ 2.323,20.
 * Aceita colar "2.323,20" / "R$ 2.323,20" e interpreta corretamente.
 */
export function CurrencyInput({ value, onChange, className, onBlur, ...props }: CurrencyInputProps) {
  const numeric = value.trim() === "" ? null : Number(value);
  const digits =
    numeric != null && Number.isFinite(numeric) ? numberToCentsDigits(numeric) : "";
  const display = formatBrlInput(digits);

  function commitDigits(nextDigits: string) {
    if (!nextDigits) {
      onChange("");
      return;
    }
    const n = Number(nextDigits) / 100;
    onChange(brlNumberToFormString(n));
  }

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      className={cn("tabular-nums", className)}
      value={display}
      placeholder={props.placeholder ?? "R$ 0,00"}
      onChange={(e) => {
        commitDigits(e.target.value.replace(/\D/g, "").slice(0, 12));
      }}
      onPaste={(e) => {
        const text = e.clipboardData.getData("text");
        const parsed = parseBrlInput(text);
        if (parsed == null) return;
        e.preventDefault();
        onChange(brlNumberToFormString(parsed));
      }}
      onBlur={(e) => {
        if (display) {
          const parsed = parseBrlInput(display);
          if (parsed != null) onChange(brlNumberToFormString(parsed));
        }
        onBlur?.(e);
      }}
    />
  );
}
