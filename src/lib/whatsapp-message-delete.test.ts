import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatTranscriptLine } from "@/lib/whatsapp-conversation-transcript";
import {
  conversationPatchAfterDelete,
  whatsappMessageDeleteBlock,
  WHATSAPP_DELETED_TEXT,
  WHATSAPP_DELETED_TYPE,
  WHATSAPP_DELETE_WINDOW_MS,
} from "@/lib/whatsapp-message-delete";

const db = vi.hoisted(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = "chave-de-teste";
  process.env.EVOLUTION_API_URL = "https://evolution.test";
  process.env.EVOLUTION_API_KEY = "chave-de-teste";
  process.env.EVOLUTION_INSTANCE = "COMERCIAL BP";
  return {
    message: null as Record<string, unknown> | null,
    conversation: null as Record<string, unknown> | null,
    lastOutboundAt: null as string | null,
    updates: [] as { table: string; patch: Record<string, unknown>; filters: Record<string, unknown> }[],
    removed: [] as string[],
  };
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({
    from(table: string) {
      const filters: Record<string, unknown> = {};
      let patch: Record<string, unknown> | null = null;
      const result = () => {
        if (patch) {
          db.updates.push({ table, patch, filters: { ...filters } });
          return { data: { ...db.message, ...patch }, error: null };
        }
        if (table === "whatsapp_conversations") return { data: db.conversation, error: null };
        if ("from_me" in filters) {
          return {
            data: db.lastOutboundAt ? { message_timestamp: db.lastOutboundAt } : null,
            error: null,
          };
        }
        return { data: db.message, error: null };
      };
      const builder = {
        select: () => builder,
        update: (value: Record<string, unknown>) => {
          patch = value;
          return builder;
        },
        eq: (column: string, value: unknown) => {
          filters[column] = value;
          return builder;
        },
        is: () => builder,
        order: () => builder,
        limit: () => builder,
        maybeSingle: async () => result(),
        single: async () => result(),
        then: (resolve: (value: unknown) => unknown) => resolve(result()),
      };
      return builder;
    },
    storage: {
      from: () => ({
        remove: async (paths: string[]) => {
          db.removed.push(...paths);
          return { error: null };
        },
      }),
    },
  }),
}));

const NOW = new Date("2026-11-09T12:00:00Z").getTime();
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

describe("whatsappMessageDeleteBlock", () => {
  const sent = {
    from_me: true,
    wa_message_id: "ABC",
    message_timestamp: new Date(NOW - 60_000).toISOString(),
  };

  it("permite mensagem nossa dentro do prazo", () => {
    expect(whatsappMessageDeleteBlock(sent, NOW)).toBeNull();
  });

  it("recusa mensagem do cliente, sem id do WhatsApp ou já apagada", () => {
    expect(whatsappMessageDeleteBlock({ ...sent, from_me: false }, NOW)).toMatch(/enviadas pelo escritório/);
    expect(whatsappMessageDeleteBlock({ ...sent, wa_message_id: null }, NOW)).toMatch(/não confirmou/);
    expect(whatsappMessageDeleteBlock({ ...sent, deleted_at: sent.message_timestamp }, NOW)).toMatch(/já foi apagada/);
  });

  it("recusa depois do prazo, mas aceita no limite", () => {
    const at = (ms: number) => ({ ...sent, message_timestamp: new Date(NOW - ms).toISOString() });
    expect(whatsappMessageDeleteBlock(at(WHATSAPP_DELETE_WINDOW_MS), NOW)).toBeNull();
    expect(whatsappMessageDeleteBlock(at(WHATSAPP_DELETE_WINDOW_MS + 1), NOW)).toMatch(/2 dias/);
  });
});

describe("conversationPatchAfterDelete", () => {
  const deletedAt = "2026-11-09T12:00:00Z";

  it("devolve a conversa para a fila quando a única resposta foi apagada", () => {
    expect(
      conversationPatchAfterDelete(
        {
          last_message_at: deletedAt,
          last_inbound_at: "2026-11-09T11:00:00Z",
          last_outbound_at: deletedAt,
          attendance_status: "aguardando_cliente",
        },
        deletedAt,
        null
      )
    ).toEqual({
      last_message_preview: WHATSAPP_DELETED_TEXT,
      last_outbound_at: null,
      attendance_status: "nao_respondido",
    });
  });

  it("mantém aguardando quando sobra resposta depois da última do cliente", () => {
    const patch = conversationPatchAfterDelete(
      {
        last_message_at: deletedAt,
        last_inbound_at: "2026-11-09T11:00:00Z",
        last_outbound_at: deletedAt,
        attendance_status: "aguardando_cliente",
      },
      deletedAt,
      "2026-11-09T11:30:00Z"
    );
    expect(patch.attendance_status).toBeUndefined();
    expect(patch.last_outbound_at).toBe("2026-11-09T11:30:00Z");
  });

  it("não mexe em nada quando há mensagens mais novas dos dois lados", () => {
    expect(
      conversationPatchAfterDelete(
        {
          last_message_at: "2026-11-09T13:00:00Z",
          last_inbound_at: "2026-11-09T12:30:00Z",
          last_outbound_at: "2026-11-09T13:00:00Z",
          attendance_status: "aguardando_cliente",
        },
        deletedAt,
        "2026-11-09T13:00:00Z"
      )
    ).toEqual({});
  });

  it("não reabre conversa em atendimento nem a que nós iniciamos", () => {
    const base = { last_message_at: deletedAt, last_outbound_at: deletedAt };
    expect(
      conversationPatchAfterDelete(
        { ...base, last_inbound_at: "2026-11-09T11:00:00Z", attendance_status: "em_atendimento" },
        deletedAt,
        null
      ).attendance_status
    ).toBeUndefined();
    expect(
      conversationPatchAfterDelete(
        { ...base, last_inbound_at: null, attendance_status: "aguardando_cliente" },
        deletedAt,
        null
      ).attendance_status
    ).toBeUndefined();
  });
});

