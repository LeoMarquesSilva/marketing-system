import { differenceInCalendarDays } from "date-fns";
import { ExternalLink, Film, ImageIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { SectionCard } from "@/components/instagram/instagram-section-card";
import type { TeamReadyItem } from "@/lib/team-posts/domain";
import { cn } from "@/lib/utils";

/** A partir daqui a espera merece atenção do líder. */
const LONG_WAIT_DAYS = 14;

function waitingLabel(readySince: string | null, now: Date): { text: string; days: number | null } {
  if (!readySince) return { text: "Pronto", days: null };
  const days = Math.max(0, differenceInCalendarDays(now, new Date(readySince)));
  if (days === 0) return { text: "Pronto hoje", days };
  return { text: `Pronto há ${days} dia${days !== 1 ? "s" : ""}`, days };
}

export function ReadyQueue({ items }: { items: TeamReadyItem[] }) {
  const now = new Date();
  return (
    <SectionCard
      title={`Prontos para publicar (${items.length})`}
      description="Posts e reels já finalizados pelo Marketing, aguardando data de publicação no Instagram."
      noPadding
    >
      {items.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">Nada da equipe aguardando publicação agora.</p>
      ) : (
        <ul className="divide-y divide-border/40">
          {items.map((item) => {
            const wait = waitingLabel(item.readySince, now);
            const KindIcon = item.kind === "reel" ? Film : ImageIcon;
            return (
              <li key={`${item.kind}-${item.id}`} className="flex items-start gap-3 px-5 py-3">
                <div className="flex h-16 w-[52px] shrink-0 items-center justify-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                  {item.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.thumbUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <KindIcon className="h-5 w-5" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-1.5">
                    <Badge variant="outline" className="rounded-full text-[11px]">
                      {item.kind === "reel" ? "Reel" : "Post"}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{item.area}</span>
                  </div>
                  <p className="line-clamp-2 text-sm font-medium leading-snug">{item.title}</p>
                  {item.people.length > 0 && (
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.people.join(", ")}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5 text-right">
                  <span
                    className={cn(
                      "text-xs tabular-nums",
                      wait.days !== null && wait.days >= LONG_WAIT_DAYS ? "font-medium text-amber-700" : "text-muted-foreground"
                    )}
                  >
                    {wait.text}
                  </span>
                  {item.artUrl && (
                    <a
                      href={item.artUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-8 items-center gap-1 rounded-md px-1.5 text-xs font-medium text-[#347796] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
                    >
                      Ver arte
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}
