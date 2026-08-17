"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { maskCEP } from "@/lib/masks-br";

interface CepInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

export function CepInput({ value, onChange, ...props }: CepInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="postal-code"
      value={value}
      placeholder={props.placeholder ?? "00000-000"}
      onChange={(e) => onChange(maskCEP(e.target.value))}
    />
  );
}
