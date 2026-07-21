"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  MessageCircle,
  Loader2,
  RefreshCw,
  AlertCircle,
  Radio,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { AnimatePresence } from "framer-motion";
import { LeadList } from "@/components/trafego-pago/lead-list";
import { ConversationHeader } from "@/components/trafego-pago/conversation-header";
import { MessageBubble } from "@/components/trafego-pago/message-bubble";
import { ChatInput } from "@/components/trafego-pago/chat-input";
import { LeadDetailsPanel } from "@/components/trafego-pago/lead-details-panel";
import type {
  LeadFilter,
  WhatsappConversation,
  WhatsappMessage,
  WhatsappReplyTarget,
} from "@/components/trafego-pago/whatsapp-crm-types";
import {
  formatMessageDate,
  formatRelativeLeadTime,
  isMetaLead,
  isPaidTrafficLead,
  leadDisplayName,
  sameMessageDay,
} from "@/components/trafego-pago/whatsapp-crm-utils";

type RealtimeStatus = "connecting" | "connected" | "unavailable";

interface EvolutionStatus {
  marketingPublicUrl?: string | null;
  supabaseWebhookUrl?: string | null;
  targetWebhookUrl?: string | null;
  preferredTarget?: "supabase" | "nextjs";
  webhook?: {
    enabled: boolean;
    url: string;
    pointsToApp: boolean;
    messageEventsConfigured: boolean;
  } | null;
  recommendations?: string[];
  appWebhookPath?: string;
}

type Conversation = WhatsappConversation;
type Message = WhatsappMessage;
type ReplyTarget = WhatsappReplyTarget;

function markReadSilently(conversationId: string) {
  authFetch(
    `/api/evolution/conversations?conversationId=${conversationId}&markReadOnly=1`
  ).catch(() => {});
}

