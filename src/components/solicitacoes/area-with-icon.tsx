"use client";

import { AreaIcon } from "@/lib/area-icons";

interface AreaWithIconProps {
  area: string;
  className?: string;
}

export function AreaWithIcon({ area, className }: AreaWithIconProps) {
  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
        <AreaIcon area={area} className="h-4 w-4" />
      </div>
      <span>{area || "—"}</span>
    </div>
  );
}
