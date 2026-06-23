"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatUsd } from "@/lib/supabase-billing";
import { formatBrl } from "@/lib/usd-brl-ptax";
import type { InfraServicePayment, InfraServiceWithPayments } from "@/lib/infra-services";
import type { HostingerBillingDashboard } from "@/lib/hostinger-billing";
import { cn } from "@/lib/utils";

function formatPeriod(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "short",
    year: "numeric",
  }).format(new Date(iso.includes("T") ? iso : `${iso}T12:00:00`));
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso.includes("T") ? iso : `${iso}T12:00:00`).toLocaleDateString("pt-BR");
}

function extractInvoiceNumber(description: string): string | null {
  const m = description.match(/YKXMNZ8V-\d{4}/i);
  return m ? m[0].toUpperCase() : null;
}

interface ServicoExecutivePanelProps {
  service: InfraServiceWithPayments;
  hostingerLive?: HostingerBillingDashboard | null;
  isN8n?: boolean;
}

export function ServicoExecutivePanel({
  service,
  hostingerLive,
  isN8n,
}: ServicoExecutivePanelProps) {
  const [expanded, setExpanded] = useState(false);

  const payments = [...service.payments].sort((a, b) =>
    b.period_month.localeCompare(a.period_month)
  );

  const hasLiveHostinger =
    isN8n && hostingerLive?.configured && !hostingerLive.error && hostingerLive.subscription;

  if (payments.length === 0 && !hasLiveHostinger) {
    return (
      <p className="text-sm text-muted-foreground rounded-xl border border-dashed px-4 py-3">
        Nenhuma fatura registrada. Use Editar para cadastrar pagamentos.
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cn(
          "w-full flex items-center justify-between gap-3 px-4 py-3 text-left",
          "hover:bg-muted/30 transition-colors",
          expanded && "border-b border-border/50 bg-muted/10"
        )}
        aria-expanded={expanded}
      >
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <span className="text-sm font-medium">
            {payments.length} fatura{payments.length !== 1 ? "s" : ""}
          </span>
          {payments[0] && (
            <span className="text-xs text-muted-foreground">
              · última {formatPeriod(payments[0].period_month)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {payments[0] && (
            <span className="text-sm font-semibold tabular-nums">
              {formatBrl(payments[0].amount_brl)}
            </span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-muted-foreground transition-transform",
              expanded && "rotate-180"
            )}
            aria-hidden
          />
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-3 space-y-3 bg-background/50">
          {hasLiveHostinger && hostingerLive?.vps && (
            <p className="text-xs text-muted-foreground">
              VPS {hostingerLive.vps.hostname}
              {hostingerLive.vps.ipv4 ? ` · ${hostingerLive.vps.ipv4}` : ""}
              {" · "}
              {hostingerLive.vps.state}
            </p>
          )}

          <ul className="divide-y divide-border/50 rounded-lg border border-border/40 overflow-hidden">
            {payments.map((p) => (
              <InvoiceLine key={p.id} payment={p} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function InvoiceLine({ payment }: { payment: InfraServicePayment }) {
  const invoiceNo = extractInvoiceNumber(payment.description);

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm bg-background/80">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{formatPeriod(payment.period_month)}</span>
          {invoiceNo && (
            <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
              {invoiceNo}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Pago em {formatDate(payment.paid_at)}
        </p>
      </div>
      <div className="text-right tabular-nums shrink-0">
        <p className="font-semibold">{formatBrl(payment.amount_brl)}</p>
        {payment.amount_usd != null && (
          <p className="text-xs text-muted-foreground">{formatUsd(Number(payment.amount_usd))}</p>
        )}
      </div>
    </li>
  );
}
