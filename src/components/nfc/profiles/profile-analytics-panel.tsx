"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ProfessionalProfileAnalytics } from "@/lib/profiles/types";

const EVENT_LABELS: Record<string, string> = {
  profile_view: "Visualizações",
  nfc_scan: "Leituras NFC",
  qr_scan: "Leituras QR",
  contact_download: "Downloads de contato",
  share: "Compartilhamentos",
  whatsapp_click: "Cliques WhatsApp",
  email_click: "Cliques e-mail",
  linkedin_click: "Cliques LinkedIn",
  website_click: "Cliques site",
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-[#e5eef0] bg-[#f7fafb] px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-[#285f7a]">
        {formatNumber(value)}
      </p>
    </div>
  );
}

export function ProfileAnalyticsPanel({ profileId }: { profileId: string }) {
  const [analytics, setAnalytics] = useState<ProfessionalProfileAnalytics | null>(null);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBusy(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/nfc/profiles/${profileId}/analytics?days=30`,
          { credentials: "include", cache: "no-store" }
        );
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload.error ?? "Não foi possível carregar as métricas.");
        }
        if (!cancelled) {
          setAnalytics(payload.analytics as ProfessionalProfileAnalytics);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Falha ao carregar métricas.");
        }
      } finally {
        if (!cancelled) setBusy(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [profileId]);

  return (
    <section className="space-y-3 rounded-lg border border-[#dce9eb] bg-white p-4">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Métricas (30 dias)</h3>
        <p className="text-xs text-muted-foreground">
          Totais agregados — sem dump de eventos brutos.
        </p>
      </div>

      {busy ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando…
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}

      {analytics ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Visualizações" value={analytics.totals.profile_view} />
            <Stat label="Downloads de contato" value={analytics.totals.contact_download} />
            <Stat label="NFC" value={analytics.totals.nfc_scan} />
            <Stat label="QR" value={analytics.totals.qr_scan} />
          </div>

          <div>
            <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Cliques
            </h4>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  "whatsapp_click",
                  "email_click",
                  "linkedin_click",
                  "website_click",
                  "share",
                ] as const
              ).map((key) => (
                <Stat key={key} label={EVENT_LABELS[key]} value={analytics.totals[key]} />
              ))}
            </div>
          </div>

          {analytics.daily.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Tendência diária
              </h4>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
                {analytics.daily.map((day) => (
                  <li
                    key={day.date}
                    className="flex items-center justify-between gap-2 border-b border-[#eef5f6] py-1 last:border-0"
                  >
                    <span className="tabular-nums text-muted-foreground">{day.date}</span>
                    <span className="tabular-nums text-foreground">
                      {formatNumber(day.views)} views · {formatNumber(day.scans)} scans
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sem atividade no período.</p>
          )}

          {analytics.byCard.length > 0 ? (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Leituras por cartão
              </h4>
              <ul className="space-y-1 text-xs">
                {analytics.byCard.map((card) => (
                  <li
                    key={card.cardId}
                    className="flex items-center justify-between gap-2 border-b border-[#eef5f6] py-1 last:border-0"
                  >
                    <span className="min-w-0 truncate">
                      <span className="font-medium text-foreground">{card.code}</span>
                      <span className="text-muted-foreground"> · {card.label}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-foreground">
                      {formatNumber(card.scans)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
