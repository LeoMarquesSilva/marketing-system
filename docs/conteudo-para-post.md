# Conteúdo para Post — como funciona hoje

Documento técnico do módulo **Conteúdo para Post** (`/conteudo/roteiros`).
Descreve o estado atual do código (agosto/2026): ingestão de notícias, geração
do carrossel por IA, fluxo de aprovação e envio ao Planner.

Módulos vizinhos (Início / Instagram, Boletim, Reels) só entram quando
cruzam com o roteiro de post.

---

## 1. O que é

O módulo transforma **notícia jurídica** em **roteiro de carrossel** para redes
sociais. Cada item persistido é um `content_roteiros`: título + link da matéria
+ texto do post (`post`) + área jurídica + status de aprovação.

Há duas origens:

| Origem | `source` | Como entra |
|--------|----------|------------|
| Pipeline RSS (cron ou botão do marketing) | `rss` | Temas em `content_topics` → Google News ou feed direto |
| Link colado pelo usuário | `manual` | `POST /api/content-roteiros/from-link` |

O texto gerado segue um template fixo de carrossel (capa + 3 slides de
desenvolvimento + slide final com CTA). Não é um post único de feed; é um
roteiro slide a slide, em markdown livre, guardado em `content_roteiros.post`.

---

## 2. Mapa do código

```
src/app/conteudo/roteiros/page.tsx          # rota da tela
src/components/conteudo/roteiros-client.tsx # UI: lista, detalhe, fluxo, Word
src/components/conteudo/manual-link-card.tsx
src/components/conteudo/roteiro-card.tsx
src/components/conteudo/roteiro-list-row.tsx

src/lib/content-roteiros.ts     # pipeline, CRUD, status, envio ao MKT
src/lib/content-manual-link.ts  # geração a partir de URL
src/lib/content-topics.ts       # CRUD de temas RSS
src/lib/content-classification.ts
src/lib/content-extraction.ts   # resolve Google News + raspa artigo/og:image
src/lib/content-rss.ts          # query Google News + recência
src/lib/content-performance.ts  # cruzamento com Instagram
src/lib/content-areas.ts        # áreas jurídicas + papéis + visibilidade
src/lib/content-access.ts       # auth + filtro de área nas APIs
src/lib/content-word.ts         # parse do carrossel + HTML .doc
src/lib/content-utils.ts        # janela de 60 dias / destaques 14 dias

src/app/api/content-roteiros/route.ts              # GET lista + PATCH ações
src/app/api/content-roteiros/fetch/route.ts        # dispara worker (gestor)
src/app/api/content-roteiros/fetch-worker/route.ts # executa o pipeline
src/app/api/content-roteiros/from-link/route.ts
src/app/api/content-roteiros/word/route.ts
src/app/api/content-roteiros/vios-tasks/route.ts
src/app/api/content-roteiros/article-preview/route.ts  # usado pelo boletim
src/app/api/content-roteiros/runs/route.ts
src/app/api/content-topics/route.ts               # GET temas ativos
src/app/api/admin/content-topics/route.ts         # CRUD admin + preview RSS
src/app/api/cron/fetch-news/route.ts              # cron diário 11:00 UTC
```

Toda escrita no banco deste módulo usa **service role**
(`getSupabaseAdmin()`). O cliente autenticado só lê (RLS) e chama as APIs.

---

## 3. Modelo de dados

### 3.1 `content_topics` — temas de busca

Configuração do que o pipeline vai procurar.

| Coluna | Tipo | Papel |
|--------|------|--------|
| `id` | uuid | PK |
| `name` | text | Nome amigável |
| `rss_query` | text | Palavras-chave Google News **ou** URL de feed direto (`https://…`) |
| `legal_area` | text | Dica de área do tema (não é a área final do post) |
| `is_active` | bool | Só temas ativos entram no cron / busca manual |
| `months_back` | int | Janela da busca (1–12, default 4) |
| `item_limit` | int | Máx. de itens RSS lidos por tema/execução (default 20) |

`rss_query` tem dois modos (`isDirectFeedUrl`):

- **Não é URL** → vira busca no Google News:
  `https://news.google.com/rss/search?hl=pt-BR&gl=BR&ceid=BR:pt-419&q=…`
  com operador de recência `when:{meses*30}d` (`buildRssQueryWithRecency`).
- **É `http(s)`** → o parser RSS lê o feed do veículo. Recência do Google
  News **não** é aplicada.

Formato típico de query de palavras-chave
(`keywordsToRssQuery`): `("termo1" OR "termo2") -"ruido1"`.

