# API central de fotos oficiais

Fonte canônica: Supabase **ORQESTRAI** (`qwihfvagemzlyypeohpc`).

Base URL:

```text
https://qwihfvagemzlyypeohpc.supabase.co/functions/v1/official-photos-api
```

Esta API é exclusivamente server-to-server. Nunca coloque a chave de consumidor
em navegador, aplicativo público ou variável `NEXT_PUBLIC_*`.

## Autenticação

Envie a chave individual do sistema em um destes headers:

```http
x-api-key: ofp_...
```

```http
Authorization: Bearer ofp_...
```

O banco armazena somente o SHA-256 da chave. Cada consumidor pode ser desativado
ou rotacionado isoladamente. O limite padrão é de 300 requisições por minuto.

Administradores podem gerar/rotacionar uma chave pela sessão do Marketing
System:

```http
POST /api/admin/official-photo-consumers/{responsum|sioe}/rotate-key
```

A chave em texto puro aparece somente nessa resposta. Copie-a imediatamente
para o secret manager server-side do sistema consumidor.

## Endpoints

### Saúde

```http
GET /health
```

Não exige autenticação e não retorna dados do banco.

### Foto por identificador externo

```http
GET /v1/photos/{externalUserId}
x-api-key: {OFFICIAL_PHOTOS_API_KEY}
```

Resposta:

```json
{
  "data": {
    "externalUserId": "uuid-no-sistema-consumidor",
    "userId": "uuid-no-orquestrai",
    "name": "Nome da pessoa",
    "email": "pessoa@exemplo.com",
    "photoUrl": "https://.../foto.jpg",
    "source": "selected",
    "version": "hash-de-versao",
    "updatedAt": "2026-08-17T15:00:00.000Z"
  }
}
```

`source` pode ser:

- `selected`: foto confirmada em Minhas Fotos;
- `legacy_avatar`: avatar anterior, usado durante a transição;
- `none`: pessoa sem foto disponível.

### Batch

```http
POST /v1/photos/batch
Content-Type: application/json
x-api-key: {OFFICIAL_PHOTOS_API_KEY}

{
  "externalUserIds": ["id-1", "id-2"]
}
```

Aceita entre 1 e 100 IDs. A resposta inclui `data` e `notFound`.

### Fallback temporário por e-mail

```http
GET /v1/photos?email=pessoa@exemplo.com
x-api-key: {OFFICIAL_PHOTOS_API_KEY}
```

O endpoint retorna `409` quando o e-mail é duplicado. Prefira sempre o vínculo
por identificador externo.

## Códigos de resposta

- `200`: consulta concluída;
- `400`: payload ou identificador inválido;
- `401`: chave ausente, inválida, inativa ou sem escopo;
- `404`: pessoa ou rota não encontrada;
- `409`: e-mail ambíguo;
- `429`: limite por minuto excedido;
- `500`: erro interno sem detalhes sensíveis.

## Integração server-side

```ts
const response = await fetch(
  `${process.env.ORQESTRAI_URL}/functions/v1/official-photos-api/v1/photos/${userId}`,
  {
    headers: {
      "x-api-key": process.env.OFFICIAL_PHOTOS_API_KEY!,
    },
  }
);

if (!response.ok) {
  throw new Error(`Falha ao consultar foto oficial: ${response.status}`);
}

const { data } = await response.json();
```

## Operação

- A escolha oficial é mantida por trigger no banco.
- Responsum e SIOE podem começar pelo fallback de e-mail até seus IDs serem
  cadastrados em `official_photo_system_links`.
- Requisições são auditadas em `official_photo_api_requests` sem armazenar
  chave ou URL consultada.
- Para novo deploy, execute `node scripts/redeploy-official-photos-api.mjs` e
  envie o payload gerado ao MCP `user-ORQESTRAI`.