describe("transcrição da IA", () => {
  it("áudio apagado aparece como apagado, não como áudio sem transcrição", () => {
    const line = formatTranscriptLine(
      {
        from_me: true,
        body: WHATSAPP_DELETED_TEXT,
        message_type: WHATSAPP_DELETED_TYPE,
        message_timestamp: "2026-11-09T12:00:00Z",
      },
      { leadName: "Cliente" }
    );
    expect(line).toContain(`Escritório: ${WHATSAPP_DELETED_TEXT}`);
  });
});

describe("deleteEvolutionMessageForEveryone", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    db.updates = [];
    db.removed = [];
    db.lastOutboundAt = null;
    db.message = {
      id: "msg-1",
      conversation_id: "conv-1",
      wa_message_id: "WA1",
      remote_jid: "5519999999999@s.whatsapp.net",
      from_me: true,
      message_timestamp: minutesAgo(5),
      instance_name: "COMERCIAL BP",
      media_storage_path: null,
      raw_payload: {
        key: { id: "WA1", remoteJid: "5519999999999@s.whatsapp.net" },
        message: { conversation: "texto enviado por engano" },
      },
      deleted_at: null,
    };
    db.conversation = {
      last_message_at: db.message.message_timestamp,
      last_inbound_at: minutesAgo(60),
      last_outbound_at: db.message.message_timestamp,
      attendance_status: "aguardando_cliente",
    };
  });

  const evolutionAccepts = () =>
    fetchMock.mockImplementation(async () => {
      // A Evolution vem antes de qualquer gravação no banco.
      expect(db.updates).toEqual([]);
      return new Response(JSON.stringify({ key: { id: "REVOKE" } }), { status: 201 });
    });

  it("pede a exclusão na Evolution e tira o conteúdo do painel", async () => {
    evolutionAccepts();
    const { deleteEvolutionMessageForEveryone } = await import("@/lib/evolution-whatsapp");

    const result = await deleteEvolutionMessageForEveryone("msg-1", "user-1");

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://evolution.test/chat/deleteMessageForEveryone/COMERCIAL%20BP");
    expect(init.method).toBe("DELETE");
    expect(JSON.parse(init.body as string)).toEqual({
      id: "WA1",
      remoteJid: "5519999999999@s.whatsapp.net",
      fromMe: true,
    });

    const messagePatch = db.updates[0].patch;
    expect(db.updates[0].table).toBe("whatsapp_messages");
    expect(db.updates[0].filters).toEqual({ id: "msg-1" });
    expect(messagePatch.body).toBe(WHATSAPP_DELETED_TEXT);
    expect(messagePatch.message_type).toBe(WHATSAPP_DELETED_TYPE);
    expect(messagePatch.deleted_by).toBe("user-1");
    expect(messagePatch.deleted_at).toEqual(expect.any(String));
    expect(JSON.stringify(messagePatch.raw_payload)).not.toContain("texto enviado por engano");

    const quotePatch = db.updates[1];
    expect(quotePatch.filters).toEqual({ conversation_id: "conv-1", quoted_wa_message_id: "WA1" });
    expect(quotePatch.patch).toEqual({ quoted_body: WHATSAPP_DELETED_TEXT });

    expect(result.conversation).toEqual({
      last_message_preview: WHATSAPP_DELETED_TEXT,
      last_outbound_at: null,
      attendance_status: "nao_respondido",
    });
    expect(db.updates[2].table).toBe("whatsapp_conversations");
    expect(db.updates[2].patch).toMatchObject(result.conversation);
  });

  it("apaga o arquivo guardado de mídia", async () => {
    db.message = { ...db.message, media_storage_path: "conv-1/foto.jpg" };
    evolutionAccepts();
    const { deleteEvolutionMessageForEveryone } = await import("@/lib/evolution-whatsapp");

    await deleteEvolutionMessageForEveryone("msg-1", null);

    expect(db.removed).toEqual(["conv-1/foto.jpg"]);
    expect(db.updates[0].patch.media_storage_path).toBeNull();
  });

  it("não mexe no painel se a Evolution recusar", async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ message: "not found" }), { status: 400 }));
    const { deleteEvolutionMessageForEveryone } = await import("@/lib/evolution-whatsapp");

    await expect(deleteEvolutionMessageForEveryone("msg-1", null)).rejects.toThrow(/continua lá/);

    expect(db.updates).toEqual([]);
    expect(db.removed).toEqual([]);
  });

  it("não chama a Evolution para mensagem do cliente", async () => {
    db.message = { ...db.message, from_me: false };
    const { deleteEvolutionMessageForEveryone, WhatsappMessageNotDeletableError } = await import(
      "@/lib/evolution-whatsapp"
    );

    await expect(deleteEvolutionMessageForEveryone("msg-1", null)).rejects.toBeInstanceOf(
      WhatsappMessageNotDeletableError
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(db.updates).toEqual([]);
  });
});