CRUD de temas: `GET/POST/PATCH/DELETE /api/admin/content-topics` (role
`admin`). A tela de roteiros só **lista** temas ativos
(`GET /api/content-topics`) para o gestor disparar busca pontual.

### 3.2 `content_roteiros` — o post

| Coluna | Papel |
|--------|--------|
| `topic_id` | Tema de origem. **Null** se `source = 'manual'` |
| `title` | Manchete (RSS ou `og:title`) |
| `link` | URL da matéria (pode ser casca do Google News) |
| `content_snippet` | Resumo do feed ou trecho raspado |
| `area` | Área jurídica **canônica do conteúdo** (ver §4) |
| `post` | Texto atual do carrossel (IA ou editado) |
| `original_post` | Primeira versão da IA, gravada na 1ª edição |
| `status` | Ver §7 |
| `published_at` | Data da notícia no feed (null no link manual) |
| `image_url` | `og:image` extraída na geração |
| `performance_hint` | Frase curta para o colaborador (Instagram) |
| `source` | `rss` \| `manual` |
| `created_by_id` / `created_by_name` | Quem colou o link (null no RSS) |
| `approved_by_*` / `approved_at` | Quem validou e mandou para revisão |
| `has_alterations` / `edited_by_*` / `edited_at` | Edição vs. texto da IA |
| `alterations_notes` / `sent_for_manager_review` | Campos legados de um modal antigo |
| `reviewer_approved_at` | Clique “Gestor aprovou” |
| `sent_to_mkt_at` / `sent_to_mkt_by_name` | Envio ao Planner |
| `marketing_request_id` | Card criado em `marketing_requests` |
| `vios_task_id` | Tarefa VIOS opcional, vinculada pelo colaborador |
| `boletim_score` (1–5) + `boletim_scored_*` | Nota do sócio no boletim (não muda o fluxo do post) |

Constraint de status:

```
aguardando_aprovacao | em_revisao | aprovado_revisor
enviado_mkt | aprovado | rejeitado
```

`aprovado` é **legado** (fluxo antigo de um clique). A UI atual não oferece
esse botão; o caminho vivo é o da §7.

### 3.3 `content_fetch_runs`

Log best-effort de cada execução do pipeline (`trigger`: `cron` | `manual`).
Lido em `GET /api/content-roteiros/runs` (só gestor). Falha no insert **não**
derruba a busca.

---

## 4. Áreas e acesso

As áreas deste módulo **não** são as áreas canônicas de Férias
(`src/lib/ferias/filters.ts`). São cinco áreas jurídicas de conteúdo:

```
Cível
Trabalhista
Reestruturação
Societário e Contratos
Operações Legais (Legal Ops)
```

Mapeamento `users.department` → áreas visíveis
(`DEPARTMENT_TO_LEGAL_AREAS` em `content-areas.ts`):

| Department | Vê |
|------------|-----|
| Cível / Trabalhista | a própria |
| Reestruturação / Insolvência | Reestruturação |
| Societário e Contratos / Contratos | Societário e Contratos |
| Operações Legais | Operações Legais (Legal Ops) |
| Marketing, Institucional, Sócio | todas |
| role `admin` ou `designer` | todas (`isContentManager`) |

Papéis:

- **Gestor** (`isContentManager`): admin, designer ou department Marketing.
  Dispara busca RSS, vê todas as áreas, filtra por tema.
- **Colaborador** (`isContentCollaborator`): department mapeado acima, e não
  é gestor. Vê a área dele **e** posts que ele mesmo criou por link (mesmo
  que a IA classifique outra área — `canSeeContentRoteiro` /
  `createdById` no GET).
- **Gerar por link** (`canCreateRoteiroFromLink`): gestor ou colaborador.

Filtro de listagem no servidor: `resolveAreaFilter` em `content-access.ts`.
Colaborador sem área pedida recebe `areas = allowed` **mais**
`createdById = profile.id`. Pedir área fora da permitida → 403.

Janela de listagem: `CONTENT_MAX_AGE_DAYS = 60` (`published_at` ou
`created_at`). Destaques “recentes” na UI: 14 dias.

---

## 5. Pipeline RSS (`runFetchPipeline`)

### 5.1 Quem dispara

| Gatilho | Rota | Auth | `maxCreated` | `trigger` |
|---------|------|------|--------------|-----------|
| Cron Vercel `0 11 * * *` | `GET /api/cron/fetch-news` | `Authorization: Bearer CRON_SECRET` | 15 | `cron` |
| Botão do marketing | `POST /api/content-roteiros/fetch` → fire-and-forget em `fetch-worker` | sessão + `isContentManager` | 8 (ou 10 se 1 tema) | `manual` |