function normalizeUnreadCount(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function normalizeConversation(raw: Conversation): Conversation {
  return {
    ...raw,
    unread_count: normalizeUnreadCount(raw.unread_count),
    tags: raw.tags ?? [],
    lead_source: raw.lead_source ?? null,
  };
}

/** Mescla lista do servidor preservando unread otimista e zerando chat aberto. */
function mergeConversationLists(
  prev: Conversation[],
  incoming: Conversation[],
  openConversationId: string | null
): Conversation[] {
  const prevById = new Map(prev.map((c) => [c.id, c]));
  const merged = incoming.map((raw) => {
    const c = normalizeConversation(raw);
    const old = prevById.get(c.id);
    const isOpen = c.id === openConversationId;
    if (isOpen) {
      return { ...c, unread_count: 0 };
    }
    const serverUnread = normalizeUnreadCount(c.unread_count);
    const localUnread = normalizeUnreadCount(old?.unread_count);
    return {
      ...c,
      unread_count: Math.max(serverUnread, localUnread),
      tags: c.tags.length > 0 ? c.tags : (old?.tags ?? []),
    };
  });

  const incomingIds = new Set(incoming.map((c) => c.id));
  for (const old of prev) {
    if (!incomingIds.has(old.id)) merged.push(old);
  }

  return merged.sort(
    (a, b) =>
      new Date(b.last_message_at).getTime() - new Date(a.last_message_at).getTime()
  );
}

function bumpConversationPreview(
  prev: Conversation[],
  conversationId: string,
  patch: Partial<Conversation> & { incrementUnread?: boolean }
): Conversation[] {
  const { incrementUnread, ...fields } = patch;
  return prev.map((c) => {
    if (c.id !== conversationId) return c;
    return normalizeConversation({
      ...c,
      ...fields,
      unread_count: incrementUnread
        ? normalizeUnreadCount(c.unread_count) + 1
        : normalizeUnreadCount(fields.unread_count ?? c.unread_count),
    });
  });
}

function mergeMessages(prev: Message[], incoming: Message): Message[] {
  if (prev.some((m) => m.id === incoming.id)) {
    return prev.map((m) => (m.id === incoming.id ? { ...m, ...incoming } : m));
  }
  if (incoming.wa_message_id) {
    const idx = prev.findIndex((m) => m.wa_message_id === incoming.wa_message_id);
    if (idx >= 0) {
      const next = [...prev];
      next[idx] = incoming;
      return next;
    }
  }
  if (incoming.from_me && incoming.body) {
    const pendingIdx = prev.findIndex(
      (m) =>
        m.id.startsWith("pending-") &&
        m.from_me &&
        m.body === incoming.body &&
        Math.abs(
          new Date(m.message_timestamp).getTime() -
            new Date(incoming.message_timestamp).getTime()
        ) < 60_000
    );
    if (pendingIdx >= 0) {
      const next = [...prev];
      next[pendingIdx] = incoming;
      return next;
    }
  }
  return [...prev, incoming];
}

export function WhatsappInbox() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncInfo, setSyncInfo] = useState<string | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const presenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPreviewRef = useRef<string>("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<LeadFilter>("all");
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [evolutionStatus, setEvolutionStatus] = useState<EvolutionStatus | null>(null);
  const [configuringWebhook, setConfiguringWebhook] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<string | null>(null);
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [pinnedMessageId, setPinnedMessageId] = useState<string | null>(null);
  const [hotMessageIds, setHotMessageIds] = useState<Set<string>>(() => new Set());
  const [detailsOpen, setDetailsOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const avatarRefreshRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await authFetch("/api/evolution/conversations");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar.");
      const incoming = (json.conversations ?? []).map((c: Conversation) =>
        normalizeConversation(c)
      );
      setConversations((prev) =>
        mergeConversationLists(prev, incoming, selectedIdRef.current)
      );
      setConfigured(json.configured ?? false);
      setFetchedAt(json.fetchedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadTagSuggestions = useCallback(async () => {
    try {
      const res = await authFetch("/api/evolution/conversations?tagSuggestions=1");
      const json = await res.json();
      if (res.ok) setTagSuggestions(json.suggestions ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  const loadEvolutionStatus = useCallback(async () => {
    try {
      const res = await authFetch("/api/evolution/status");
      const json = await res.json();
      if (res.ok) setEvolutionStatus(json);
    } catch {
      /* ignore */
    }
  }, []);

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const params = new URLSearchParams({ conversationId });
      const shouldRefreshAvatar =
        !silent && !avatarRefreshRef.current.has(conversationId);
      if (shouldRefreshAvatar) params.set("refreshAvatar", "1");

      const res = await authFetch(`/api/evolution/conversations?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar mensagens.");
      if (shouldRefreshAvatar) avatarRefreshRef.current.add(conversationId);
      setMessages(json.messages ?? []);
      if (json.conversation) {
        lastPreviewRef.current =
          (json.conversation as Conversation).last_message_preview ?? "";
      }
      if (json.avatarUrl || json.pushName) {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  unread_count: 0,
                  ...(json.avatarUrl ? { avatar_url: json.avatarUrl } : {}),
                  ...(json.pushName ? { push_name: json.pushName } : {}),
                }
              : c
          )
        );
      } else {
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId ? { ...c, unread_count: 0 } : c
          )
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar mensagens.");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  const saveTags = useCallback(
    async (conversationId: string, tags: string[]) => {
      setSavingTags(true);
      setError(null);
      try {
        const res = await authFetch("/api/evolution/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, tags }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao salvar tags.");
        const updated = json.conversation as Conversation;
        setConversations((prev) =>
          prev.map((c) => (c.id === conversationId ? { ...c, tags: updated.tags ?? tags } : c))
        );
        await loadTagSuggestions();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao salvar tags.");
      } finally {
        setSavingTags(false);
      }
    },
    [loadTagSuggestions]
  );

  const updateSelectedCrm = useCallback(
    async (patch: Record<string, unknown>) => {
      if (!selectedId) return;
      setError(null);
      try {
        const res = await authFetch("/api/evolution/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId: selectedId, ...patch }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Erro ao atualizar CRM.");
        const updated = json.conversation as Conversation;
        setConversations((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao atualizar CRM.");
      }
    },
    [selectedId]
  );

  const sendMessage = useCallback(async () => {
    if (!selectedId || !draftMessage.trim() || sending) return;
    setSending(true);
    setError(null);
    const text = draftMessage.trim();
    setDraftMessage("");
    const quoted = replyTo;
    setReplyTo(null);
    try {
      const res = await authFetch("/api/evolution/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: selectedId,
          text,
          quotedWaMessageId: quoted?.waMessageId,
          quotedBody: quoted?.body,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao enviar.");
      const message = json.message as Message;
      setMessages((prev) => mergeMessages(prev, message));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                last_message_at: message.message_timestamp,
                last_message_preview: text.slice(0, 280),
              }
            : c
        )
      );
    } catch (err) {
      setDraftMessage(text);
      setError(err instanceof Error ? err.message : "Erro ao enviar mensagem.");
    } finally {
      setSending(false);
    }
  }, [selectedId, draftMessage, sending, replyTo]);

  const configureEvolutionWebhook = useCallback(async () => {
    setConfiguringWebhook(true);
    setWebhookInfo(null);
    setError(null);
    try {
      const res = await authFetch("/api/evolution/webhook/configure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao configurar webhook.");
      setWebhookInfo(
        `Webhook configurado (${json.target ?? "supabase"}): ${json.webhookUrl}`
      );
      await loadEvolutionStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao configurar webhook.");
    } finally {
      setConfiguringWebhook(false);
    }
  }, [loadEvolutionStatus]);

  const syncFromEvolution = useCallback(async () => {
    setSyncing(true);
    setSyncInfo(null);
    setError(null);
    try {
      const res = await authFetch("/api/evolution/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao sincronizar.");
      setSyncInfo(
        `${json.stored ?? 0} mensagem(ns) importada(s) de ${json.fetched ?? 0} encontrada(s).`
      );
      await loadConversations(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao sincronizar.");
    } finally {
      setSyncing(false);
    }
  }, [loadConversations]);

  useEffect(() => {
    if (!user) return;

    loadConversations();
    loadTagSuggestions();
    loadEvolutionStatus();

    const pollMs = realtimeStatus === "connected" ? 30_000 : 15_000;
    const pollId = setInterval(() => {
      loadConversations(true);
      if (realtimeStatus !== "connected") loadEvolutionStatus();
    }, pollMs);

    return () => clearInterval(pollId);
  }, [user, loadConversations, loadTagSuggestions, loadEvolutionStatus, realtimeStatus]);

  useEffect(() => {
    if (!user) return;

    let convTimer: ReturnType<typeof setTimeout> | null = null;
    let msgTimer: ReturnType<typeof setTimeout> | null = null;
    let connectTimer: ReturnType<typeof setTimeout> | null = null;

    connectTimer = setTimeout(() => {
      setRealtimeStatus((s) => (s === "connecting" ? "unavailable" : s));
    }, 12_000);

    const channel = supabase
      .channel("whatsapp-inbox")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        (payload) => {
          const row = payload.new as Conversation | undefined;
          if (!row?.id) return;
          const isOpen = row.id === selectedIdRef.current;

          if (isOpen) {
            const preview = row.last_message_preview ?? "";
            if (preview && preview !== lastPreviewRef.current) {
              lastPreviewRef.current = preview;
              void loadMessages(row.id, true);
            }
          }

          setConversations((prev) => {
            const normalized = normalizeConversation(row);
            const exists = prev.some((c) => c.id === row.id);
            const nextRow: Conversation = {
              ...normalized,
              unread_count: isOpen
                ? 0
                : normalizeUnreadCount(normalized.unread_count),
              tags: normalized.tags.length > 0
                ? normalized.tags
                : (prev.find((c) => c.id === row.id)?.tags ?? []),
            };

            if (!exists) {
              return mergeConversationLists(prev, [nextRow], selectedIdRef.current);
            }

            return prev.map((c) => {
              if (c.id !== row.id) return c;
              if (isOpen) return { ...nextRow, unread_count: 0 };
              return {
                ...nextRow,
                unread_count: Math.max(
                  normalizeUnreadCount(nextRow.unread_count),
                  normalizeUnreadCount(c.unread_count)
                ),
              };
            });
          });

          if (convTimer) clearTimeout(convTimer);
          convTimer = setTimeout(() => loadConversations(true), 1500);
        }
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const row = payload.new as Message & {
            conversation_id?: string;
            wa_message_id?: string | null;
            wa_status?: string | null;
            reaction_emoji?: string | null;
            quoted_wa_message_id?: string | null;
            quoted_body?: string | null;
          };
          const conversationId = row.conversation_id;
          if (!conversationId) return;

          const incoming: Message = {
            id: row.id,
            wa_message_id: row.wa_message_id ?? null,
            from_me: row.from_me,
            body: row.body,
            message_type: row.message_type ?? null,
            message_timestamp: row.message_timestamp,
            wa_status: row.wa_status ?? null,
            reaction_emoji: row.reaction_emoji ?? null,
            quoted_wa_message_id: row.quoted_wa_message_id ?? null,
            quoted_body: row.quoted_body ?? null,
          };

          if (conversationId === selectedIdRef.current) {
            setMessages((prev) => mergeMessages(prev, incoming));
            setConversations((prev) =>
              bumpConversationPreview(prev, conversationId, {
                unread_count: 0,
                last_message_at: incoming.message_timestamp,
                last_message_preview:
                  incoming.body?.slice(0, 280) ?? undefined,
              })
            );
            lastPreviewRef.current = incoming.body?.slice(0, 280) ?? "";
            if (!incoming.from_me) markReadSilently(conversationId);
          } else if (!incoming.from_me) {
            setConversations((prev) => {
              const exists = prev.some((c) => c.id === conversationId);
              const next = bumpConversationPreview(prev, conversationId, {
                incrementUnread: true,
                last_message_at: incoming.message_timestamp,
                last_message_preview: incoming.body?.slice(0, 280) ?? undefined,
              });
              if (exists) return next;
              void loadConversations(true);
              return next;
            });
            if (msgTimer) clearTimeout(msgTimer);
            msgTimer = setTimeout(() => loadConversations(true), 1500);
          } else {
            setConversations((prev) =>
              bumpConversationPreview(prev, conversationId, {
                last_message_at: incoming.message_timestamp,
                last_message_preview: incoming.body?.slice(0, 280) ?? undefined,
              })
            );
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "whatsapp_messages" },
        (payload) => {
          const row = payload.new as Message & { conversation_id?: string };
          if (row.conversation_id === selectedIdRef.current) {
            setMessages((prev) => mergeMessages(prev, row as Message));
          }
        }
      )
      .subscribe((status, err) => {
        if (status === "SUBSCRIBED") {
          if (connectTimer) clearTimeout(connectTimer);
          setRealtimeStatus("connected");
          return;
        }
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
          if (connectTimer) clearTimeout(connectTimer);
          setRealtimeStatus("unavailable");
          if (err) console.error("Erro no Realtime WhatsApp:", err);
        }
      });

    return () => {
      if (connectTimer) clearTimeout(connectTimer);
      if (convTimer) clearTimeout(convTimer);
      if (msgTimer) clearTimeout(msgTimer);
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations, loadMessages]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages([]);
    setDraftMessage("");
    setReplyTo(null);
    lastPreviewRef.current = "";
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (!selectedId) return;
    const pollMs = realtimeStatus === "connected" ? 30_000 : 8_000;
    const pollId = setInterval(() => {
      void loadMessages(selectedId, true);
    }, pollMs);
    return () => clearInterval(pollId);
  }, [selectedId, loadMessages, realtimeStatus]);

  useEffect(() => {
    if (!selectedId || !draftMessage.trim()) {
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
      return;
    }
    if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    presenceTimerRef.current = setTimeout(() => {
      authFetch("/api/evolution/presence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ conversationId: selectedId, presence: "composing" }),
      }).catch(() => {});
    }, 400);
    return () => {
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    };
  }, [draftMessage, selectedId]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container || loadingMessages) return;
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }, [messages, loadingMessages, selectedId]);

  const selected = conversations.find((c) => c.id === selectedId);
  const totalUnread = conversations.reduce((s, c) => s + c.unread_count, 0);

  const normalizedSearch = searchQuery.trim().toLowerCase();
  const filteredConversations = conversations.filter((c) => {
    if (activeFilter === "unread" && c.unread_count === 0) return false;
    if (activeFilter === "meta_ads" && !isMetaLead(c)) return false;
    if (activeFilter === "trafego_pago" && !isPaidTrafficLead(c)) return false;
    if (!normalizedSearch) return true;
    const haystack = [
      c.push_name,
      c.phone,
      c.last_message_preview,
      ...(c.tags ?? []),
      c.meta_campaign_name,
      c.meta_adset_name,
      leadDisplayName(c),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const pinnedMessage = pinnedMessageId
    ? messages.find((message) => message.id === pinnedMessageId)
    : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando leads do WhatsApp…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card/60 backdrop-blur-sm p-4 flex flex-wrap items-center gap-3">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {realtimeStatus === "connected" ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                Tempo real ativo
              </span>
            </>
          ) : realtimeStatus === "connecting" ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              <span className="text-muted-foreground">Conectando tempo real…</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-amber-500" />
              <span className="text-amber-700 dark:text-amber-400">
                Tempo real indisponível · polling 15s
              </span>
            </>
          )}
          {fetchedAt && (
            <span className="text-muted-foreground text-xs">
              · atualizado {formatRelativeLeadTime(fetchedAt)}
            </span>
          )}
          {totalUnread > 0 && (
            <span className="rounded-full bg-emerald-500 text-white text-xs font-bold px-2 py-0.5">
              {totalUnread} nova{totalUnread !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {configured && (
            <Button
              variant="default"
              size="sm"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              disabled={syncing}
              onClick={() => syncFromEvolution()}
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Sincronizar Evolution
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => loadConversations()}
          >
            <RefreshCw className="h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      {syncInfo && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm text-emerald-900 dark:text-emerald-200">
          {syncInfo}
        </div>
      )}

      {webhookInfo && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 p-3 text-sm text-emerald-900 dark:text-emerald-200">
          {webhookInfo}
        </div>
      )}

      {evolutionStatus?.webhook && !evolutionStatus.webhook.pointsToApp && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-3">
          <p className="font-medium flex items-center gap-2">
            <Radio className="h-4 w-4" />
            Webhook da Evolution ainda não aponta para o marketing-system
          </p>
          <p>
            Hoje a instância BP envia para{" "}
            <code className="text-xs break-all">{evolutionStatus.webhook.url}</code>.
            O ideal é apontar direto para o Supabase (Edge Function) — sem Next.js, sem
            n8n, sem outros sistemas.
          </p>
          {evolutionStatus.supabaseWebhookUrl && (
            <p className="text-xs">
              URL Supabase:{" "}
              <code className="break-all">{evolutionStatus.supabaseWebhookUrl}</code>
            </p>
          )}
          {evolutionStatus.targetWebhookUrl &&
            evolutionStatus.targetWebhookUrl !== evolutionStatus.supabaseWebhookUrl && (
              <p className="text-xs">
                Destino alternativo:{" "}
                <code className="break-all">{evolutionStatus.targetWebhookUrl}</code>
              </p>
            )}
          {(evolutionStatus.recommendations ?? []).map((tip) => (
            <p key={tip} className="text-xs opacity-90">
              {tip}
            </p>
          ))}
          {(evolutionStatus.supabaseWebhookUrl || evolutionStatus.marketingPublicUrl) &&
            configured && (
            <Button
              size="sm"
              className="bg-amber-700 hover:bg-amber-800 text-white"
              disabled={configuringWebhook}
              onClick={() => configureEvolutionWebhook()}
            >
              {configuringWebhook ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Apontar webhook BP → Supabase
            </Button>
          )}
          {!evolutionStatus.supabaseWebhookUrl && !evolutionStatus.marketingPublicUrl && (
            <p className="text-xs">
              Configure <code>NEXT_PUBLIC_SUPABASE_URL</code> no <code>.env</code>.
            </p>
          )}
        </div>
      )}

      {!configured && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-900 dark:text-amber-200">
          Configure no <code className="text-xs">.env</code>:{" "}
          <code className="text-xs">EVOLUTION_API_URL</code>,{" "}
          <code className="text-xs">EVOLUTION_API_KEY</code>,{" "}
          <code className="text-xs">EVOLUTION_INSTANCE=BP</code>.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-2 text-sm text-red-800">
          <AlertCircle className="h-5 w-5 shrink-0" />
          {error}
        </div>
      )}

      <div
        className={
          detailsOpen
            ? "grid min-h-[560px] overflow-hidden rounded-lg border bg-white shadow-sm lg:h-[calc(100dvh-9rem)] lg:grid-cols-[330px_minmax(0,1fr)] xl:grid-cols-[330px_minmax(0,1fr)_320px] dark:bg-card"
            : "grid min-h-[560px] overflow-hidden rounded-lg border bg-white shadow-sm lg:h-[calc(100dvh-9rem)] lg:grid-cols-[330px_minmax(0,1fr)] dark:bg-card"
        }
      >
        <LeadList
          conversations={conversations}
          filteredConversations={filteredConversations}
          selectedId={selectedId}
          searchQuery={searchQuery}
          activeFilter={activeFilter}
          totalUnread={totalUnread}
          onSearchChange={setSearchQuery}
          onFilterChange={setActiveFilter}
          onSelect={setSelectedId}
        />

        <main className="relative z-10 flex min-h-0 min-w-0 flex-col bg-background">
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-slate-50 p-8 text-center text-muted-foreground dark:bg-muted/5">
              <div className="flex h-16 w-16 items-center justify-center rounded-lg border bg-white shadow-sm dark:bg-card">
                <MessageCircle className="h-8 w-8 opacity-40" />
              </div>
              <p className="text-sm font-medium">Selecione uma conversa para ver e responder.</p>
            </div>
          ) : (
            <>
              <ConversationHeader
                conversation={selected}
                tagSuggestions={tagSuggestions}
                savingTags={savingTags}
                detailsOpen={detailsOpen}
                onSaveTags={saveTags}
                onToggleDetails={() => setDetailsOpen((open) => !open)}
              />

              <div
                ref={messagesContainerRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden bg-[#f3f5f7] p-5 dark:bg-muted/5"
              >
                {pinnedMessage && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900 shadow-sm dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                    <p className="font-semibold">Mensagem fixada</p>
                    <p className="mt-1 line-clamp-2 text-emerald-800/80 dark:text-emerald-100/80">
                      {pinnedMessage.body || "Mensagem sem texto"}
                    </p>
                  </div>
                )}

                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
                    <MessageCircle className="h-10 w-10 opacity-20" />
                    <p className="max-w-[220px] text-sm">
                      Sem mensagens salvas ainda. Envie a primeira mensagem abaixo.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((message, index) => (
                      <div key={message.id} className="space-y-4">
                        {!sameMessageDay(messages[index - 1], message) && (
                          <div className="flex justify-center">
                            <span className="rounded-full bg-white px-3 py-1 text-[11px] font-medium text-muted-foreground shadow-sm dark:bg-card">
                              {formatMessageDate(message.message_timestamp)}
                            </span>
                          </div>
                        )}
                        <MessageBubble
                          message={message}
                          conversation={selected}
                          reaction={messageReactions[message.id]}
                          pinned={pinnedMessageId === message.id}
                          hot={hotMessageIds.has(message.id)}
                          onReply={() =>
                            setReplyTo({
                              waMessageId: message.wa_message_id ?? message.id,
                              body: message.body,
                              fromName: message.from_me ? "atendente" : leadDisplayName(selected),
                            })
                          }
                          onPin={() =>
                            setPinnedMessageId((current) =>
                              current === message.id ? null : message.id
                            )
                          }
                          onToggleHot={() =>
                            setHotMessageIds((current) => {
                              const next = new Set(current);
                              if (next.has(message.id)) next.delete(message.id);
                              else next.add(message.id);
                              return next;
                            })
                          }
                          onReaction={(emoji) =>
                            setMessageReactions((current) => ({
                              ...current,
                              [message.id]: emoji,
                            }))
                          }
                          onTranscript={(text) =>
                            setMessages((prev) =>
                              prev.map((msg) =>
                                msg.id === message.id ? { ...msg, audio_transcript: text } : msg
                              )
                            )
                          }
                        />
                      </div>
                    ))}
                  </AnimatePresence>
                )}
                <div ref={messagesEndRef} />
              </div>

              <ChatInput
                conversationId={selected.id}
                leadName={leadDisplayName(selected)}
                configured={configured}
                sending={sending}
                draftMessage={draftMessage}
                replyTo={replyTo}
                onDraftChange={setDraftMessage}
                onSubmit={() => void sendMessage()}
                onCancelReply={() => setReplyTo(null)}
                onSent={(message) => {
                  setReplyTo(null);
                  setMessages((prev) => mergeMessages(prev, message));
                  setConversations((prev) =>
                    prev.map((c) =>
                      c.id === selected.id
                        ? {
                            ...c,
                            last_message_at: message.message_timestamp,
                            last_message_preview:
                              message.body?.slice(0, 280) ??
                              (message.message_type?.includes("audio") ? "[áudio]" : "[arquivo]"),
                          }
                        : c
                    )
                  );
                }}
              />
            </>
          )}
        </main>

        {detailsOpen && (
        <LeadDetailsPanel
          conversation={selected ?? null}
          onCollapse={() => setDetailsOpen(false)}
            onUpdateCrm={updateSelectedCrm}
        />
        )}
      </div>
    </div>
  );
}
