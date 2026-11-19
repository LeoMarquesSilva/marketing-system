"use client";

import { useEffect, useSyncExternalStore } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { RECEPTION_CONTACT, type TeamContact } from "@/lib/whatsapp-team-contacts";

interface TeamContactsData {
  team: TeamContact[];
  reception: { id: string; name: string; phone: string };
}

/** Uma busca por sessão: a equipe muda pouco e o campo é montado a cada conversa. */
let data: TeamContactsData | null = null;
let error: string | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadTeamContacts(): Promise<void> {
  if (loading) return loading;
  if (data) return Promise.resolve();
  loading = authFetch("/api/evolution/contacts")
    .then(async (res) => {
      const json = (await res.json().catch(() => ({}))) as Partial<TeamContactsData> & { error?: string };
      if (!res.ok) throw new Error(json.error || "Não deu para carregar a equipe.");
      data = { team: json.team ?? [], reception: json.reception ?? { ...RECEPTION_CONTACT } };
      error = null;
    })
    .catch((err: Error) => {
      error = err.message;
    })
    .finally(() => {
      loading = null;
      emit();
    });
  return loading;
}

export function useTeamContacts(enabled = true) {
  const snapshot = useSyncExternalStore(subscribe, () => data, () => null);
  const currentError = useSyncExternalStore(subscribe, () => error, () => null);

  useEffect(() => {
    if (enabled) void loadTeamContacts();
  }, [enabled]);

  return {
    team: snapshot?.team ?? [],
    reception: snapshot?.reception ?? { ...RECEPTION_CONTACT },
    loaded: snapshot !== null,
    error: currentError,
    retry: () => {
      error = null;
      emit();
      void loadTeamContacts();
    },
  };
}
