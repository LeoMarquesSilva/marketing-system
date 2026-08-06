# NPS enviado — marcar envio por usuário

## Objetivo

No fluxo de gerar o link NPS de um grupo, permitir marcar **“NPS enviado”** (primeiro clique trava), registrar quem marcou e quando, e exibir isso no dialog do link e no card do grupo em Meus Clientes.

## Decisões

| Tema | Decisão |
|------|---------|
| Onde aparece | Dialog do link **e** card do grupo (opção B) |
| Remarcação | Só o primeiro envio vale — depois imutável (opção A) |
| Persistência | Colunas em `nps_survey_links` (abordagem 1) |
| Data/hora | Exibir `dd/MM/yyyy HH:mm` (pt-BR) |
| Campanha | Sempre a campanha ativa (mesmo escopo do link) |

## Banco

Tabela `public.nps_survey_links` — adicionar:

| Coluna | Tipo | Notas |
|--------|------|-------|
| `sent_at` | `timestamptz` nullable | Momento do primeiro “NPS enviado” |
| `sent_by_user_id` | `uuid` nullable → `users(id)` ON DELETE SET NULL | Quem marcou |

Regras:

- Marcar só quando `sent_at IS NULL`.
- Depois: não atualizar (idempotente: devolver estado atual).
- Migration em `supabase/migrations/` + aplicar via MCP ORQESTRAI.

## API

### `POST /api/nps/links` (existente)

Resposta passa a incluir:

```ts
sent: null | { sentAt: string; sentBy: { id: string; name: string } }
```

### `POST /api/nps/links/mark-sent` (nova)

Body: `{ clientGroupId: string }`

Comportamento:

1. Auth + permissão `/meus-clientes` + grupo no escopo.
2. Resolve campanha ativa (erro se não houver).
3. Se não existir link para (campanha, grupo): cria o link (mesmo fluxo de `getOrCreateSurveyLink`) e marca.
4. Se link existir e `sent_at` null: seta `sent_at = now()`, `sent_by_user_id = usuário atual`.
5. Se já marcado: retorna o estado atual (200), sem alterar.

Resposta de sucesso:

```ts
{
  success: true;
  sent: { sentAt: string; sentBy: { id: string; name: string } };
  alreadySent: boolean;
}
```

### Lista Meus Clientes

Endpoint/carregamento da lista inclui mapa de envio da campanha ativa para os grupos visíveis:

```ts
npsSentByGroupId: Record<string, { sentAt: string; sentByName: string }>
```

(ou equivalente já alinhado ao payload atual). Sem campanha ativa → mapa vazio.

## UI

### Dialog (`NpsLinkDialog`)

- Após carregar o bundle: se `sent == null` → botão **“NPS enviado”**.
- No clique: chama `mark-sent`, loading, depois trava.
- Se `sent != null` → sem botão; texto:  
  `Enviado por: {nome} · {dd/MM/yyyy HH:mm}`

### Card do grupo

- Se enviado: badge/indicador `Enviado` junto ao botão NPS, com tooltip ou texto curto `por {nome} · {dd/MM HH:mm}`.
- Se não enviado: sem badge.
- Badge não é clicável para desmarcar.

## Permissões e erros

- Mesma regra de quem gera link NPS.
- Erros claros: sem campanha ativa, grupo fora do escopo, não autenticado.

## Fora de escopo

- Histórico de reenvios / desmarcar.
- Envio automático por WhatsApp/API.
- Marcar envio por contato individual (é por grupo/link).
- Alterar a página de resultados NPS além do necessário para tipagem.

## Testes

- Marcar com `sent_at` null → grava usuário + timestamp.
- Segunda marcação → não altera; `alreadySent: true`.
- Sem campanha ativa → 400.
- Formatação de data pt-BR no dialog/card (smoke manual ou unit do formatter se extrair helper).
