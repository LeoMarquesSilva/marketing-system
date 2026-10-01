"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Images, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { EventPhotoAlbum } from "@/lib/event-photos/types";

/** The photo API applies its own publication and manager permissions. */
export function EventLinkedAlbums({ eventId }: { eventId: string }) {
  const [albums, setAlbums] = useState<EventPhotoAlbum[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/event-photos/albums", { signal: controller.signal })
      .then(async response => {
        if (!response.ok) throw new Error("albums");
        const data = await response.json() as { albums: EventPhotoAlbum[] };
        if (!controller.signal.aborted) setAlbums(data.albums.filter(album => album.eventId === eventId));
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventId, attempt]);

  return <section className="space-y-3 border-t border-border/70 pt-5">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold">Álbuns de fotos</h3><p className="mt-1 text-xs text-muted-foreground">Álbuns vinculados a este evento na biblioteca de fotos.</p></div><Button asChild size="sm" variant="outline"><Link href="/fotos-eventos">Abrir biblioteca<ArrowUpRight className="size-3.5" /></Link></Button></div>
    {loading ? <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" />Carregando álbuns…</p> : failed ? <div role="alert" className="text-sm text-muted-foreground">Não foi possível carregar os álbuns.<Button variant="link" onClick={() => { setLoading(true); setFailed(false); setAttempt(value => value + 1); }}>Tentar novamente</Button></div> : albums.length ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{albums.map(album => <Link href={`/fotos-eventos/${album.slug}`} key={album.id} className="overflow-hidden rounded-xl border bg-card transition-colors hover:border-primary/40">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {album.coverUrl ? <img src={album.coverUrl} alt={album.title} loading="lazy" className="aspect-video w-full object-cover" /> : <div className="flex aspect-video items-center justify-center bg-muted"><Images className="size-8 text-muted-foreground" /></div>}
      <div className="p-4"><h4 className="text-sm font-medium">{album.title}</h4><p className="mt-1 text-xs text-muted-foreground">{album.photoCount} fotos{!album.isPublished && " · Rascunho"}</p></div>
    </Link>)}</div> : <p className="rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">Nenhum álbum vinculado a este evento. As imagens anexadas continuam disponíveis acima.</p>}
  </section>;
}
