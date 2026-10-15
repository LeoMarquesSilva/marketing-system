import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Eye,
  Film,
  Heart,
  Image as ImageIcon,
  Images,
  Instagram,
  TrendingUp,
} from "lucide-react";
import { computeEngagementActionsFromPost } from "@/lib/instagram-engagement";
import type { InstagramPost } from "@/lib/instagram-posts";
import { resolveInstagramThumbnailSrc } from "@/lib/instagram-thumbnail-client";
import { cn } from "@/lib/utils";

export function instagramMediaInfo(post: InstagramPost): { label: string; icon: typeof Images } {
  const pt = (post.media_product_type ?? "").toUpperCase();
  const mt = (post.media_type ?? "").toUpperCase();
  if (pt === "REELS" || mt === "VIDEO") return { label: "Reel", icon: Film };
  if (mt === "CAROUSEL_ALBUM") return { label: "Carrossel", icon: Images };
  return { label: "Imagem", icon: ImageIcon };
}

function nf(n: number) {
  return Math.round(n).toLocaleString("pt-BR");
}

export function InstagramMediaThumb({
  post,
  className,
  withBadge,
  eager,
}: {
  post: InstagramPost;
  className?: string;
  withBadge?: boolean;
  /** Carrega já, para a imagem estar pronta quando o bloco for copiado. */
  eager?: boolean;
}) {
  const src = resolveInstagramThumbnailSrc(post.ig_media_id, post);
  const { label, icon: Icon } = instagramMediaInfo(post);
  return (
    <div className={cn("relative shrink-0 overflow-hidden bg-primary", className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#1a2f44] to-[#1c1c1c]">
          <Instagram className="h-7 w-7 text-white/30" />
        </div>
      )}
      {withBadge && (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
          <Icon className="h-3 w-3" />
          {label}
        </span>
      )}
    </div>
  );
}

function Metric({ icon: Icon, value }: { icon: typeof Heart; value: number }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <Icon className="h-3.5 w-3.5" />
      {nf(value)}
    </span>
  );
}

/** Cartão do post: capa, data · área, legenda, alcance, curtidas e taxa. */
export function InstagramMediaCard({
  post,
  onOpen,
  withBadge,
  eager,
  thumbClassName = "aspect-square",
}: {
  post: InstagramPost;
  onOpen?: () => void;
  withBadge?: boolean;
  eager?: boolean;
  thumbClassName?: string;
}) {
  const rate = post.reach ? (computeEngagementActionsFromPost(post) / post.reach) * 100 : 0;
  const area = post.areas?.[0] ?? post.area;
  const interactive = Boolean(onOpen);
  return (
    <article
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border bg-card shadow-sm",
        interactive && "cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-md"
      )}
      onClick={onOpen}
      onKeyDown={interactive ? (e) => e.key === "Enter" && onOpen?.() : undefined}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      <InstagramMediaThumb post={post} className={cn("w-full", thumbClassName)} withBadge={withBadge} eager={eager} />
      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <p className="text-[11px] text-muted-foreground">
          {post.published_at ? format(new Date(post.published_at), "dd MMM yyyy", { locale: ptBR }) : "—"}
          {area && <> · {area}</>}
        </p>
        <p className="line-clamp-2 text-sm leading-snug">{post.caption?.split("\n")[0] || "Post sem legenda"}</p>
        <div className="mt-auto flex flex-wrap items-center gap-3 pt-2">
          <Metric icon={Eye} value={post.reach} />
          <Metric icon={Heart} value={post.likes} />
          <span className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-primary">
            <TrendingUp className="h-3.5 w-3.5" />
            {rate.toFixed(1)}%
          </span>
        </div>
      </div>
    </article>
  );
}
