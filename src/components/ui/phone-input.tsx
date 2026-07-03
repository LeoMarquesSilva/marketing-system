"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";

export function maskPhoneBR(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

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
