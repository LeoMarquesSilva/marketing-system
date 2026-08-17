"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { maskCPF } from "@/lib/masks-br";

interface CpfInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

export function CpfInput({ value, onChange, ...props }: CpfInputProps) {
  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      value={value}
      placeholder={props.placeholder ?? "000.000.000-00"}
      onChange={(e) => onChange(maskCPF(e.target.value))}
    />
  );
}
