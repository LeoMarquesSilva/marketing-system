# Evolution → Supabase (direto)

A Evolution **não grava nativamente no Postgres** — ela só faz `POST` HTTP (webhook).  
A forma mais direta de chegar no Supabase é uma **Edge Function** que recebe o webhook e grava nas tabelas.

## Fluxo

```
Evolution (BP)
    ↓ POST webhook
Supabase Edge Function  /functions/v1/evolution-webhook
    ↓ service role
Postgres  whatsapp_conversations + whatsapp_messages
    ↓ Realtime (já habilitado)
Inbox no app  /trafego-pago
```

Sem Next.js, n8n ou outros sistemas no meio. O app só **lê** do Supabase (Realtime + API).

## URL do webhook

```
https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/evolution-webhook
```

(Gerada automaticamente a partir de `NEXT_PUBLIC_SUPABASE_URL`.)

## Configurar na Evolution

**Pela UI:** `/trafego-pago` → Leads WhatsApp → **Apontar webhook BP → Supabase**

**Manual:**

```http
POST {EVOLUTION_API_URL}/webhook/set/BP
apikey: {EVOLUTION_API_KEY}

{
  "webhook": {
    "enabled": true,
    "url": "https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/evolution-webhook",
    "webhookByEvents": false,
    "webhookBase64": false,
    "events": ["MESSAGES_UPSERT", "SEND_MESSAGE", "MESSAGES_UPDATE"]
  }
}
```

## Edge Function

Código: `supabase/functions/evolution-webhook/index.ts`  
Deploy via Supabase MCP ou CLI (`supabase functions deploy evolution-webhook --no-verify-jwt`).

Secrets opcionais no Supabase (Settings → Edge Functions):

- `EVOLUTION_INSTANCE=BP`
- `EVOLUTION_WEBHOOK_SECRET` (se quiser validar header `apikey`)

## Fallback

**Sincronizar Evolution** na UI — puxa mensagens via API sem webhook.

## Uma URL por instância

A Evolution aceita **apenas 1 webhook** por instância. Ao apontar para o Supabase, o destino anterior deixa de receber eventos.
