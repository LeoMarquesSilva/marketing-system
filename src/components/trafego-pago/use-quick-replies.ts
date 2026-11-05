"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type { QuickReply } from "@/lib/whatsapp-quick-replies";

interface QuickRepliesData {
  replies: QuickReply[];
  canManage: boolean;
}

/** Uma busca por sessão: o campo de mensagem é montado de novo a cada conversa. */
let data: QuickRepliesData | null = null;
let loading: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function loadQuickReplies(force = false): Promise<void> {
  if (loading) return loading;
  if (data && !force) return Promise.resolve();
  loading = authFetch("/api/evolution/quick-replies")
    .then(async (res) => {
      if (!res.ok) return;
      const json = (await res.json()) as Partial<QuickRepliesData>;
      data = { replies: json.replies ?? [], canManage: Boolean(json.canManage) };
      emit();
    })
    .catch(() => {
      // Sem a lista, o campo de mensagem segue funcionando sem respostas prontas.
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

function replaceReplies(update: (replies: QuickReply[]) => QuickReply[]) {
  if (!data) return;
  data = { ...data, replies: update(data.replies) };
  emit();
}

export function useQuickReplies() {
  const snapshot = useSyncExternalStore(subscribe, () => data, () => null);

  useEffect(() => {
    void loadQuickReplies();
  }, []);

  const markUsed = useCallback((id: string) => {
    replaceReplies((replies) =>
      replies.map((reply) => (reply.id === id ? { ...reply, use_count: reply.use_count + 1 } : reply))
    );
    void authFetch(`/api/evolution/quick-replies/${id}`, { method: "POST" }).catch(() => undefined);
  }, []);

  const upsertLocal = useCallback((saved: QuickReply) => {
    replaceReplies((replies) =>
      replies.some((reply) => reply.id === saved.id)
        ? replies.map((reply) => (reply.id === saved.id ? saved : reply))
        : [...replies, saved]
    );
  }, []);

  const removeLocal = useCallback((id: string) => {
    replaceReplies((replies) => replies.filter((reply) => reply.id !== id));
  }, []);

  return {
    replies: snapshot?.replies ?? [],
    canManage: snapshot?.canManage ?? false,
    loaded: snapshot !== null,
    markUsed,
    upsertLocal,
    removeLocal,
  };
}