O fetch público responde **202** e não espera o pipeline. O worker tem
`maxDuration = 300` e exige `Bearer` do `CRON_SECRET` (fallback:
`SUPABASE_SERVICE_ROLE_KEY`). Cron **espera** o pipeline (a Vercel senão
mata o job).

Env obrigatório: `NEXT_OPENAI_API_KEY`. Modelo: `gpt-4.1-mini` (Vercel AI
SDK / `@ai-sdk/openai`).

### 5.2 Passo a passo por tema

1. Carrega temas ativos (opcionalmente filtrados por `topicIds`).
2. Embaralha a ordem (Fisher–Yates) para a cota não ficar sempre no
   primeiro tema.
3. Cota por tema: `ceil(maxCreated / N temas)`, mínimo 2.
4. RSS → `filterItems`: título > 10, snippet > 20, data no intervalo
   `months_back`.
5. **Dedupe** contra roteiros dos últimos 120 dias:
   - mesmo `link`, ou
   - `normalizeTitleKey` (NFD, sem acento, corta sufixo “ - Veículo”,
     12 primeiras palavras).
   Também evita repetir na mesma execução.
6. Pré-filtros **sem IA**:
   - `shouldSkipAsIrrelevant` (polícia, crime, TCE, etc.).
   - Se o tema mapeia para Legal Ops: `isPressReleaseNoise` (captação,
     sede, nomeação, prêmio).
7. **IA classifica** (`resolveNewsArea`, temperature 0.1).
   Pode devolver `IRRELEVANTE` → skip.
   Há reconciliação com a área do tema (cluster Reestruturação /
   Societário). Depois `validateClassifiedArea` (regex de Legal Ops e
   ruído).
8. Só então raspa o artigo (`fetchArticleContent`): resolve URL do
   Google News via batchexecute, baixa HTML, extrai texto (`<article>` /
   `<p>`), `og:image` e título. Best-effort; timeout ~7s; falha segue com
   título + snippet.
9. Monta contexto de performance Instagram (opcional, §6).
10. **IA gera o carrossel** (`generateCarousel`, temperature 0.7) com
    título, snippet, texto do artigo (até 5000 chars), link, área e
    bloco de performance.
11. Insert com `status = 'aguardando_aprovacao'`. Sem `created_by_*`.

### 5.3 Extração de artigo (`content-extraction.ts`)

Links `news.google.com/articles/…` não são a matéria. O código:

1. Pede a página RSS do artigo e lê `data-n-a-ts` / `data-n-a-sg`.
2. POST em `news.google.com/_/DotsSplashUi/data/batchexecute`.
3. Extrai a primeira URL que não seja Google.

Cabeçalhos de browser (`BROWSER_HEADERS`) reduzem 403 de alguns veículos.
Paywall / bloqueio de datacenter: texto vazio, pipeline continua.

---

## 6. Inteligência de performance

`content-performance.ts` cruza posts do Instagram dos **últimos 180 dias**
com a área jurídica (via `getDepartmentsForLegalArea` +
`getPostAreas`).

Só gera contexto se houver **≥ 3** posts da área. Produz:

- `promptBlock` — injetado no prompt do carrossel (“assuntos que
  engajaram”, exemplos de legendas). Instrução: mesmo universo temático,
  abordagem nova.
- `collaboratorHint` — uma frase no card (`performance_hint`).

Se a carga do Instagram falhar, o post é gerado sem esse bloco.

---

## 7. Fluxo de status (UI atual)

Tela: detalhe do roteiro em `RoteirosClient`. Transições são PATCH em
`/api/content-roteiros`.

```
                  rejeitar
                      │
                      ▼
[aguardando_aprovacao] ──"Aprovar e enviar p/ revisão"──► [em_revisao]
                                                               │
                                              "Gestor aprovou" │
                                                               ▼
                                                      [aprovado_revisor]
                                                               │
                                         "Enviar ao marketing" │
                                                               ▼
                                                         [enviado_mkt]
                                                               │
                                                               └── card no Planner
```

| Ação na UI | Efeito no banco |
|------------|-----------------|
| Rejeitar | `status = rejeitado` |
| Aprovar e enviar p/ revisão | `em_revisao` + preenche `approved_by_*` / `approved_at` |
| Gestor aprovou | `aprovado_revisor` + `reviewer_approved_at` |
| Enviar ao marketing | `sendRoteiroToMarketing` (não é só status) |

