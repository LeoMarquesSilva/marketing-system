import { ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { InstagramPost } from "@/lib/instagram-posts";
import { getInstagramMediaLabel } from "@/lib/instagram-media-type";
import { cn } from "@/lib/utils";

type ThumbnailSize = "list" | "card";

function isReelMedia(mediaType: string | null | undefined) {
  return mediaType === "VIDEO";
}

interface InstagramPostThumbnailProps {
  post: InstagramPost;
  size?: ThumbnailSize;
  showBadge?: boolean;
  className?: string;
}

export function InstagramPostThumbnail({
  post,
  size = "list",
  showBadge = true,
  className,
}: InstagramPostThumbnailProps) {
  const src = post.thumbnail_url || post.media_url;
  const reel = isReelMedia(post.media_type);

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-muted",
        size === "list"
          ? reel
            ? "w-[78px] aspect-[9/16] rounded-lg"
            : "w-[88px] aspect-square rounded-lg"
          : reel
            ? "w-[118px] aspect-[9/16] rounded-md"
            : "w-[148px] aspect-square rounded-md",
        className
      )}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageIcon
            className={cn(
              "text-muted-foreground/40",
              size === "card" ? "h-10 w-10" : "h-6 w-6"
            )}
          />
        </div>
      )}
      {showBadge && (
        <Badge className="absolute top-1.5 left-1.5 rounded-full bg-black/65 text-white border-0 text-[9px] px-1.5 py-0">
          {getInstagramMediaLabel(post.media_type)}
        </Badge>
      )}
    </div>
  );
}
