"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { maskPhoneBR } from "@/lib/masks-br";

export { maskPhoneBR };

interface PhoneInputProps extends Omit<React.ComponentProps<"input">, "value" | "onChange" | "type"> {
  value: string;
  onChange: (value: string) => void;
}

export function PhoneInput({ value, onChange, ...props }: PhoneInputProps) {
  return (
    <Input
      {...props}
      type="tel"
      inputMode="tel"
      value={value}
      placeholder={props.placeholder ?? "(00) 00000-0000"}
      onChange={(e) => onChange(maskPhoneBR(e.target.value))}
    />
  );
}
