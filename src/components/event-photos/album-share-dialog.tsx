"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  Link2,
  Loader2,
  Lock,
  ShieldCheck,
  Unlink,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createAlbumShare, fetchAlbumShares, searchShareLogos, updateAlbumShare } from "@/lib/event-photos/api";
import { SHARE_DEFAULT_EXPIRY_DAYS, SHARE_EXPIRY_OPTIONS, shareStatus } from "@/lib/event-photos/share";
import type { EventPhotoShare } from "@/lib/event-photos/types";
import { cn } from "@/lib/utils";

const EXPIRY_LABEL: Record<string, string> = { "30": "30 dias", "90": "90 dias", "365": "1 ano", null: "Sem prazo" };

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatMoment(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function LogoBox({ url, size = "md" }: { url: string | null; size?: "sm" | "md" }) {
  const box = size === "sm" ? "size-9 rounded-lg" : "size-11 rounded-xl";
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" className={cn(box, "shrink-0 border border-[#d7e6ea] bg-white object-contain p-0.5")} />
  ) : (
    <span className={cn(box, "grid shrink-0 place-items-center border border-[#d7e6ea] bg-[#eef6f7] text-[#347796]")} aria-hidden>
      <Link2 className="h-4 w-4" />
    </span>
  );
}

const STATUS_CHIP: Record<ReturnType<typeof shareStatus>, { label: string; className: string }> = {
  active: { label: "Ativo", className: "bg-[#e3f4ea] text-[#22603f]" },
  expired: { label: "Vencido", className: "bg-[#f4efe3] text-[#7a5a1f]" },
  revoked: { label: "Desativado", className: "bg-[#eef1f3] text-[#56656e]" },
};

function ShareRow({
  share,
  highlighted,
  onChange,
}: {
  share: EventPhotoShare;
  highlighted: boolean;
  onChange: (share: EventPhotoShare) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [confirmRevoke, setConfirmRevoke] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const status = shareStatus(share);
  const chip = STATUS_CHIP[status];

  const patch = async (body: { revoke?: true; allowDownload?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      onChange(await updateAlbumShare(share.id, body));
      setConfirmRevoke(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar o link.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (await copyToClipboard(share.url)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } else {
      setError("Não deu para copiar automaticamente. Selecione o endereço e copie.");
    }
  };

  return (
    <li
      className={cn(
        "rounded-xl border bg-white p-3.5 transition",
        highlighted ? "border-[#47cdd0] shadow-[0_0_0_3px_rgba(71,205,208,0.18)]" : "border-[#dbe8eb]",
        status !== "active" && "bg-[#f8fafb]"
      )}
    >
      <div className="flex items-start gap-3">
        <LogoBox url={share.logoUrl} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="truncate text-sm font-semibold text-[#102f3d]">{share.label}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", chip.className)}>{chip.label}</span>
            {!share.allowDownload && status === "active" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1f3] px-2 py-0.5 text-[11px] font-semibold text-[#56656e]">
                <Lock className="h-3 w-3" aria-hidden />
                Só ver
              </span>
            )}
          </div>
          <p className="mt-1 text-xs text-[#5e7a85]">
            {share.openCount > 0
              ? `Aberto ${share.openCount} ${share.openCount === 1 ? "vez" : "vezes"}${share.lastOpenedAt ? ` · último em ${formatMoment(share.lastOpenedAt)}` : ""}`
              : "Ainda não foi aberto"}
            {" · "}
            {share.revokedAt
              ? `desativado em ${formatDay(share.revokedAt)}`
              : share.expiresAt
                ? `${status === "expired" ? "venceu" : "vale até"} ${formatDay(share.expiresAt)}`
                : "sem prazo"}
          </p>
          {status === "active" && (
            <p className="mt-2 truncate rounded-md bg-[#f2f8f9] px-2.5 py-1.5 font-mono text-[11px] text-[#456370]" title={share.url}>
              {share.url}
            </p>
          )}
        </div>
      </div>

      {status === "active" && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" className="gap-1.5 bg-[#347796] text-white hover:bg-[#285f7a]" onClick={() => void copy()}>
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copiado" : "Copiar link"}
          </Button>
          <Button asChild type="button" size="sm" variant="outline" className="gap-1.5">
            <a href={`${share.url}?previa=1`} target="_blank" rel="noreferrer">
              <ExternalLink className="h-4 w-4" />
              Ver como o convidado
            </a>
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="gap-1.5"
            disabled={busy}
            onClick={() => void patch({ allowDownload: !share.allowDownload })}
          >
            {share.allowDownload ? <EyeOff className="h-4 w-4" /> : <Download className="h-4 w-4" />}
            {share.allowDownload ? "Bloquear download" : "Liberar download"}
          </Button>
          {confirmRevoke ? (
            <span className="ml-auto inline-flex items-center gap-2 text-xs text-[#7a2d2d]">
              Desativar? O link para de funcionar na hora.
              <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => void patch({ revoke: true })}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Desativar"}
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmRevoke(false)}>
                Manter
              </Button>
            </span>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto gap-1.5 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => setConfirmRevoke(true)}
            >
              <Unlink className="h-4 w-4" />
              Desativar
            </Button>
          )}
        </div>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </li>
  );
}

export function AlbumShareDialog({
  albumId,
  albumTitle,
  isPublished,
  guestHiddenCount,
  open,
  onOpenChange,
}: {
  albumId: string;
  albumTitle: string;
  isPublished: boolean;
  /** Fotos marcadas como "Só equipe" (fora do link). */
  guestHiddenCount: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [shares, setShares] = useState<EventPhotoShare[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [logos, setLogos] = useState<Array<{ name: string; logoUrl: string }>>([]);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [expiry, setExpiry] = useState<number | null>(SHARE_DEFAULT_EXPIRY_DAYS);
  const [allowDownload, setAllowDownload] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newId, setNewId] = useState<string | null>(null);
  const [newNotice, setNewNotice] = useState<string | null>(null);
  const logoPicked = useRef(false);

  useEffect(() => {
    if (!open) return;
    setShares(null);
    setLoadError(null);
    setNewId(null);
    setNewNotice(null);
    fetchAlbumShares(albumId)
      .then(setShares)
      .catch((err: unknown) => setLoadError(err instanceof Error ? err.message : "Erro ao carregar os links."));
  }, [albumId, open]);

  // Procura a logo no cadastro de clientes enquanto a pessoa digita o nome.
  useEffect(() => {
    const term = label.trim();
    if (!open || term.length < 3) {
      setLogos([]);
      return;
    }
    const timer = window.setTimeout(() => {
      searchShareLogos(term)
        .then((found) => {
          setLogos(found);
          // Uma única logo encontrada já vem marcada (a pessoa pode tirar).
          if (!logoPicked.current) setLogoUrl(found.length === 1 ? found[0].logoUrl : null);
        })
        .catch(() => setLogos([]));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [label, open]);

  const create = async () => {
    setCreating(true);
    setCreateError(null);
    try {
      const share = await createAlbumShare(albumId, { label, logoUrl, allowDownload, expiresInDays: expiry });
      setShares((prev) => [share, ...(prev ?? [])]);
      setNewId(share.id);
      setLabel("");
      setLogos([]);
      setLogoUrl(null);
      logoPicked.current = false;
      const copied = await copyToClipboard(share.url);
      setNewNotice(
        copied
          ? "Link criado e copiado. É só colar na conversa com o convidado."
          : "Link criado. Use “Copiar link” para enviar ao convidado."
      );
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Erro ao criar o link.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-[620px]">
        <DialogHeader className="border-b border-[#e3eef0] px-6 pb-4 pt-6 text-left">
          <DialogTitle className="text-lg text-[#102f3d]">Compartilhar com convidados</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed text-[#5e7a85]">
            Link sem login para quem participou de <strong className="font-semibold text-[#102f3d]">{albumTitle}</strong> ver e
            baixar as fotos.
          </DialogDescription>
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[#456370]">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2f8f6a]" aria-hidden />
            A página do convidado mostra só as fotos: nada do reconhecimento facial nem do sistema.
          </p>
          <p className="flex items-start gap-1.5 text-xs leading-relaxed text-[#456370]">
            <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#347796]" aria-hidden />
            {guestHiddenCount > 0
              ? `${guestHiddenCount} foto${guestHiddenCount === 1 ? "" : "s"} marcada${guestHiddenCount === 1 ? "" : "s"} como “Só equipe” não aparece${guestHiddenCount === 1 ? "" : "m"} no link. Para mudar, use Selecionar › Esconder/Mostrar aos convidados.`
              : "Para deixar alguma foto fora do link (ex.: retratos da equipe), use Selecionar › Esconder dos convidados."}
          </p>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {!isPublished && (
            <p className="mb-4 rounded-lg bg-[#fff6e5] px-3 py-2 text-xs text-[#7a5a1f]">
              O álbum está oculto: o link só abre depois que ele for publicado.
            </p>
          )}

          <section className="rounded-xl border border-[#dbe8eb] bg-[#f7fbfc] p-4">
            <h3 className="text-sm font-semibold text-[#102f3d]">Novo link</h3>
            <div className="mt-3 grid gap-3">
              <div>
                <Label htmlFor="share-label" className="text-xs font-semibold text-[#456370]">
                  Para quem é
                </Label>
                <Input
                  id="share-label"
                  value={label}
                  maxLength={120}
                  placeholder="Ex.: Pague Menos"
                  onChange={(event) => {
                    setLabel(event.target.value);
                    logoPicked.current = false;
                  }}
                  className="mt-1.5 bg-white"
                />
                <p className="mt-1 text-[11px] text-[#6b8590]">Aparece na página do convidado, em “Compartilhado com”.</p>
              </div>

              {logos.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-[#456370]">Logo do cadastro de clientes</p>
                  <div className="mt-1.5 flex flex-wrap gap-2">
                    {logos.map((logo) => {
                      const active = logoUrl === logo.logoUrl;
                      return (
                        <button
                          key={logo.logoUrl}
                          type="button"
                          onClick={() => {
                            logoPicked.current = true;
                            setLogoUrl(active ? null : logo.logoUrl);
                          }}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border bg-white py-1.5 pl-1.5 pr-3 text-left text-xs transition",
                            active ? "border-[#347796] shadow-[0_0_0_1px_#347796]" : "border-[#dbe8eb] hover:border-[#9cc3cf]"
                          )}
                          aria-pressed={active}
                        >
                          <LogoBox url={logo.logoUrl} size="sm" />
                          <span className="max-w-[180px] truncate font-medium text-[#102f3d]">{logo.name}</span>
                          {active && <Check className="h-3.5 w-3.5 text-[#347796]" aria-hidden />}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-[#6b8590]">Toque de novo para ficar sem logo.</p>
                </div>
              )}

              <div>
                <p className="text-xs font-semibold text-[#456370]">Validade</p>
                <div className="mt-1.5 inline-flex flex-wrap gap-1 rounded-lg bg-white p-1 ring-1 ring-[#dbe8eb]">
                  {SHARE_EXPIRY_OPTIONS.map((option) => (
                    <button
                      key={String(option)}
                      type="button"
                      onClick={() => setExpiry(option)}
                      aria-pressed={expiry === option}
                      className={cn(
                        "rounded-md px-3 py-1.5 text-xs font-semibold transition",
                        expiry === option ? "bg-[#04202f] text-white" : "text-[#456370] hover:bg-[#eef6f7]"
                      )}
                    >
                      {EXPIRY_LABEL[String(option)]}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-[#102f3d]">
                <input
                  type="checkbox"
                  checked={allowDownload}
                  onChange={(event) => setAllowDownload(event.target.checked)}
                  className="size-4 accent-[#347796]"
                />
                Permitir baixar as fotos
              </label>

              {createError && <p className="text-xs text-destructive">{createError}</p>}

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="gap-1.5 bg-[#347796] text-white hover:bg-[#285f7a]"
                  disabled={creating || label.trim().length === 0}
                  onClick={() => void create()}
                >
                  {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                  Criar link
                </Button>
              </div>
            </div>
          </section>

          <section className="mt-5">
            <h3 className="text-sm font-semibold text-[#102f3d]">Links deste álbum</h3>
            {newNotice && (
              <p className="mt-2 rounded-lg bg-[#e3f4ea] px-3 py-2 text-xs text-[#22603f]" role="status">
                {newNotice}
              </p>
            )}
            {loadError ? (
              <p className="mt-3 text-sm text-destructive">{loadError}</p>
            ) : shares === null ? (
              <p className="mt-3 inline-flex items-center gap-2 text-sm text-[#5e7a85]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando…
              </p>
            ) : shares.length === 0 ? (
              <p className="mt-3 text-sm text-[#5e7a85]">Nenhum link criado ainda.</p>
            ) : (
              <ul className="mt-3 grid gap-2.5">
                {shares.map((share) => (
                  <ShareRow
                    key={share.id}
                    share={share}
                    highlighted={share.id === newId}
                    onChange={(updated) => setShares((prev) => (prev ?? []).map((s) => (s.id === updated.id ? updated : s)))}
                  />
                ))}
              </ul>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