Não há gate de papel por etapa na API: qualquer usuário autenticado que
consiga o `id` pode PATCH. A restrição real é **quem vê o card** (filtro
de área).

`ApprovalRoteiroModal` ainda existe no repo, mas **não é montado** em
nenhuma tela. Os campos `alterations_notes` e `sent_for_manager_review`
são do fluxo antigo.

### 7.1 Edição do texto

“Editar texto” → PATCH `{ action: "edit", post }`.

`saveRoteiroEdit`:

- Se `original_post` ainda é null, copia o `post` atual (versão IA).
- `has_alterations = (novo trim ≠ original trim)`.
- Grava `edited_by_*` / `edited_at`.

### 7.2 Vínculo VIOS

`GET /api/content-roteiros/vios-tasks` lista tarefas do usuário
(`pendente` / `em_andamento`). PATCH `{ action: "link_vios", vios_task_id }`.
No envio ao MKT, se houver vínculo, o card do Planner é gravado em
`vios_tasks.marketing_request_id`.

### 7.3 Envio ao marketing

`sendRoteiroToMarketing`:

1. Monta `description` = snippet + link + bloco “Texto do post (carrossel)”.
2. `requesting_area` = primeiro department da área jurídica
   (`getDepartmentsForLegalArea`; Insolvência/Contratos são filtrados).
3. Cria `marketing_requests`:
   - `request_type = "Post Redes Sociais"`
   - `workflow_stage = "tarefas"`, `status = "pending"`, `priority = "normal"`
   - `assignee` = **Valentina Iacovacci** (lookup por nome; se não achar,
     grava o nome mesmo assim)
   - prazo = **2 dias úteis às 14:00**
   - `link` = `{origin}/api/content-roteiros/word?id={uuid}`
   - `solicitante` / `created_by` / `nome_advogado` = quem clicou
4. Atualiza o roteiro: `enviado_mkt`, `marketing_request_id`, timestamps.

### 7.4 Export Word

Dois caminhos, mesmo HTML (`buildRoteiroWordHtml`):

- Cliente: blob `.doc` no browser.
- Servidor: `GET /api/content-roteiros/word?id=` (link do card no Planner).

`parseCarousel` interpreta o markdown do `post` (rótulos Título/Subtítulo/
Conteúdo, `**Slide …**`, bullets). Se o colaborador bagunçar o formato, o
Word degrada para blocos de texto.

Se houve alteração, o documento anexa a versão original da IA no rodapé.

---

## 8. Geração por link (manual)

`createRoteiroFromLink` reusa extração + classificação + carrossel, sem
tema (`topic_id = null`, `source = 'manual'`).

Validações:

- URL só `http:` / `https:` (Zod; bloqueia `javascript:` etc.).
- Página ilegível (sem título e sem texto) → 422 `ARTICLE_UNREADABLE`
  (ex.: Conjur 403 no servidor).
- Título `< 15` chars → 422 `TITLE_NOT_FOUND`.
- Mesmo link ou mesma chave de título nos últimos 120 dias → 409
  `ALREADY_EXISTS`.
- Classificador `skip` → 422 `NOT_RELEVANT`.

A área **não** recebe dica de tema: a IA classifica só pelo conteúdo.
Snippet enviado ao classificador = primeiros 600 chars do artigo.

Quem colou vê o post mesmo se a área cair fora do department
(`created_by_id` + merge na listagem).

---

## 9. Prompt do carrossel

Constante `CAROUSEL_PROMPT` em `content-roteiros.ts`. Estrutura pedida:

1. **Slide de Capa** — título + subtítulo
2. **Desenvolvimento 1** — subtópico + explicação
3. **Desenvolvimento 2** — benefícios (lista)
4. **Desenvolvimento 3** — impactos / desafios
5. **Slide Final** — conclusão + CTA (“Procure um advogado especializado”)

Regras explícitas: linguagem acessível, tom profissional, **não inventar
fatos**, **não citar o veículo**. O título raspado já tenta remover o
sufixo “ - Nome do Jornal” (`stripOutletSuffix`).

---

## 10. Classificação (IA + regex)

Prompt em `CLASSIFY_PROMPT`: uma área da lista **ou** a palavra
`IRRELEVANTE`. Temperature 0.1.

Depois da IA, código ainda:

- mapeia aliases (`Insolvência` → Reestruturação, etc.);
- descarta crime/polícia/TCE;
- para Legal Ops exige padrões positivos (legal tech, CLM, CLOC, eBilling…)
  e rejeita release corporativo.

