"use client";

import { useState } from "react";
import { Newspaper } from "lucide-react";
import { cn } from "@/lib/utils";

function decodeImageUrl(url: string): string {
  return url.replace(/&amp;/g, "&");
}

export function NewsThumb({
  src,
  className,
}: {
  src: string | null | undefined;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const url = src ? decodeImageUrl(src) : null;
  const showImage = Boolean(url) && !failed;

  return (
    <div
      className={cn(
        "relative h-[72px] w-[88px] shrink-0 overflow-hidden rounded-xl bg-[#04202f] sm:h-[84px] sm:w-[112px]",
        className
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url ?? undefined}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#04202f] to-[#1a3a4d]">
          <Newspaper className="h-6 w-6 text-white/25" strokeWidth={1.5} />
        </div>
      )}
    </div>
  );
}
