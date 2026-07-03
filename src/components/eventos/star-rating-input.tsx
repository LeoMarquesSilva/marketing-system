"use client";

import { useState } from "react";
import { Star, X } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRatingInput({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  const display = hovered ?? value ?? 0;

  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(value === n ? null : n)}
          onMouseEnter={() => setHovered(n)}
          onMouseLeave={() => setHovered(null)}
          className="p-0.5 transition-transform hover:scale-110"
          title={`${n} estrela${n > 1 ? "s" : ""}`}
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              n <= display ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
            )}
          />
        </button>
      ))}
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="ml-1 inline-flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          title="Limpar avaliação"
        >
          <X className="h-3.5 w-3.5" />
          Limpar
        </button>
      )}
    </div>
  );
}