Isso existe porque o Google News costuma ignorar exclusões `- "termo"`
quando a query tem muitos negativos.

---

## 11. APIs (contrato rápido)

### `GET /api/content-roteiros`

Query: `status`, `topic_id`, `area`. Resposta: array de roteiros da janela
de 60 dias, já filtrado por acesso.

### `PATCH /api/content-roteiros`

Corpo sempre com `id`. `action` opcional:

| `action` | Campos | Efeito |
|----------|--------|--------|
| `edit` | `post` | `saveRoteiroEdit` |
| `link_vios` | `vios_task_id` | vínculo / null |
| `boletim_score` | `score` 1–5 ou null | nota do boletim |
| `send_mkt` | — | cria card + `enviado_mkt` |
| *(sem action)* | `status` | transição + `post` opcional |

Statuses aceitos no PATCH de transição: `aguardando_aprovacao`,
`em_revisao`, `aprovado_revisor`, `aprovado`, `rejeitado`.
`enviado_mkt` **não** entra por `status`; só via `send_mkt`.

### Outras

| Método | Rota | Quem |
|--------|------|------|
| POST | `/api/content-roteiros/from-link` | gestor ou colaborador |
| POST | `/api/content-roteiros/fetch` | gestor → 202 |
| POST | `/api/content-roteiros/fetch-worker` | job interno |
| GET | `/api/content-roteiros/word?id=` | autenticado |
| GET | `/api/content-roteiros/vios-tasks` | autenticado (suas tarefas) |
| GET | `/api/content-roteiros/article-preview?id=` | autenticado; boletim raspa de novo |
| GET | `/api/content-roteiros/runs` | gestor |
| GET | `/api/cron/fetch-news` | cron |

---

## 12. Tela (`/conteudo/roteiros`)

- Colaborador abre na aba **Recentes** (14 dias), modo lista.
- Gestor vê seletor de temas e botão de busca (dispara o worker).
- Filtros: status, área (se enxerga mais de uma), tema, busca textual.
- Detalhe: resumo da notícia, dica de performance, editor do `post`,
  vínculo VIOS, ações da etapa, copiar, Word, link da matéria.
- Card “Gerar post a partir de um link” se `canCreateRoteiroFromLink`.
- Atalho para `/conteudo/reels` (outro produto: roteiro de vídeo).

Tour de onboarding (`content-tour.ts`) cobre Início → Roteiros para
colaborador que ainda não tem `users.content_tutorial_completed_at`.

---

## 13. Cruzamentos com outros módulos

| Módulo | Relação |
|--------|---------|
| **Planner** | Card `Post Redes Sociais` no envio; Word no `link` do card |
| **VIOS** | Vínculo opcional; no envio copia `marketing_request_id` na tarefa |
| **Instagram** | Performance na geração; `/conteudo/inicio` mostra posts do usuário (não é o roteiro) |
| **Boletim** | Reusa a lista de roteiros + `boletim_score` + `article-preview`. Não altera status do post |
| **Reels** | Tela irmã (`/conteudo/reels`); lê roteiros mas gera produto de vídeo à parte |

---

## 14. Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `NEXT_OPENAI_API_KEY` | Classificar + gerar carrossel |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente admin |
| `SUPABASE_SERVICE_ROLE_KEY` | Escritas + fallback do secret interno |
| `CRON_SECRET` | Cron e worker |
| `VERCEL_URL` | Origem do fire-and-forget do worker |

---

## 15. Limites e comportamento conhecido

- Pipeline é **best-effort**: um tema/item que falha não aborta o resto.
  Erros vão para `content_fetch_runs.errors` (máx. 20 no log).
- Dedupe por título é agressivo: manchetes parecidas na mesma janela de
  120 dias são puladas.
- Veículos que bloqueiam datacenter geram post só com snippet (RSS) ou
  falham no link manual.
- `maxCreated` do cron (15) + cota por tema: um dia típico não esgota
  todos os feeds.
- Designer padrão do card está **hardcoded** (“Valentina Iacovacci”).
- Status `aprovado` e o modal `ApprovalRoteiroModal` são residual do
  fluxo de 1 etapa; a UI viva é a de 3 etapas + envio.
- Áreas de conteúdo ≠ áreas canônicas de Férias. Distressed Deals só
  existe como cor/estilo para posts antigos.

---

## 16. Fluxo mental (uma frase)

Tema RSS ou link → (filtro + IA classifica área) → raspa matéria → IA
escreve carrossel (com dica de Instagram) → colaborador valida → marca
que o gestor aprovou → envia ao marketing (card no Planner + Word).
