"use client";

import { Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ReelVideoPreviewProps {
  src: string;
  className?: string;
}

export function ReelVideoPreview({ src, className }: ReelVideoPreviewProps) {
  return (
    <div className={cn("space-y-3", className)}>
      <video
        src={src}
        controls
        playsInline
        preload="metadata"
        className="w-full max-h-80 rounded-xl border border-border/50 bg-black object-contain"
      />
      <Button variant="outline" size="sm" asChild>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5"
        >
          <Video className="h-3.5 w-3.5" aria-hidden />
          Abrir em nova aba
        </a>
      </Button>
    </div>
  );
}
