"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function SupplierRatingStars({
  rating,
  size = "sm",
}: {
  rating: number | null;
  size?: "sm" | "md";
}) {
  if (rating == null) {
    return <span className="text-xs text-muted-foreground">Sem avaliação</span>;
  }
  const iconSize = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const rounded = Math.round(rating);
  return (
    <div className="flex items-center gap-0.5" title={`${rating.toFixed(1)} / 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            iconSize,
            i < rounded ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"
          )}
        />
      ))}
    </div>
  );
}
