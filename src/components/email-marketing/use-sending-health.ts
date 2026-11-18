"use client";

import { useCallback, useEffect, useState } from "react";

export interface SendingDomainRecord {
  kind: string;
  type: string;
  name: string;
  value: string;
  priority: number | null;
  status: string;
}

export interface SendingDomain {
  id: string;
  name: string;
  status: string;
  region: string;
  openTracking: boolean;
  clickTracking: boolean;
  trackingSubdomain: string | null;
  isSender: boolean;
  records: SendingDomainRecord[];
}

export interface SendingHealth {
  configured: boolean;
  sender?: { fromName: string; fromEmail: string; replyTo: string | null };
  domains: SendingDomain[];
  webhook?: { status: string; events: string[]; secretConfigured: boolean } | null;
  plan?: {
    marketingContactsLimit: number;
    contactsInResend: number;
    subscribedContacts: number;
    transactionalDailyLimit: number;
  };
}

/** Domínio de envio do remetente (ou o único cadastrado). */
export function senderDomain(health: SendingHealth | null): SendingDomain | null {
  if (!health?.domains.length) return null;
  return health.domains.find((d) => d.isSender) ?? health.domains[0];
}

export function useSendingHealth() {
  const [health, setHealth] = useState<SendingHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-marketing/domains", { cache: "no-store" });
      const data = (await res.json()) as SendingHealth & { error?: string };
      if (!res.ok || data.error) throw new Error(data.error ?? "Não foi possível consultar o Resend.");
      setHealth(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível consultar o Resend.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  return { health, error, loading, reload };
}
