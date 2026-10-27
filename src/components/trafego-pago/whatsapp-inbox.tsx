"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AlertCircle, Loader2, MessageCircle, X } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import { WHATSAPP_CONVERSATION_PARAM, WHATSAPP_INBOX_PATH } from "@/lib/whatsapp-lead-push";
import { supabase } from "@/utils/supabase/client";
import { useAuth } from "@/contexts/auth-context";
import { LeadList } from "@/components/trafego-pago/lead-list";
import { ConversationHeader } from "@/components/trafego-pago/conversation-header";
import { MessageBubble } from "@/components/trafego-pago/message-bubble";
import { ChatInput } from "@/components/trafego-pago/chat-input";
import { LeadDetailsContent, LeadDetailsPanel } from "@/components/trafego-pago/lead-details-panel";
import {
  WhatsappConnectionAlert,
  WhatsappConnectionDialog,
  WhatsappConnectionIndicator,
  connectionHealth,
  type RealtimeStatus,
  type WhatsappInstanceState,
} from "@/components/trafego-pago/whatsapp-connection-dialog";
import type {
  LeadFilter,
  WhatsappAgent,
  WhatsappConversation,
  WhatsappMessage,
  WhatsappReplyTarget,
} from "@/components/trafego-pago/whatsapp-crm-types";
import { leadDisplayName, sameMessageDay } from "@/components/trafego-pago/whatsapp-crm-utils";
import {
  STALE_CONVERSATION_DAYS,
  buildInboxView,
  formatDaySeparator,
  isStaleOpenConversation,
  lastMessageIsOurs,
  type InboxOwnerTab,
  type InboxStatusTab,
} from "@/components/trafego-pago/whatsapp-inbox-view";

type Conversation = WhatsappConversation;
type Message = WhatsappMessage;
type ReplyTarget = WhatsappReplyTarget;

const RECONCILIATION_INTERVAL_MS = 10 * 60_000;
const OWNER_TAB_STORAGE_KEY = "orquestrai:whatsapp:owner-tab";
const STATUS_TAB_STORAGE_KEY = "orquestrai:whatsapp:status-tab";
const NOTICE_MS = 6000;

interface Notice {
  text: string;
  undo?: () => void;
}

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

function readStoredTab<T extends string>(key: string, allowed: readonly T[]): T | null {
  try {
    const value = window.localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : null;
  } catch {
    return null;
  }
}

function storeTab(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Preferência de visualização: sem storage, só não lembra a aba.
  }
}

function isWideScreen(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;
}

