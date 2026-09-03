import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { Scale } from "lucide-react";

export function OpsPageHeading({
  title,
  description,
  icon: Icon = Scale,
  action,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-[#47cdd0]/30 bg-[#e8f8f8] text-[#285f7a]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
      </div>
      {action}
    </div>
  );
}
