"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { isProfileCampaignActive } from "@/lib/profiles/campaign";
import { profileCampaignUpdateSchema } from "@/lib/profiles/validation";
import type { ProfileCampaign } from "@/lib/profiles/types";

const EMPTY_CAMPAIGN: ProfileCampaign = {
  enabled: false,
  startsAt: null,
  endsAt: null,
  titlePt: "",
  titleEn: "",
  messagePt: "",
  messageEn: "",
  callToActionPt: null,
  callToActionEn: null,
};

function toDatetimeLocal(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function liveStateExplanation(campaign: ProfileCampaign, isActive: boolean): string {
  if (!campaign.enabled) {
    return "Campanha desligada manualmente — a janela de datas não reativa a faixa.";
  }
  if (isActive) {
    return "Campanha ativa agora: o interruptor está ligado e a data atual está dentro da janela (ou sem limites).";
  }
  if (campaign.startsAt && new Date(campaign.startsAt).getTime() > Date.now()) {
    return "Campanha programada: ligada, mas ainda não chegou a data de início.";
  }
  if (campaign.endsAt && new Date(campaign.endsAt).getTime() < Date.now()) {
    return "Campanha encerrada: ligada, mas a data final já passou.";
  }
  return "Campanha ligada, porém fora da janela ativa.";
}

export function ProfileCampaignSettings() {
  const [campaign, setCampaign] = useState<ProfileCampaign>(EMPTY_CAMPAIGN);
  const [serverActive, setServerActive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(
    null
  );

  const load = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await fetch("/api/nfc/profiles/campaign", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível carregar a campanha.");
      }
      setCampaign((payload.campaign as ProfileCampaign | null) ?? EMPTY_CAMPAIGN);
      setServerActive(Boolean(payload.isActive));
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao carregar campanha.",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const clientActive = useMemo(
    () => isProfileCampaignActive(campaign, new Date()),
    [campaign]
  );

  const clientError = useMemo(() => {
    const parsed = profileCampaignUpdateSchema.safeParse({
      ...campaign,
      callToActionPt: campaign.callToActionPt ?? "",
      callToActionEn: campaign.callToActionEn ?? "",
    });
    if (parsed.success) return null;
    return parsed.error.issues[0]?.message ?? "Campanha inválida.";
  }, [campaign]);

  async function save() {
    if (clientError) {
      setMessage({ tone: "error", text: clientError });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/nfc/profiles/campaign", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled: campaign.enabled,
          startsAt: campaign.startsAt,
          endsAt: campaign.endsAt,
          titlePt: campaign.titlePt,
          titleEn: campaign.titleEn,
          messagePt: campaign.messagePt,
          messageEn: campaign.messageEn,
          callToActionPt: campaign.callToActionPt,
          callToActionEn: campaign.callToActionEn,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? "Não foi possível salvar a campanha.");
      }
      setCampaign(payload.campaign as ProfileCampaign);
      setServerActive(Boolean(payload.isActive));
      setMessage({ tone: "ok", text: "Campanha salva." });
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Falha ao salvar.",
      });
    } finally {
      setBusy(false);
    }
  }

  function patch(partial: Partial<ProfileCampaign>) {
    setCampaign((current) => ({ ...current, ...partial }));
  }

  return (
    <section className="space-y-4 rounded-lg border border-[#dce9eb] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Campanha institucional</h3>
        <p className="text-xs text-muted-foreground">
          Faixa temporária no topo dos perfis públicos. Desligado manual sobrescreve a agenda.
        </p>
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando…
        </p>
      ) : (
        <>
          <label className="flex min-h-11 items-center gap-2 rounded-md border border-[#dce9eb] px-3 text-sm">
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#347796]"
              checked={campaign.enabled}
              onChange={(event) => patch({ enabled: event.target.checked })}
            />
            Campanha habilitada
          </label>

          <p
            className="rounded-md bg-[#f7fafb] px-3 py-2 text-xs text-[#285f7a]"
            role="status"
            data-campaign-live={clientActive || serverActive ? "active" : "inactive"}
          >
            {liveStateExplanation(campaign, clientActive)}
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="campaign-starts">Início</Label>
              <Input
                id="campaign-starts"
                type="datetime-local"
                value={toDatetimeLocal(campaign.startsAt)}
                onChange={(event) =>
                  patch({ startsAt: fromDatetimeLocal(event.target.value) })
                }
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="campaign-ends">Fim</Label>
              <Input
                id="campaign-ends"
                type="datetime-local"
                value={toDatetimeLocal(campaign.endsAt)}
                onChange={(event) =>
                  patch({ endsAt: fromDatetimeLocal(event.target.value) })
                }
              />
            </div>
          </div>

          {clientError ? (
            <p role="alert" className="text-sm text-red-700">
              {clientError}
            </p>
          ) : null}

          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Português
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-title-pt">Título</Label>
                <Input
                  id="campaign-title-pt"
                  value={campaign.titlePt}
                  onChange={(event) => patch({ titlePt: event.target.value })}
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-message-pt">Mensagem</Label>
                <Textarea
                  id="campaign-message-pt"
                  value={campaign.messagePt}
                  onChange={(event) => patch({ messagePt: event.target.value })}
                  maxLength={600}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-cta-pt">CTA (opcional)</Label>
                <Input
                  id="campaign-cta-pt"
                  value={campaign.callToActionPt ?? ""}
                  onChange={(event) =>
                    patch({ callToActionPt: event.target.value || null })
                  }
                  maxLength={160}
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                English
              </p>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-title-en">Title</Label>
                <Input
                  id="campaign-title-en"
                  value={campaign.titleEn}
                  onChange={(event) => patch({ titleEn: event.target.value })}
                  maxLength={160}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-message-en">Message</Label>
                <Textarea
                  id="campaign-message-en"
                  value={campaign.messageEn}
                  onChange={(event) => patch({ messageEn: event.target.value })}
                  maxLength={600}
                  rows={3}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="campaign-cta-en">CTA (optional)</Label>
                <Input
                  id="campaign-cta-en"
                  value={campaign.callToActionEn ?? ""}
                  onChange={(event) =>
                    patch({ callToActionEn: event.target.value || null })
                  }
                  maxLength={160}
                />
              </div>
            </div>
          </div>

          {message ? (
            <p
              role="status"
              className={
                message.tone === "ok"
                  ? "text-sm text-emerald-800"
                  : "text-sm text-red-700"
              }
            >
              {message.text}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button
              onClick={save}
              disabled={busy || Boolean(clientError)}
              className="min-h-11"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar campanha
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
