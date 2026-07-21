"use client";

import { CheckCircle2, CircleAlert, X } from "lucide-react";

export interface NfcToastValue {
  type: "success" | "error";
  message: string;
}

export function NfcToast({
  value,
  onDismiss,
}: {
  value: NfcToastValue | null;
  onDismiss: () => void;
}) {
  if (!value) return null;
  return (
    <div
      role={value.type === "error" ? "alert" : "status"}
      className={`fixed bottom-20 right-4 z-[80] flex max-w-[calc(100vw-2rem)] items-start gap-3 rounded-md border bg-white px-4 py-3 text-sm shadow-xl md:bottom-6 ${
        value.type === "success" ? "border-emerald-200 text-emerald-900" : "border-red-200 text-red-900"
      }`}
    >
      {value.type === "success" ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
      )}
      <span className="min-w-0 flex-1">{value.message}</span>
      <button type="button" onClick={onDismiss} aria-label="Fechar aviso" className="rounded p-1 hover:bg-black/5">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