export function WhatsappInbox() {
  const { user, profile } = useAuth();
  const myUserId = profile?.id ?? null;
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [savingTags, setSavingTags] = useState(false);
  const [draftMessage, setDraftMessage] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const presenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPreviewRef = useRef<string>("");
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [leadFilter, setLeadFilter] = useState<LeadFilter>("all");
  const [ownerTab, setOwnerTab] = useState<InboxOwnerTab>("all");
  const [statusTab, setStatusTab] = useState<InboxStatusTab>("open");
  const [agents, setAgents] = useState<WhatsappAgent[]>([]);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [staleDialogOpen, setStaleDialogOpen] = useState(false);
  const [resolvingStale, setResolvingStale] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeStatus>("connecting");
  const [messageReactions, setMessageReactions] = useState<Record<string, string>>({});
  const [instanceState, setInstanceState] = useState<WhatsappInstanceState | null>(null);
  const [frameEl, setFrameEl] = useState<HTMLDivElement | null>(null);
  const [frameHeight, setFrameHeight] = useState<number | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const selectedIdRef = useRef<string | null>(null);
  const conversationsRef = useRef<Conversation[]>([]);
  const avatarRefreshRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  // Clique no aviso de lead: /trafego-pago?conversa=<id> abre a conversa. O
  // parâmetro sai da URL logo depois, para o próximo aviso da mesma conversa
  // abrir de novo e o recarregar da página não prender nela.
  const conversationParam = useSearchParams().get(WHATSAPP_CONVERSATION_PARAM);
  useEffect(() => {
    if (!conversationParam) return;
    setSelectedId(conversationParam);
    window.history.replaceState(null, "", WHATSAPP_INBOX_PATH);
  }, [conversationParam]);

  useEffect(() => {
    conversationsRef.current = conversations;
  }, [conversations]);

  // Abas lembradas por navegador (lidas depois de montar, para não divergir do SSR).
  useEffect(() => {
    const storedOwner = readStoredTab<InboxOwnerTab>(OWNER_TAB_STORAGE_KEY, ["mine", "unassigned", "all"]);
    const storedStatus = readStoredTab<InboxStatusTab>(STATUS_TAB_STORAGE_KEY, ["open", "waiting", "resolved"]);
    if (storedOwner) setOwnerTab(storedOwner);
    if (storedStatus) setStatusTab(storedStatus);
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), NOTICE_MS);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    let cancelled = false;
    async function checkConnection() {
      try {
        const res = await authFetch("/api/evolution/connection-state");
        const json = await res.json();
        if (!cancelled && res.ok) setInstanceState(json.status ?? null);
      } catch {
        /* ignore */
      }
    }
    void checkConnection();
    const interval = setInterval(checkConnection, 2 * 60_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    authFetch("/api/evolution/agents")
      .then(async (res) => (res.ok ? ((await res.json()) as { agents?: WhatsappAgent[] }) : null))
      .then((json) => {
        if (!cancelled && json?.agents) setAgents(json.agents);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const loadConversations = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await authFetch("/api/evolution/conversations");
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível carregar as conversas.");
      const incoming = (json.conversations ?? []).map((c: Conversation) =>
        normalizeConversation(c)
      );
      setConversations((prev) =>
        mergeConversationLists(prev, incoming, selectedIdRef.current)
      );
      setConfigured(json.configured ?? false);
      setFetchedAt(json.fetchedAt ?? new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as conversas.");
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

  const loadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!silent) setLoadingMessages(true);
    try {
      const params = new URLSearchParams({ conversationId });
      params.set("syncHistory", silent ? "0" : "1");
      const shouldRefreshAvatar =
        !silent && !avatarRefreshRef.current.has(conversationId);
      if (shouldRefreshAvatar) {
        params.set("refreshAvatar", "1");
        params.set("refreshMetadata", "1");
      }

      const res = await authFetch(`/api/evolution/conversations?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível carregar as mensagens.");
      if (shouldRefreshAvatar) avatarRefreshRef.current.add(conversationId);
      setMessages(json.messages ?? []);
      if (json.conversation) {
        lastPreviewRef.current =
          (json.conversation as Conversation).last_message_preview ?? "";
      }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as mensagens.");
    } finally {
      if (!silent) setLoadingMessages(false);
    }
  }, []);

  /** PATCH na conversa com atualização otimista; desfaz se o servidor recusar. */
  const patchConversation = useCallback(
    async (conversationId: string, patch: Record<string, unknown>, optimistic: Partial<Conversation>) => {
      const before = conversationsRef.current.find((c) => c.id === conversationId);
      setConversations((prev) => prev.map((c) => (c.id === conversationId ? { ...c, ...optimistic } : c)));
      setUpdatingId(conversationId);
      setError(null);
      try {
        const res = await authFetch("/api/evolution/conversations", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ conversationId, ...patch }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "Não foi possível salvar.");
        const updated = json.conversation as Conversation | null;
        if (updated) {
          setConversations((prev) =>
            prev.map((c) =>
              c.id === conversationId
                ? { ...c, ...normalizeConversation(updated), unread_count: optimistic.unread_count ?? c.unread_count }
                : c
            )
          );
        }
        return true;
      } catch (err) {
        if (before) {
          setConversations((prev) => prev.map((c) => (c.id === conversationId ? before : c)));
        }
        setError(err instanceof Error ? err.message : "Não foi possível salvar.");
        return false;
      } finally {
        setUpdatingId(null);
      }
    },
    []
  );

  const saveTags = useCallback(
    async (conversationId: string, tags: string[]) => {
      setSavingTags(true);
      const ok = await patchConversation(conversationId, { tags }, { tags });
      setSavingTags(false);
      if (ok) await loadTagSuggestions();
    },
    [patchConversation, loadTagSuggestions]
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
      if (!res.ok) throw new Error(json.error ?? "Não foi possível enviar.");
      const message = json.message as Message;
      setMessages((prev) => mergeMessages(prev, message));
      setConversations((prev) =>
        prev.map((c) =>
          c.id === selectedId
            ? {
                ...c,
                last_message_at: message.message_timestamp,
                last_outbound_at: message.message_timestamp,
                last_message_preview: text.slice(0, 280),
                attendance_status: "aguardando_cliente",
                owner_user_id: c.owner_user_id ?? myUserId,
              }
            : c
        )
      );
    } catch (err) {
      setDraftMessage(text);
      setError(err instanceof Error ? err.message : "Não foi possível enviar a mensagem.");
    } finally {
      setSending(false);
    }
  }, [selectedId, draftMessage, sending, replyTo, myUserId]);

  const sendReaction = useCallback(
    async (message: Message, emoji: string) => {
      if (!selectedId || !message.wa_message_id) return;
      setMessageReactions((current) => ({ ...current, [message.id]: emoji }));
      try {
        const res = await authFetch("/api/evolution/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversationId: selectedId,
            reaction: emoji,
            waMessageId: message.wa_message_id,
          }),
        });
        if (!res.ok) throw new Error();
      } catch {
        setMessageReactions((current) => {
          const next = { ...current };
          delete next[message.id];
          return next;
        });
        setError("Não foi possível enviar a reação.");
      }
    },
    [selectedId]
  );

  useEffect(() => {
    if (!user) return;

    loadConversations();
    loadTagSuggestions();

    const pollId = setInterval(() => {
      void loadConversations(true);
    }, RECONCILIATION_INTERVAL_MS);

    return () => clearInterval(pollId);
  }, [user, loadConversations, loadTagSuggestions]);

  useEffect(() => {
    if (!user) return;

    let unknownConversationTimer: ReturnType<typeof setTimeout> | null = null;
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
          if (isOpen && row.last_message_preview) {
            lastPreviewRef.current = row.last_message_preview;
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
              // Resolvida zera as não lidas no servidor; o local não deve segurar o número.
              if (nextRow.attendance_status === "resolvido") return nextRow;
              return {
                ...nextRow,
                unread_count: Math.max(
                  normalizeUnreadCount(nextRow.unread_count),
                  normalizeUnreadCount(c.unread_count)
                ),
              };
            });
          });
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
            const conversationExists = conversationsRef.current.some(
              (conversation) => conversation.id === conversationId
            );
            setConversations((prev) =>
              bumpConversationPreview(prev, conversationId, {
                incrementUnread: true,
                last_message_at: incoming.message_timestamp,
                last_message_preview: incoming.body?.slice(0, 280) ?? undefined,
              })
            );
            if (!conversationExists) {
              if (unknownConversationTimer) clearTimeout(unknownConversationTimer);
              unknownConversationTimer = setTimeout(
                () => void loadConversations(true),
                1500
              );
            }
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
      if (unknownConversationTimer) clearTimeout(unknownConversationTimer);
      supabase.removeChannel(channel);
    };
  }, [user, loadConversations]);

  useEffect(() => {
    if (selectedId) loadMessages(selectedId);
    else setMessages([]);
    setDraftMessage("");
    setReplyTo(null);
    lastPreviewRef.current = "";
  }, [selectedId, loadMessages]);

  useEffect(() => {
    if (!selectedId) return;
    const pollId = setInterval(() => {
      void loadMessages(selectedId, true);
    }, RECONCILIATION_INTERVAL_MS);
    return () => clearInterval(pollId);
  }, [selectedId, loadMessages]);

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

  const health = connectionHealth(configured, instanceState, realtimeStatus);

  // A caixa ocupa a altura que sobra na tela (a lista e a conversa rolam por dentro).
  // O inbox fica montado escondido na aba de anúncios: o ResizeObserver refaz a
  // conta quando ele aparece.
  useEffect(() => {
    if (!frameEl) return;
    const update = () => {
      if (frameEl.offsetParent === null) return;
      const top = frameEl.getBoundingClientRect().top + window.scrollY;
      const bottomGap = window.matchMedia("(min-width: 768px)").matches ? 24 : 88;
      setFrameHeight(Math.max(460, Math.round(window.innerHeight - top - bottomGap)));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(frameEl);
    window.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
    };
  }, [frameEl, health, error]);

  const agentsById = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const view = useMemo(
    () =>
      buildInboxView(conversations, {
        ownerTab,
        statusTab,
        leadFilter,
        search: searchQuery,
        myUserId,
      }),
    [conversations, ownerTab, statusTab, leadFilter, searchQuery, myUserId]
  );
  const staleConversations = useMemo(
    () => conversations.filter((c) => isStaleOpenConversation(c)),
    [conversations]
  );

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const selectedOwner = selected?.owner_user_id ? agentsById.get(selected.owner_user_id) ?? null : null;

  const changeOwnerTab = (tab: InboxOwnerTab) => {
    setOwnerTab(tab);
    storeTab(OWNER_TAB_STORAGE_KEY, tab);
  };

  const changeStatusTab = (tab: InboxStatusTab) => {
    setStatusTab(tab);
    storeTab(STATUS_TAB_STORAGE_KEY, tab);
  };

  const assignOwner = (userId: string | null) => {
    if (!selected) return;
    const previous = selected.owner_user_id ?? null;
    const conversationId = selected.id;
    void patchConversation(conversationId, { owner_user_id: userId }, { owner_user_id: userId }).then((ok) => {
      if (!ok) return;
      const agent = userId ? agentsById.get(userId) : null;
      setNotice({
        text: agent ? `Responsável: ${agent.name}` : "Conversa sem responsável",
        undo: () => void patchConversation(conversationId, { owner_user_id: previous }, { owner_user_id: previous }),
      });
    });
  };

  const resolveSelected = () => {
    if (!selected) return;
    const conversation = selected;
    const previousStatus = conversation.attendance_status ?? "nao_respondido";
    const index = view.conversations.findIndex((c) => c.id === conversation.id);
    const next = view.conversations[index + 1] ?? view.conversations[index - 1] ?? null;

    void patchConversation(
      conversation.id,
      { attendance_status: "resolvido" },
      { attendance_status: "resolvido", unread_count: 0 }
    ).then((ok) => {
      if (!ok) return;
      if (statusTab !== "resolved") setSelectedId(isWideScreen() ? (next?.id ?? null) : null);
      setNotice({
        text: `Conversa com ${leadDisplayName(conversation)} resolvida`,
        undo: () =>
          void patchConversation(
            conversation.id,
            { attendance_status: previousStatus },
            { attendance_status: previousStatus }
          ),
      });
    });
  };

  const reopenSelected = () => {
    if (!selected) return;
    const status = lastMessageIsOurs(selected) ? "aguardando_cliente" : "nao_respondido";
    void patchConversation(selected.id, { attendance_status: status }, { attendance_status: status });
  };

  const resolveStale = async () => {
    setResolvingStale(true);
    setError(null);
    try {
      const res = await authFetch("/api/evolution/conversations/resolve-stale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: STALE_CONVERSATION_DAYS }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Não foi possível resolver as conversas paradas.");
      const staleIds = new Set(staleConversations.map((c) => c.id));
      setConversations((prev) =>
        prev.map((c) => (staleIds.has(c.id) ? { ...c, attendance_status: "resolvido", unread_count: 0 } : c))
      );
      const resolved = Number(json.resolved ?? 0);
      setNotice({ text: resolved === 1 ? "1 conversa parada resolvida" : `${resolved} conversas paradas resolvidas` });
      setStaleDialogOpen(false);
      void loadConversations(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível resolver as conversas paradas.");
    } finally {
      setResolvingStale(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
        Carregando conversas…
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <WhatsappConnectionAlert health={health} instance={instanceState} onOpen={() => setConnectionOpen(true)} />

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p className="min-w-0 flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} aria-label="Fechar aviso" className="rounded p-0.5 hover:bg-red-100 dark:hover:bg-red-900/40">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div
        ref={setFrameEl}
        style={frameHeight ? { height: frameHeight } : undefined}
        className="relative grid min-h-[460px] grid-cols-[minmax(0,1fr)] grid-rows-[minmax(0,1fr)] overflow-hidden rounded-lg border bg-white shadow-sm dark:bg-card lg:grid-cols-[340px_minmax(0,1fr)] xl:grid-cols-[340px_minmax(0,1fr)_300px]"
      >
        <LeadList
          className={selected ? "hidden lg:flex" : "flex"}
          view={view}
          totalConversations={conversations.length}
          selectedId={selectedId}
          ownerTab={ownerTab}
          statusTab={statusTab}
          leadFilter={leadFilter}
          searchQuery={searchQuery}
          agentsById={agentsById}
          staleCount={staleConversations.length}
          connectionSlot={<WhatsappConnectionIndicator health={health} onClick={() => setConnectionOpen(true)} />}
          onOwnerTabChange={changeOwnerTab}
          onStatusTabChange={changeStatusTab}
          onLeadFilterChange={setLeadFilter}
          onSearchChange={setSearchQuery}
          onSelect={setSelectedId}
          onResolveStale={() => setStaleDialogOpen(true)}
        />

        <main className={cn("min-h-0 min-w-0 flex-col bg-background", selected ? "flex" : "hidden lg:flex")}>
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 bg-muted/30 p-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-muted-foreground shadow-sm dark:bg-card">
                <MessageCircle className="h-6 w-6" aria-hidden />
              </span>
              <p className="text-sm font-medium">Escolha uma conversa para responder</p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Ao responder um lead sem responsável, ele passa a ser seu.
              </p>
            </div>
          ) : (
            <>
              <ConversationHeader
                conversation={selected}
                owner={selectedOwner}
                agents={agents}
                myUserId={myUserId}
                updating={updatingId === selected.id}
                onBack={() => setSelectedId(null)}
                onAssign={assignOwner}
                onResolve={resolveSelected}
                onReopen={reopenSelected}
                onOpenDetails={() => setDetailsOpen(true)}
              />

              <div
                ref={messagesContainerRef}
                className="min-h-0 flex-1 space-y-4 overflow-y-auto overflow-x-hidden bg-[#f3f5f7] p-4 dark:bg-muted/5 sm:p-5"
              >
                {loadingMessages ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center gap-3 py-12 text-center text-muted-foreground">
                    <MessageCircle className="h-10 w-10 opacity-20" />
                    <p className="max-w-[220px] text-sm">
                      Nenhuma mensagem salva desta conversa. Envie a primeira abaixo.
                    </p>
                  </div>
                ) : (
                  <AnimatePresence initial={false}>
                    {messages.map((message, index) => (
                      <div key={message.id} className="space-y-4">
                        {!sameMessageDay(messages[index - 1], message) && (
                          <div className="flex justify-center">
                            <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm dark:bg-card">
                              {formatDaySeparator(message.message_timestamp)}
                            </span>
                          </div>
                        )}
                        <MessageBubble
                          message={message}
                          conversation={selected}
                          reaction={messageReactions[message.id]}
                          onReply={() =>
                            setReplyTo({
                              waMessageId: message.wa_message_id ?? message.id,
                              body: message.body,
                              fromName: message.from_me ? "atendente" : leadDisplayName(selected),
                            })
                          }
                          onReaction={(emoji) => void sendReaction(message, emoji)}
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
                            last_outbound_at: message.message_timestamp,
                            last_message_preview:
                              message.body?.slice(0, 280) ??
                              (message.message_type?.includes("audio") ? "[áudio]" : "[arquivo]"),
                            attendance_status: "aguardando_cliente",
                            owner_user_id: c.owner_user_id ?? myUserId,
                          }
                        : c
                    )
                  );
                }}
              />
            </>
          )}
        </main>

        <LeadDetailsPanel
          className="hidden xl:flex"
          conversation={selected ?? undefined}
          owner={selectedOwner}
          tagSuggestions={tagSuggestions}
          savingTags={savingTags}
          onSaveTags={(tags) => selected && void saveTags(selected.id, tags)}
          onUpdateCrm={(patch) => selected && void patchConversation(selected.id, patch, patch as Partial<Conversation>)}
        />

        {notice && (
          <div
            role="status"
            className="absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-3 rounded-md bg-[#04202f] px-4 py-2.5 text-sm text-white shadow-lg"
          >
            <span className="min-w-0 truncate">{notice.text}</span>
            {notice.undo && (
              <button
                type="button"
                onClick={() => {
                  notice.undo?.();
                  setNotice(null);
                }}
                className="shrink-0 font-semibold text-[#47cdd0] hover:underline"
              >
                Desfazer
              </button>
            )}
          </div>
        )}
      </div>

      <Dialog open={detailsOpen && Boolean(selected)} onOpenChange={setDetailsOpen}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-md">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>Detalhes do lead</DialogTitle>
            <DialogDescription className="sr-only">Dados, origem e tags da conversa.</DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
              <LeadDetailsContent
                conversation={selected}
                owner={selectedOwner}
                tagSuggestions={tagSuggestions}
                savingTags={savingTags}
                onSaveTags={(tags) => void saveTags(selected.id, tags)}
                onUpdateCrm={(patch) => void patchConversation(selected.id, patch, patch as Partial<Conversation>)}
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={staleDialogOpen} onOpenChange={(open) => !resolvingStale && setStaleDialogOpen(open)}>
        <DialogContent className="flex max-h-[90dvh] flex-col gap-0 p-0 sm:max-w-lg">
          <DialogHeader className="border-b px-6 py-4">
            <DialogTitle>
              Resolver {staleConversations.length === 1 ? "1 conversa parada" : `${staleConversations.length} conversas paradas`}?
            </DialogTitle>
            <DialogDescription>
              Sem nenhuma mensagem há mais de {STALE_CONVERSATION_DAYS} dias.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 px-6 py-5 text-sm text-muted-foreground">
            <p>Elas saem de Abertas e Aguardando, e as não lidas delas deixam de contar no menu.</p>
            <p>Nada é apagado. Se o cliente escrever de novo, a conversa volta sozinha para Abertas.</p>
          </div>
          <DialogFooter className="border-t px-6 py-4">
            <Button type="button" variant="outline" disabled={resolvingStale} onClick={() => setStaleDialogOpen(false)}>
              Cancelar
            </Button>
            <Button type="button" disabled={resolvingStale} onClick={() => void resolveStale()}>
              {resolvingStale && <Loader2 className="animate-spin" />}
              Resolver conversas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <WhatsappConnectionDialog
        open={connectionOpen}
        onOpenChange={setConnectionOpen}
        health={health}
        instance={instanceState}
        realtime={realtimeStatus}
        fetchedAt={fetchedAt}
        configured={configured}
        onSynced={async () => {
          await loadConversations(true);
          if (selectedId) await loadMessages(selectedId, true);
        }}
      />
    </div>
  );
}
