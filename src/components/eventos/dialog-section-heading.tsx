import type { ElementType, ReactNode } from "react";

export function DialogSectionHeading({ icon: Icon, children }: { icon: ElementType; children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-violet-700">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </p>
  );
}

export function DialogHeaderIcon({ icon: Icon }: { icon: ElementType }) {
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-violet-200/50 bg-violet-500/10">
      <Icon className="h-5 w-5 text-violet-600" />
    </div>
  );
}
