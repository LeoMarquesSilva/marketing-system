"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Download,
  IdCard,
  Loader2,
  Plus,
  RefreshCw,
  Replace,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getNfcPublicUrl } from "@/lib/nfc/public-url";
import type { ProfessionalProfileCardView } from "@/lib/profiles/types";
import type { ProfessionalProfileStatus, ProfileCardStatus } from "@/lib/profiles/types";

const STATUS_LABEL: Record<ProfileCardStatus, string> = {
  pending: "Pendente",
  active: "Ativo",
  replaced: "Substituído",
  inactive: "Inativo",
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function ProfileCardsPanel({
  profileId,
  profileStatus,
  initialCards = [],
}: {
  profileId: string;
  profileStatus: ProfessionalProfileStatus;
  initialCards?: ProfessionalProfileCardView[];
}) {
  const [cards, setCards] = useState<ProfessionalProfileCardView[]>(initialCards);
  const [label, setLabel] = useState("Cartão NFC");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [qrPreview, setQrPreview] = useState<Record<string, string>>({});

  const replacedBy = useMemo(() => {
    const map = new Map<string, string>();
    for (const card of cards) {
      if (card.replacedCardId) map.set(card.replacedCardId, card.code);
    }
    return map;
  }, [cards]);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/nfc/profiles/${profileId}/cards`, {
      credentials: "include",
      cache: "no-store",
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.error ?? "Não foi possível carregar os cartões.");
    setCards((payload.cards as ProfessionalProfileCardView[]) ?? []);
  }, [profileId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const missing = cards.filter((card) => card.nfcPublicToken);
        if (missing.length === 0) return;
        const nextPreviews: Record<string, string> = {};
        await Promise.all(
          missing.map(async (card) => {
            const response = await fetch(`/api/nfc/profiles/cards/${card.id}/qr`, {
              credentials: "include",
              headers: { accept: "application/json" },
            });
            if (!response.ok) return;
            const body = (await response.json()) as { pngBase64?: string };
            if (body.pngBase64) nextPreviews[card.id] = `data:image/png;base64,${body.pngBase64}`;
          })
        );
        if (!cancelled && Object.keys(nextPreviews).length > 0) {
          setQrPreview(nextPreviews);
        }
      } catch {
        /* preview é opcional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [cards]);

  async function createCard(replaceCardId?: string) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/nfc/profiles/${profileId}/cards`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim() || "Cartão NFC",
          replaceCardId: replaceCardId ?? null,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível criar o cartão.");
      await refresh();
      setMessage({
        tone: "ok",
        text: replaceCardId ? "Cartão substituído. O anterior ficou no histórico." : "Cartão criado como pendente.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao criar cartão.",
      });
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(cardId: string, status: "active" | "inactive") {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/nfc/profiles/cards/${cardId}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "status", status }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error ?? "Não foi possível alterar o status.");
      await refresh();
      setMessage({
        tone: "ok",
        text: status === "active" ? "Cartão ativado." : "Cartão desativado.",
      });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao alterar status.",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-lg border border-[#dce9eb] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <IdCard className="h-4 w-4 text-[#347796]" />
            Cartões NFC / QR
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            Vincule etiquetas permanentes. Rascunhos ficam pendentes; só perfis publicados ativam.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label="Atualizar cartões"
          disabled={busy}
          onClick={() => refresh().catch(() => undefined)}
        >
          <RefreshCw className={busy ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>

      {message && (
        <p
          role="status"
          className={
            message.tone === "ok"
              ? "rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800"
              : "rounded-md bg-red-50 px-3 py-2 text-xs text-red-800"
          }
        >
          {message.text}
        </p>
      )}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1 space-y-1.5">
          <Label htmlFor="profile-card-label">Rótulo do novo cartão</Label>
          <Input
            id="profile-card-label"
            value={label}
            onChange={(event) => setLabel(event.target.value)}
            placeholder="Cartão de visita — recepção"
          />
        </div>
        <Button
          type="button"
          className="min-h-11"
          disabled={busy}
          onClick={() => createCard()}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Criar cartão
        </Button>
      </div>

      {profileStatus !== "published" && (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          Perfil ainda não publicado: cartões podem ser criados como pendentes, mas não ativados.
        </p>
      )}

      {cards.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nenhum cartão vinculado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {cards.map((card) => {
            const nfcUrl = card.nfcPublicToken
              ? getNfcPublicUrl(card.nfcPublicToken, undefined, { source: "nfc" })
              : null;
            const qrUrl = card.nfcPublicToken
              ? getNfcPublicUrl(card.nfcPublicToken, undefined, { source: "qr" })
              : null;
            const canActivate =
              (card.status === "pending" || card.status === "inactive") &&
              profileStatus === "published";
            const canDeactivate = card.status === "active" || card.status === "pending";
            const canReplace = card.status === "active" || card.status === "pending";

            return (
              <li
                key={card.id}
                className="space-y-3 rounded-lg border border-[#e5eef0] bg-[#f7fafb] p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-foreground">{card.label}</p>
                    <p className="text-xs text-muted-foreground">
                      Código interno <span className="font-mono">{card.code}</span>
                      {card.nfcTagCode ? (
                        <>
                          {" "}
                          · Tag <span className="font-mono">{card.nfcTagCode}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-[#347796]">
                    {STATUS_LABEL[card.status]}
                  </span>
                </div>

                <dl className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                  <div>
                    <dt className="inline">Criado: </dt>
                    <dd className="inline">{formatDate(card.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Emitido: </dt>
                    <dd className="inline">{formatDate(card.issuedAt)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Ativado: </dt>
                    <dd className="inline">{formatDate(card.activatedAt)}</dd>
                  </div>
                  <div>
                    <dt className="inline">Aposentado: </dt>
                    <dd className="inline">{formatDate(card.retiredAt)}</dd>
                  </div>
                </dl>

                {(card.replacedCardId || replacedBy.get(card.id)) && (
                  <p className="text-xs text-muted-foreground">
                    {card.replacedCardId
                      ? `Substitui o cartão ${cards.find((item) => item.id === card.replacedCardId)?.code ?? card.replacedCardId}.`
                      : null}
                    {replacedBy.get(card.id)
                      ? ` Substituído pelo cartão ${replacedBy.get(card.id)}.`
                      : null}
                  </p>
                )}

                {nfcUrl && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-foreground">URL permanente NFC</p>
                    <a
                      href={nfcUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block break-all text-xs text-[#347796] underline-offset-2 hover:underline"
                    >
                      {nfcUrl}
                    </a>
                    {qrUrl && (
                      <p className="break-all text-[11px] text-muted-foreground">QR: {qrUrl}</p>
                    )}
                  </div>
                )}

                {qrPreview[card.id] && (
                  <div className="flex items-end gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrPreview[card.id]}
                      alt={`QR do cartão ${card.code}`}
                      className="h-28 w-28 rounded-md border border-[#dce9eb] bg-white p-1"
                    />
                    <Button asChild variant="outline" size="sm" className="min-h-11">
                      <a href={`/api/nfc/profiles/cards/${card.id}/qr`} download>
                        <Download className="h-4 w-4" />
                        Baixar QR
                      </a>
                    </Button>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  {canActivate && (
                    <Button
                      type="button"
                      size="sm"
                      className="min-h-11"
                      disabled={busy}
                      onClick={() => setStatus(card.id, "active")}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Ativar
                    </Button>
                  )}
                  {canDeactivate && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={busy}
                      onClick={() => setStatus(card.id, "inactive")}
                    >
                      <Ban className="h-4 w-4" />
                      Desativar
                    </Button>
                  )}
                  {canReplace && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="min-h-11"
                      disabled={busy}
                      onClick={() => createCard(card.id)}
                    >
                      <Replace className="h-4 w-4" />
                      Substituir
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
