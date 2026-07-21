# NFC Hub — configuração do n8n

O NFC Hub usa um único endpoint privado do n8n no servidor. A etiqueta e o navegador nunca recebem essa URL nem o segredo de assinatura.

## Variáveis de ambiente

```env
# Já utilizadas pelo ORQESTRAI
NEXT_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
MARKETING_PUBLIC_URL=https://dominio-do-sistema.com

# NFC Hub
NFC_PUBLIC_BASE_URL=https://dominio-do-sistema.com
NFC_N8N_WEBHOOK_URL=https://n8n.seu-dominio.com/webhook/orquestrai-nfc
NFC_N8N_SIGNING_SECRET=gere-um-segredo-aleatorio-longo
NFC_IP_HASH_SECRET=gere-outro-segredo-aleatorio-longo
```

`NFC_PUBLIC_BASE_URL` é opcional quando `MARKETING_PUBLIC_URL` já representa o domínio público correto. `NFC_IP_HASH_SECRET` deve ser diferente do segredo de webhook.

## Requisição enviada pelo ORQESTRAI

```http
POST /webhook/orquestrai-nfc
Content-Type: application/json
X-ORQESTRAI-Signature: sha256=<hmac-do-corpo-bruto>
X-ORQESTRAI-Event: nfc.tag.scanned
X-Idempotency-Key: <sha256-da-leitura-e-acao>
```

Exemplo de payload:

```json
{
  "event": "nfc.tag.scanned",
  "tag": {
    "id": "e95b62fc-9947-42bc-b715-bc8ad1560191",
    "code": "NFC-0001",
    "name": "Impressora da Recepção",
    "environment": "Escritório",
    "location": "Recepção",
    "category": "Equipamento"
  },
  "scan": {
    "id": "77206985-2352-47b6-8be8-86102145ee1b",
    "timestamp": "2026-07-20T15:00:00.000Z",
    "userId": null,
    "anonymousSessionId": "6c9ec4f3-576a-4c67-880b-a77078f7bcc4"
  },
  "action": {
    "type": "webhook",
    "config": {
      "workflowKey": "abrir-ticket-impressora"
    }
  },
  "formData": {},
  "idempotencyKey": "4e1f..."
}
```

## Validação da assinatura em um Code node

O primeiro passo do workflow deve validar o corpo bruto antes de executar qualquer integração. O exemplo abaixo assume que o webhook disponibiliza o corpo recebido e os headers no item.

```js
const crypto = require("crypto");

const secret = $env.NFC_N8N_SIGNING_SECRET;
const received = $json.headers["x-orquestrai-signature"];
const rawBody =
  typeof $json.rawBody === "string"
    ? $json.rawBody
    : JSON.stringify($json.body);

const expected =
  "sha256=" +
  crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

const receivedBuffer = Buffer.from(received || "");
const expectedBuffer = Buffer.from(expected);

if (
  receivedBuffer.length !== expectedBuffer.length ||
  !crypto.timingSafeEqual(receivedBuffer, expectedBuffer)
) {
  throw new Error("Assinatura NFC inválida");
}

return [{ json: $json.body }];
```

Configure `NFC_N8N_SIGNING_SECRET` como credencial/variável segura no ambiente do n8n; não grave o valor dentro do workflow exportado.

## Roteamento sugerido

Depois da validação:

1. Use um Switch pelo campo `action.config.workflowKey`.
2. Verifique `X-Idempotency-Key` em um Data Store ou tabela antes de processar.
3. Execute Evolution, Supabase ou outras APIs apenas no ramo correspondente.
4. Retorne HTTP 2xx somente quando o fluxo for aceito.
5. Não devolva credenciais, payloads internos ou stack traces ao ORQESTRAI.

## Aplicação da migration

Revise e aplique `supabase/migrations/20260720120000_nfc_hub.sql` primeiro em um ambiente de teste. Depois:

1. Gere novamente os tipos do Supabase, se o projeto passar a manter tipos gerados.
2. Execute os advisors de segurança e performance.
3. Confirme que nenhuma tabela `nfc_*` possui `GRANT` para `anon`.
4. Teste uma etiqueta inativa, uma URL simples e um workflow de homologação antes da produção.
