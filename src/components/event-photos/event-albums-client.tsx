"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarDays, EyeOff, ImageIcon, Images, Loader2, Plus, RefreshCw, ScanFace } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FaceRecognitionPanel } from "@/components/event-photos/face-recognition-panel";
import { createEventAlbum, fetchEventAlbums } from "@/lib/event-photos/api";
import { formatAlbumDate } from "@/lib/event-photos/domain";
import type { EventPhotoAlbum } from "@/lib/event-photos/types";

function AlbumsSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-label="Carregando álbuns">
      {Array.from({ length: 3 }, (_, i) => (
        <div key={i} className="overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
          <div className="aspect-[4/3] animate-pulse bg-[#eaf1f2]" />
          <div className="space-y-2 p-3.5">
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#edf3f4]" />
            <div className="h-3 w-1/3 animate-pulse rounded bg-[#edf3f4]" />
          </div>
        </div>
      ))}
    </div>
  );
}

function AlbumCard({ album, myCount }: { album: EventPhotoAlbum; myCount: number }) {
  const date = formatAlbumDate(album.eventDate);
  return (
    <Link
      href={`/fotos-eventos/${album.slug}`}
      className="group overflow-hidden rounded-lg border border-[#dce9eb] bg-white shadow-[0_1px_2px_rgba(3,32,47,0.05)] outline-none transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-[#a9cdd2] hover:shadow-[0_12px_28px_-20px_rgba(3,32,47,0.6)] focus-visible:ring-2 focus-visible:ring-[#47cdd0]"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-[#eaf1f2]">
        {album.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={album.coverUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="grid h-full place-items-center text-[#8aa4ad]">
            <ImageIcon className="h-9 w-9" aria-hidden="true" />
          </div>
        )}
        {!album.isPublished && (
          <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-[#04202f]/85 px-2 py-0.5 text-xs font-medium text-white backdrop-blur">
            <EyeOff className="h-3 w-3" aria-hidden="true" />
            Oculto
          </span>
        )}
      </div>
      <div className="p-3.5">
        <p className="line-clamp-2 text-sm font-semibold text-[#102f3d]">{album.title}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#5e7a85]">
          {date && (
            <span className="inline-flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
              {date}
            </span>
          )}
          <span className="font-mono tabular-nums">
            {album.photoCount} foto{album.photoCount === 1 ? "" : "s"}
          </span>
          {myCount > 0 && (
            <span className="inline-flex items-center gap-1 font-medium text-[#285f7a]">
              <ScanFace className="h-3.5 w-3.5" aria-hidden="true" />
              você em {myCount}
            </span>
          )}
        </p>
      </div>
    </Link>
  );
}

function CreateAlbumDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (album: EventPhotoAlbum) => void;
}) {
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setTitle("");
      setEventDate("");
      setDescription("");
      setError(null);
    }
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const album = await createEventAlbum({ title, eventDate, description });
      onCreated(album);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar álbum.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !saving && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Novo álbum de evento</DialogTitle>
            <DialogDescription>
              O álbum fica visível para todos os colaboradores. Depois de criar, suba as fotos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="album-title">Nome do evento</Label>
            <Input
              id="album-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Café com Cultura — Outubro 2026"
              maxLength={120}
              required
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="album-date">Data do evento</Label>
            <Input
              id="album-date"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="album-description">Descrição (opcional)</Label>
            <Textarea
              id="album-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              maxLength={500}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={saving || !title.trim()}
              className="bg-[#347796] text-white hover:bg-[#285f7a]"
            >
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              Criar álbum
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function EventAlbumsClient() {
  const router = useRouter();
  const [albums, setAlbums] = useState<EventPhotoAlbum[]>([]);
  const [myCounts, setMyCounts] = useState<Record<string, number>>({});
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchEventAlbums();
      setAlbums(data.albums);
      setMyCounts(data.myCounts ?? {});
      setCanManage(data.canManage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar álbuns.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 border-b border-[#dce9eb] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold text-[#347796]">
            <Images className="h-3.5 w-3.5" aria-hidden="true" />
            Para todo o escritório
          </p>
          <h2 className="mt-1.5 text-2xl font-semibold leading-tight text-[#102f3d]">Fotos de eventos</h2>
          <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-[#5e7a85]">
            Reveja os momentos dos nossos eventos e baixe as fotos em qualidade original.
          </p>
        </div>
        {canManage && (
          <Button
            type="button"
            className="gap-1.5 bg-[#347796] text-white hover:bg-[#285f7a]"
            onClick={() => setCreating(true)}
          >
            <Plus className="h-4 w-4" />
            Novo álbum
          </Button>
        )}
      </div>

      <FaceRecognitionPanel onMatchesChanged={() => void load()} />

      {loading ? (
        <AlbumsSkeleton />
      ) : error ? (
        <div
          role="alert"
          className="flex flex-col gap-3 rounded-lg border border-destructive/35 bg-destructive/[0.08] px-4 py-3 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
        >
          <span>{error}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => void load()}>
            <RefreshCw className="h-3.5 w-3.5" />
            Tentar novamente
          </Button>
        </div>
      ) : albums.length === 0 ? (
        <div className="flex flex-col items-center rounded-lg border border-dashed border-[#c9dde0] bg-white px-6 py-14 text-center">
          <Images className="h-9 w-9 text-[#8aa4ad]" aria-hidden="true" />
          <p className="mt-3 text-sm font-semibold text-[#102f3d]">Nenhum álbum publicado ainda</p>
          <p className="mt-1 max-w-sm text-sm text-[#5e7a85]">
            {canManage
              ? "Crie o primeiro álbum e suba as fotos do evento."
              : "Quando o marketing publicar as fotos de um evento, elas aparecem aqui."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => (
            <AlbumCard key={album.id} album={album} myCount={myCounts[album.id] ?? 0} />
          ))}
        </div>
      )}

      <CreateAlbumDialog
        open={creating}
        onOpenChange={setCreating}
        onCreated={(album) => {
          setCreating(false);
          router.push(`/fotos-eventos/${album.slug}`);
        }}
      />
    </div>
  );
}
