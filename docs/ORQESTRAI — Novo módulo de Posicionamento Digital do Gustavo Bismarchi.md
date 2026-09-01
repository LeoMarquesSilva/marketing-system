# ORQESTRAI — Novo módulo de Posicionamento Digital do Gustavo Bismarchi

Quero que você implemente no ORQESTRAI um novo módulo exclusivo para planejamento, geração, validação e gestão dos conteúdos pessoais de **Gustavo Bismarchi**, voltados inicialmente para **LinkedIn e Instagram**.

Este módulo NÃO deve substituir, modificar conceitualmente ou misturar seu fluxo com o módulo institucional já existente em:

`/conteudo/roteiros`

Antes de alterar qualquer código, leia e entenda completamente a implementação atual do módulo de Conteúdo para Post e todos os arquivos relacionados.

O sistema atual já possui uma infraestrutura funcional de:

- RSS;
- Google News;
- feeds diretos;
- extração de artigos;
- resolução de URLs do Google News;
- deduplicação;
- OpenAI via Vercel AI SDK;
- classificação de notícias;
- geração de conteúdo;
- Supabase;
- autenticação;
- service role;
- Planner;
- criação de `marketing_requests`;
- logs de execução;
- geração manual por URL.

Quero REUTILIZAR essas capacidades sempre que tecnicamente fizer sentido.

Não quero, porém, que o novo módulo utilize `content_roteiros` como sua tabela principal ou tente adaptar o fluxo institucional existente por meio de inúmeros `if`s.

O módulo do Gustavo deve possuir domínio, tabelas, regras editoriais, permissões e pipeline próprios.

---

# 1. PRIMEIRO: ANALISE O PROJETO

Antes de escrever código:

1. Leia integralmente:

```text
src/app/conteudo/roteiros/page.tsx
src/components/conteudo/roteiros-client.tsx
src/components/conteudo/manual-link-card.tsx
src/components/conteudo/roteiro-card.tsx
src/components/conteudo/roteiro-list-row.tsx

src/lib/content-roteiros.ts
src/lib/content-manual-link.ts
src/lib/content-topics.ts
src/lib/content-classification.ts
src/lib/content-extraction.ts
src/lib/content-rss.ts
src/lib/content-performance.ts
src/lib/content-areas.ts
src/lib/content-access.ts
src/lib/content-word.ts
src/lib/content-utils.ts

src/app/api/content-roteiros/route.ts
src/app/api/content-roteiros/fetch/route.ts
src/app/api/content-roteiros/fetch-worker/route.ts
src/app/api/content-roteiros/from-link/route.ts
src/app/api/content-roteiros/runs/route.ts
src/app/api/content-topics/route.ts
src/app/api/admin/content-topics/route.ts
src/app/api/cron/fetch-news/route.ts
```

2. Analise também:

- estrutura do menu/sidebar do ORQESTRAI;
- sistema de autenticação;
- tabela `users`;
- identificação atual de `role = admin`;
- helpers de Supabase server/client;
- estrutura e constraints de `marketing_requests`;
- possíveis enums ou validações de `request_type`;
- sistema de migrations do projeto;
- padrão de componentes/UI já utilizado;
- `vercel.json` e cron jobs existentes;
- versão atual do Vercel AI SDK e OpenAI SDK.

3. NÃO suponha nomes de campos que não existam.

4. NÃO crie um segundo helper se já houver um helper genérico que possa ser reutilizado.

5. Não faça refatorações grandes e desconectadas do objetivo desta feature.

Depois da análise, implemente seguindo os requisitos abaixo.

---

# 2. OBJETIVO DO PRODUTO

Este módulo não é simplesmente um “gerador de posts”.

Ele deve funcionar como um:

# SISTEMA DE POSICIONAMENTO E THOUGHT LEADERSHIP

do Gustavo Bismarchi.

Objetivo estratégico:

Posicionar Gustavo como uma autoridade em:

- Reestruturação Empresarial;
- Recuperação Judicial;
- Recuperação Extrajudicial;
- Distressed Assets;
- Special Situations;
- crise de liquidez;
- dívida corporativa;
- negociação com credores;
- governança em situações de crise;
- continuidade empresarial;
- preservação de valor.

ICP prioritário:

- empresários;
- sócios;
- fundadores;
- CEOs;
- CFOs;
- conselheiros;
- executivos;
- investidores;
- decisores de empresas com faturamento a partir de aproximadamente R$ 5 milhões.

A lógica editorial deve ser:

> Gustavo não explica simplesmente recuperação judicial. Gustavo explica o que crises e reestruturações revelam sobre empresas.

Portanto:

# A NOTÍCIA É MATÉRIA-PRIMA, NÃO O CONTEÚDO FINAL.

O sistema deve transformar:

```text
Notícia
↓
Fato
↓
Problema empresarial
↓
Tese / interpretação
↓
Implicação para empresário
↓
Conteúdo
```

E NÃO:

```text
Notícia
↓
Resumo da notícia
↓
Post
```

---

# 3. ACESSO AO MÓDULO

Este módulo é CONFIDENCIAL/RESTRITO.

Somente podem acessar:

1. usuários com `role = admin`;
2. a conta do Gustavo Bismarchi.

NÃO utilizar:

- department;
- designer;
- Marketing;
- Sócio;
- permissões do módulo `/conteudo/roteiros`;

como autorização automática.

Ser do Marketing NÃO concede acesso.

Ser designer NÃO concede acesso.

Ser sócio NÃO concede acesso.

## Implementação de acesso

Prefiro uma solução explícita e robusta.

Criar uma pequena estrutura de membership específica, por exemplo:

```text
gustavo_content_members
```

com:

```text
user_id
member_role
created_at
```

Gustavo será cadastrado como:

```text
member_role = owner
```

Admins continuam tendo bypass via `role = admin`.

Não faça autorização baseada em comparação de nome em runtime.

Durante a migration/seed:

- procure a conta real existente de Gustavo no banco;
- use seu `users.id` como referência estável;
- se não for possível identificar inequivocamente a conta, NÃO escolha outra;
- deixe instrução explícita de como adicionar o `user_id` correto.

Criar helper central como:

```ts
canAccessGustavoContent(profile)
```

ou nomenclatura equivalente.

A proteção deve existir:

- no frontend;
- na page server;
- nas APIs;
- nas queries;
- nas mutations.

Não repetir a fragilidade existente no PATCH de `content_roteiros`, onde visibilidade é a principal barreira.

A autorização deste novo módulo deve ser VALIDADA NO SERVIDOR em toda ação.

---

# 4. NOME E ROTA

Criar o módulo dentro da área Conteúdo.

Sugestão de item no menu:

# Posicionamento Gustavo

Rota:

```text
/conteudo/gustavo
```

Caso a arquitetura atual sugira nomenclatura melhor, pode adequar, mas mantenha o conceito.

O item do menu só deve aparecer para:

- admin;
- membro autorizado na `gustavo_content_members`.

Não mostrar item bloqueado para os demais usuários.

---

# 5. PRINCÍPIO DE ARQUITETURA

Quero:

```text
INFRAESTRUTURA COMPARTILHADA
+
DOMÍNIO EDITORIAL ISOLADO
```

Exemplos do que podemos reaproveitar:

```text
content-extraction.ts
content-rss.ts
resolução Google News
BROWSER_HEADERS
normalizeTitleKey
helpers genéricos de datas
Supabase server/admin
marketing_requests
OpenAI/Vercel AI SDK
```

Se alguma função atualmente estiver presa demais a `content_roteiros`, extraia SOMENTE a parte genérica necessária para um helper reutilizável.

Não duplicar 200 linhas apenas para trocar nomes.

Por outro lado:

NÃO faça o novo fluxo escrever em `content_roteiros`.

---

# 6. MODELO MENTAL DO NOVO MÓDULO

O novo fluxo será:

```text
RSS / Link / Ideia própria / Tese
        ↓
Extração
        ↓
Filtro básico
        ↓
Score editorial
        ↓
Problema empresarial
        ↓
3 possíveis ângulos
        ↓
Busca na Biblioteca de Teses
        ↓
Busca no Histórico Editorial
        ↓
Validação de opinião
        ↓
Escolha do ângulo
        ↓
LinkedIn
+
Roteiro de Reel
        ↓
Revisão
        ↓
Aprovação do Gustavo
        ↓
Planner / produção
        ↓
Publicado
        ↓
Histórico + aprendizado
```

---

# 7. AS TRÊS MEMÓRIAS DO SISTEMA

O diferencial deste módulo serão três bases permanentes.

---

## 7.1 BASE 1 — VOZ DO GUSTAVO

Criar tabela como:

```text
gustavo_content_voice_samples
```

Ela armazenará exemplos REAIS de textos do Gustavo.

Campos sugeridos:

```text
id uuid PK
source_type text
source_url text null
published_at timestamptz null

original_text text NOT NULL

content_type text
tone text null

analysis jsonb null
performance jsonb null

authenticity text
is_active boolean default true

created_by uuid
created_at timestamptz
updated_at timestamptz
```

`source_type`:

```text
linkedin
manual
transcript
other
```

`authenticity`:

```text
gustavo_original
marketing_revised
ai_assisted
unknown
```

Objetivo:

a IA utilizar exemplos realmente escritos/aprovados pelo Gustavo para entender:

- tamanho dos parágrafos;
- nível técnico;
- primeira pessoa;
- formalidade;
- construções naturais;
- vocabulário;
- maneira de introduzir assuntos;
- maneira de concluir;
- quanto ele contextualiza;
- quanto ele explica.

IMPORTANTE:

Não automatizar scraping do LinkedIn.

O cadastro inicial pode ser manual:

```text
URL opcional
+
texto do post
+
data
+
tipo
+
autenticidade
```

Criar interface simples para cadastrar, editar, ativar/desativar e excluir amostras.

Posteriormente poderemos importar dados em lote, mas não é requisito agora.

---

# 7.2 BASE 2 — BIBLIOTECA DE TESES

Criar:

```text
gustavo_content_theses
```

Campos sugeridos:

```text
id uuid PK

title text NOT NULL
thesis text NOT NULL
explanation text null
business_importance text null
counterpoint text null

applications text[] default '{}'
tags text[] default '{}'

conviction text
status text

gustavo_phrases text[] default '{}'

usage_count int default 0
last_used_at timestamptz null

created_by uuid
updated_by uuid null

created_at timestamptz
updated_at timestamptz
```

`status`:

```text
validated
pending
disabled
```

`conviction`:

```text
strong
contextual
discussion
```

Exemplo:

Título:

```text
O processo não cria viabilidade
```

Tese:

```text
Uma recuperação judicial pode criar proteção e tempo, mas não transforma uma empresa economicamente inviável em uma empresa viável.
```

Aplicações:

```text
stay period
recuperação judicial
liquidez
capital de giro
reestruturação
```

Contraponto:

```text
Nem toda crise de caixa significa inviabilidade econômica.
```

Frase do Gustavo:

```text
O processo compra tempo. Não compra uma reestruturação.
```

---

# 7.3 BASE 3 — HISTÓRICO EDITORIAL

Não criar obrigatoriamente uma tabela separada se o histórico puder ser extraído adequadamente da própria tabela de conteúdos.

Mas o sistema PRECISA conseguir responder:

```text
Gustavo já falou desse assunto?

Falou dessa empresa?

Qual tese usou?

Qual foi o ângulo?

Quando?

Em qual canal?

Qual foi a performance?

Estamos repetindo a mesma visão?
```

Esse histórico deverá participar do prompt de geração.

---

# 8. TABELA PRINCIPAL DE CONTEÚDO

Criar tabela dedicada como:

```text
gustavo_content_items
```

Ela será o coração do módulo.

Sugestão de campos:

```text
id uuid PK

source text NOT NULL
topic_id uuid null

title text
link text null
content_snippet text null
published_at timestamptz null
image_url text null

source_context jsonb null

editorial_score int null
score_breakdown jsonb null
score_reason text null

business_problem text null

angles jsonb null
selected_angle jsonb null

thesis_id uuid null
thesis_snapshot text null

opinion_status text
gustavo_questions jsonb null
gustavo_answers jsonb null

recommended_channels jsonb null

linkedin_post text null
original_linkedin_post text null

reel_script text null
original_reel_script text null

alternative_hooks jsonb null

compliance_flags jsonb null
factual_flags jsonb null

status text NOT NULL

rejection_reason text null

has_alterations boolean default false

created_by uuid null
created_by_name text null

edited_by uuid null
edited_by_name text null
edited_at timestamptz null

submitted_to_gustavo_at timestamptz null

approved_by uuid null
approved_at timestamptz null

marketing_request_linkedin_id uuid null
marketing_request_reel_id uuid null

linkedin_published_url text null
instagram_published_url text null

linkedin_published_at timestamptz null
instagram_published_at timestamptz null

created_at timestamptz
updated_at timestamptz
```

Adapte nomes aos padrões existentes do projeto.

Não utilize PostgreSQL enum se o projeto normalmente trabalha com `text + check constraint`.

---

# 9. ORIGENS DE PAUTA

`source` deve aceitar no mínimo:

```text
rss
manual_link
manual_idea
thesis
```

---

# 10. RSS ESPECÍFICO DO GUSTAVO

NÃO utilizar diretamente `content_topics`.

Criar:

```text
gustavo_content_topics
```

Porque a lógica editorial e as palavras-chave serão diferentes das áreas jurídicas do escritório.

Campos semelhantes ao modelo existente:

```text
id
name
rss_query
is_active
months_back
item_limit
priority
created_at
updated_at
```

Reutilizar:

- Google News RSS;
- feed direto;
- `keywordsToRssQuery`;
- recência;
- extração;
- resolução da URL Google News.

## Temas iniciais

Criar seeds/configuração inicial com grupos como:

### Recuperação empresarial

```text
"recuperação judicial"
"recuperação extrajudicial"
"reestruturação empresarial"
"reestruturação de dívida"
```

### Dívida e liquidez

```text
"dívida corporativa"
"renegociação de dívida"
"crise de liquidez"
"capital de giro"
"default empresa"
"covenant dívida"
```

### Distressed / Special Situations

```text
"distressed assets"
"special situations"
"ativos estressados"
"venda de ativos recuperação judicial"
```

### Instrumentos

```text
"DIP financing"
"financiamento DIP"
"stay period"
"UPI recuperação judicial"
"unidade produtiva isolada"
```

### Casos internacionais

```text
"Chapter 11" empresa Brasil
"Chapter 11" Brazilian company
```

### Crédito e ambiente empresarial

```text
crédito empresas juros dívida
empresas inadimplência corporativa
endividamento empresas Brasil
```

Não transforme essa lista em dezenas de temas desnecessários.

Comece enxuto.

A administração dos temas deve existir dentro do próprio módulo, somente para admin.

---

# 11. NÃO RESTRINGIR O RADAR A “NOTÍCIA JURÍDICA”

Isto é MUITO IMPORTANTE.

O atual `/conteudo/roteiros` procura notícia jurídica.

O módulo Gustavo precisa procurar também notícia:

- econômica;
- empresarial;
- financeira;
- de crédito;
- M&A;
- dívida;
- gestão;
- governança;

quando houver relação clara com reestruturação.

Exemplo:

Uma empresa que:

```text
vende ativos
renegocia dívida
recebe waiver
troca controle
precisa de capital
fecha unidade
sofre downgrade
negocia com bancos
busca financiamento
vende participação
entra em default
```

pode ser pauta relevante MESMO SEM conter “recuperação judicial”.

---

# 12. DEDUPLICAÇÃO

Reutilizar a inteligência existente.

Comparar:

- link;
- título normalizado;
- empresa/tema quando possível.

Janela sugerida:

```text
120 dias
```

Mas há uma diferença:

Não rejeitar automaticamente toda notícia sobre a mesma empresa.

Exemplo:

```text
GPA anuncia reestruturação
↓
60 dias depois
GPA consegue adesão de novos credores
```

são acontecimentos diferentes.

A deduplicação deve tentar identificar:

```text
mesmo fato
```

e não apenas:

```text
mesma empresa
```

---

# 13. SCORE EDITORIAL

Toda pauta deve receber nota de 0 a 100 ANTES de gerar conteúdo.

Score:

```text
Relevância para ICP ................. 25
Potencial de tese ................... 20
Impacto empresarial ................. 15
Aderência às teses do Gustavo ....... 10
Atualidade .......................... 10
Diferenciação ....................... 10
Qualidade das fontes ................ 10
```

Total:

```text
100
```

## Faixas

```text
70–100
→ Sugestão forte de conteúdo

55–69
→ Radar / acompanhar

0–54
→ Descartar automaticamente
```

Não precisamos persistir itens abaixo de 55, exceto estatística no log da execução.

O resultado da IA deve ser ESTRUTURADO.

Preferir `generateObject`, output schema com Zod ou o equivalente disponível na versão atual do AI SDK.

NÃO analisar o score por parsing frágil de texto livre.

Exemplo:

```ts
{
  total: 84,
  breakdown: {
    icpRelevance: 23,
    thesisPotential: 17,
    businessImpact: 14,
    thesisFit: 8,
    freshness: 9,
    differentiation: 7,
    sourceQuality: 6
  },
  reason: "...",
  businessProblem: "...",
  shouldPersist: true
}
```

---

# 14. PROBLEMA EMPRESARIAL

A IA deve obrigatoriamente responder:

```text
Qual é o problema empresarial por trás dessa notícia?
```

Exemplos:

Não:

```text
Pedido de recuperação judicial.
```

Mas:

```text
A empresa perdeu capacidade de refinanciar sua estrutura de dívida no ritmo necessário.
```

Não:

```text
Credores aprovaram o plano.
```

Mas:

```text
A negociação prévia construiu apoio suficiente para reduzir o risco de uma disputa mais destrutiva.
```

Esse campo será exibido com destaque na UI.

---

# 15. GERAÇÃO DE 3 ÂNGULOS

Para pauta >= 70:

gerar três ângulos.

Obrigatoriamente:

### 1. Diagnóstico / sinal

O que esta notícia revela?

### 2. Decisão / estratégia

Que decisão empresarial está por trás?

### 3. Tese / contraponto

Qual leitura menos óbvia pode ser feita?

Estrutura:

```ts
[
  {
    type: "diagnosis",
    title: "...",
    thesis: "...",
    whyItMatters: "..."
  },
  {
    type: "strategy",
    ...
  },
  {
    type: "opinion",
    ...
  }
]
```

A interface deve exibir os três em cards.

Admin/Gustavo escolhem o ângulo desejado.

---

# 16. CRUZAMENTO COM BIBLIOTECA DE TESES

Depois dos ângulos:

comparar a pauta com as teses ativas.

A IA NÃO pode inventar uma opinião do Gustavo.

Se encontrar tese validada:

```text
opinion_status = validated
```

e vincular:

```text
thesis_id
```

Guardar também um snapshot da tese no conteúdo para preservar histórico mesmo se a tese for editada posteriormente.

Se NÃO existir tese suficiente:

```text
opinion_status = needs_gustavo
```

O sistema deve gerar até 3 perguntas MUITO OBJETIVAS.

Exemplo:

```text
1. Para você, qual é o principal risco dessa decisão?
2. Essa empresa agiu cedo ou tarde?
3. O que você acredita que outros empresários podem aprender com o caso?
```

NÃO gerar o post em primeira pessoa fingindo saber a resposta.

---

# 17. MODO “AGUARDANDO GUSTAVO”

Quando faltar opinião:

o item entra em:

```text
aguardando_opiniao
```

Na tela do Gustavo mostrar:

# Precisamos da sua visão

E abaixo as perguntas.

Pode ser:

- textarea por pergunta;
- respostas curtas;
- autosave opcional se já existir padrão no sistema.

Botão:

# Usar minhas respostas

Ao clicar:

- salvar `gustavo_answers`;
- enviar respostas + notícia + tese/contexto novamente à IA;
- gerar conteúdo;
- mudar para `rascunho`.

---

# 18. HISTÓRICO EDITORIAL ANTES DA GERAÇÃO

Antes de escrever:

consultar os conteúdos anteriores, principalmente últimos:

```text
180 dias
```

Analisar:

- assunto;
- empresa;
- tese;
- ângulo;
- hooks;
- canal.

Retornar algo como:

```ts
{
  similarityRisk: "low" | "medium" | "high",
  similarItems: [...],
  reason: "..."
}
```

Se `high`:

a IA deve obrigatoriamente buscar outro ângulo.

Na UI:

```text
Você já falou sobre este tema há 32 dias.
Ângulo anterior: timing da negociação.
Novo ângulo sugerido: estrutura de garantias.
```

---

# 19. GERAÇÃO DO LINKEDIN

O LinkedIn é o principal canal de autoridade.

Não gerar carrossel automaticamente.

O output principal deve ser:

# POST TEXTUAL DE LINKEDIN

Estrutura preferencial:

```text
Gancho
↓
Contexto curto
↓
Leitura do Gustavo
↓
Implicação empresarial
↓
Conclusão
```

Não precisa obedecer exatamente isso em todos os posts.

Evitar formato robótico.

## Voz

- primeira pessoa quando houver opinião validada;
- técnica;
- executiva;
- natural;
- segura;
- didática;
- sem ser professoral;
- sem parecer copywriter;
- sem parecer IA;
- sem sensacionalismo;
- sem juridiquês desnecessário.

## Regra importantíssima

O jurídico SUSTENTA a análise.

Não precisa ser sempre o centro.

Começar preferencialmente por:

- decisão;
- tensão;
- consequência;
- contraste;
- leitura.

e só depois entrar em Lei, artigo, quórum ou procedimento.

## Evitar

```text
Você sabia?
Em um cenário cada vez mais...
No mundo empresarial atual...
Arraste para o lado.
Salve este post.
Comente o que acha.
Procure um advogado especializado.
Fale comigo.
Entre em contato.
```

Não terminar automaticamente com pergunta.

Não usar emojis por padrão.

Hashtags:

```text
0 a 3
```

e somente quando fizer sentido.

---

# 20. EXEMPLO DA MUDANÇA DE RACIOCÍNIO

Ruim:

```text
A recuperação extrajudicial do GPA contou com adesão de 46,26% dos créditos.

Segundo a Lei 11.101...
```

Direção desejada:

```text
O GPA não esperou convencer todos os credores para começar sua recuperação extrajudicial.

E talvez esse seja o ponto mais interessante do caso.

Quando protocolou o pedido, uma parcela relevante dos créditos já havia aderido à proposta.

A discussão jurídica sobre quórum é importante.

Mas, para quem administra uma empresa em crise, existe uma lição anterior a ela:

a reestruturação não começa no protocolo.

Ela começa na capacidade de criar negociação antes que todas as opções desapareçam.
```

Não copie esse texto nos conteúdos.

É apenas exemplo de raciocínio.

---

# 21. REEL PARA INSTAGRAM

A mesma pauta pode gerar roteiro de Reel.

O Reel deve parecer:

```text
Gustavo acabou de analisar algo relevante
e decidiu explicar o ponto principal.
```

Não:

```text
influenciador jurídico lendo teleprompter.
```

Duração preferencial:

```text
45–75 segundos
```

Formato:

```text
1. Gancho falado
2. Contexto
3. Ponto principal
4. O que isso significa para o empresário
5. Fecho
```

Gerar o roteiro como BULLETS de fala.

Não escrever redação enorme para decorar.

Exemplo de objeto:

```ts
{
  duration: "60s",
  hook: "...",
  talkingPoints: [
    "...",
    "...",
    "..."
  ],
  closing: "...",
  recordingNote: "..."
}
```

---

# 22. RECOMENDAÇÃO DE CANAL

Nem toda pauta precisa virar LinkedIn E Instagram.

A análise editorial deve retornar:

```ts
recommendedChannels: {
  linkedin: {
    recommended: true,
    reason: "..."
  },
  instagramReel: {
    recommended: false,
    reason: "..."
  }
}
```

Exemplo:

Decisão muito técnica:

```text
LinkedIn: SIM
Reel: talvez não
```

Movimento grande de empresa conhecida:

```text
LinkedIn: SIM
Reel: SIM
```

---

# 23. PAUTA MANUAL

No topo do módulo criar:

# Nova pauta

Com pelo menos dois modos.

### Link

Reutilizar lógica de:

```text
createRoteiroFromLink
fetchArticleContent
```

mas encaminhar ao pipeline do Gustavo.

### Ideia própria

Textarea:

```text
Sobre o que você quer falar?
```

Exemplo:

```text
Quero falar sobre empresas que esperam o banco executar todas as garantias antes de começar uma reestruturação.
```

O sistema:

- procura teses relacionadas;
- procura histórico;
- sugere 3 ângulos;
- permite gerar LinkedIn/Reel.

Assim o sistema NÃO fica 100% dependente de RSS.

---

# 24. GERAR PAUTA A PARTIR DE UMA TESE

Na Biblioteca de Teses:

botão:

# Criar conteúdo com esta tese

Ao clicar:

o sistema pode sugerir:

- conteúdo evergreen;
- possíveis hooks;
- LinkedIn;
- Reel.

Sem exigir notícia.

Isso é importante para o calendário editorial.

---

# 25. STATUS

Criar fluxo próprio.

Sugestão:

```text
radar
sugestao
aguardando_opiniao
rascunho
aguardando_aprovacao
aprovado
enviado_mkt
publicado
rejeitado
arquivado
```

Fluxo normal:

```text
RSS
↓
score 55–69
radar

RSS
↓
score >=70
sugestao
↓
selecionar
↓
se faltar tese
aguardando_opiniao
↓
resposta Gustavo
↓
rascunho

OU

sugestao
↓
tese validada
↓
rascunho

rascunho
↓
Enviar para Gustavo
↓
aguardando_aprovacao
↓
Aprovar
↓
aprovado
↓
Enviar ao Planner
↓
enviado_mkt
↓
Marcar como publicado
↓
publicado
```

Rejeitar pode acontecer em vários pontos.

Guardar motivo de rejeição opcional.

---

# 26. QUEM PODE FAZER O QUÊ

## Admin

Pode:

- configurar RSS;
- criar pauta;
- criar/editar teses;
- criar/editar voz;
- analisar;
- selecionar ângulo;
- editar post;
- editar Reel;
- enviar para aprovação;
- rejeitar;
- enviar ao Marketing;
- marcar publicação;
- consultar histórico.

## Gustavo

Pode:

- visualizar radar;
- visualizar conteúdo;
- responder perguntas;
- escolher ângulo;
- editar;
- aprovar;
- rejeitar;
- consultar Biblioteca de Teses;
- editar/adicionar tese se for simples de implementar;
- consultar histórico.

Final approval deve registrar:

```text
approved_by
approved_at
```

Quando o Gustavo autenticado aprovar, isso deve ficar auditável.

Admin NÃO deve silenciosamente parecer Gustavo no histórico.

Caso seja necessário permitir aprovação administrativa excepcional:

registrar explicitamente como aprovação administrativa, nunca como clique do Gustavo.

---

# 27. UI — ESTRUTURA PRINCIPAL

Quero uma experiência MUITO mais editorial do que o módulo de carrosséis atual.

Não quero copiar visualmente `/conteudo/roteiros` e apenas trocar textos.

Manter:

- design system;
- cores;
- radius;
- tipografia;
- spacing;
- componentes base do ORQESTRAI.

Mas criar experiência apropriada.

Sugestão de subnavegação:

```text
Visão geral
Radar
Produção
Teses
Voz
Histórico
```

---

# 28. VISÃO GERAL

Dashboard compacto.

Cards:

```text
Conteúdos esta semana
LinkedIn: 0 / 2
Reels: 0 / 1

Sugestões fortes
5

Aguardando Gustavo
2

Aprovados
3
```

Mostrar também:

# Melhores oportunidades agora

3–5 cards de pauta com score alto.

Cada card:

```text
Título
Fonte/data
Score
Problema empresarial
Tese encontrada
Canal recomendado
```

CTA:

```text
Analisar pauta
```

---

# 29. RADAR

Lista/cards das notícias.

Filtros:

```text
Score
Tema RSS
Data
Status
Canal recomendado
Com tese / sem tese
```

Cada item mostrar:

- título;
- data;
- score;
- motivo curto;
- problema empresarial;
- tese compatível;
- canais recomendados.

Destacar visualmente score:

```text
90+
excelente

80–89
muito forte

70–79
boa oportunidade

55–69
radar
```

Não precisa usar essas palavras exatamente, mas a hierarquia deve ser clara.

---

# 30. TELA DE DETALHE DA PAUTA

Essa será a tela mais importante.

Sugestão desktop:

## COLUNA ESQUERDA

### Fonte

- título;
- link;
- data;
- resumo;
- imagem;
- abrir matéria.

### Score

Exibir 7 critérios e nota total.

### Problema empresarial

Destacado.

### Histórico

Se houver conteúdo parecido:

mostrar alerta.

---

## COLUNA DIREITA

### 3 ângulos

Cards selecionáveis.

### Tese

Mostrar:

```text
Tese encontrada
Status: validada
```

ou:

```text
Ainda não temos uma opinião registrada.
```

### Perguntas para Gustavo

quando necessário.

### Conteúdo

Tabs:

```text
LinkedIn
Instagram Reel
```

Editor de texto.

Hooks alternativos.

Alertas OAB/factualidade.

---

# 31. BIBLIOTECA DE TESES — UI

Página pesquisável.

Card:

```text
Título
Tese
Tags
Convicção
Status
Último uso
Nº de conteúdos
```

Filtros:

```text
Validada
Pendente
Desativada
Tags
```

Detalhe permite:

- editar;
- validar;
- desativar;
- criar conteúdo;
- visualizar onde foi utilizada.

---

# 32. VOZ — UI

Página simples.

Lista das amostras reais.

Mostrar:

```text
Tipo
Data
Autenticidade
Trecho
```

Detalhe:

texto completo.

Pode conter uma pequena análise produzida pela IA:

```text
Características observadas
- abertura direta
- parágrafos curtos
- primeira pessoa moderada
- ...
```

Mas o TEXTO ORIGINAL é a fonte principal.

---

# 33. HISTÓRICO

Mostrar todos os conteúdos:

```text
Publicado
Enviado
Aprovado
Rejeitado
Arquivado
```

Filtros:

```text
Canal
Tese
Empresa/assunto
Data
```

Mostrar:

- título/pauta;
- tese;
- ângulo;
- post;
- roteiro;
- URLs publicadas;
- datas;
- performance se preenchida.

---

# 34. PERFORMANCE

Nesta primeira versão NÃO quero integração complexa com LinkedIn API ou Instagram API.

Evitar escopo desnecessário.

Criar apenas estrutura suficiente para:

- URL publicada;
- data;
- opcionalmente métricas manuais no futuro.

Se `performance jsonb` fizer sentido no modelo, pode existir.

Mas não construir dashboard sofisticado de analytics nesta etapa.

---

# 35. INTEGRAÇÃO COM PLANNER

Aproveitar `marketing_requests`.

NÃO copiar cegamente o hardcode:

```text
Valentina Iacovacci
```

do fluxo atual.

Primeiro analise como o Planner e Marketing resolvem responsáveis.

Se existir uma configuração central, use.

Se não existir, centralize a configuração do módulo em UMA constante/helper, em vez de espalhar nome hardcoded.

## LinkedIn e Reel são entregas diferentes

Depois de aprovado, permitir:

```text
Criar tarefa LinkedIn
Criar tarefa Reel
```

Não criar automaticamente os dois se o canal não for recomendado/selecionado.

### LinkedIn

Descrição da task deve conter:

```text
PAUTA
LINK DA FONTE
TESE
POST FINAL
OBSERVAÇÕES
```

### Reel

Descrição:

```text
PAUTA
LINK
GANCHO
PONTOS DE FALA
FECHO
OBSERVAÇÃO DE GRAVAÇÃO
```

Não inventar novos `request_type` sem antes verificar as constraints reais de `marketing_requests`.

Se `Post Redes Sociais` for o tipo compatível existente, reutilizá-lo e distinguir por título/description.

Se existir tipo apropriado para Reel, utilizar.

A task deve guardar vínculo de volta no `gustavo_content_items`.

Evitar duplicar task se o botão for clicado duas vezes.

---

# 36. NÃO USAR WORD COMO DEPENDÊNCIA DO NOVO FLUXO

O Word existe no módulo institucional porque o roteiro de carrossel é enviado dessa forma.

Para o módulo do Gustavo não é obrigatório.

O texto completo pode seguir na `description` do Planner.

Não criar export `.doc` apenas por copiar arquitetura antiga.

Se houver benefício claro e implementação simples, pode oferecer “Copiar conteúdo”, mas Word não é requisito.

---

# 37. INTELIGÊNCIA DE IA — ARQUITETURA

Não quero um PROMPT GIGANTE fazendo tudo em uma chamada.

Separar no mínimo em:

```text
1. análise / score
2. ângulos + tese
3. geração editorial
```

Se fizer sentido:

```text
4. compliance/factualidade
```

Cada etapa deve possuir responsabilidade clara.

Usar output estruturado sempre que adequado.

---

# 38. MODELOS

O módulo atual utiliza:

```text
NEXT_OPENAI_API_KEY
gpt-4.1-mini
```

Não espalhar modelo hardcoded pelo novo módulo.

Criar configuração central, por exemplo:

```ts
const GUSTAVO_CONTENT_MODEL =
  process.env.GUSTAVO_CONTENT_MODEL ?? "gpt-4.1-mini"
```

ou equivalente consistente com o projeto.

Classificação/score:

```text
temperature baixa
```

Redação:

```text
temperature moderada
```

Não alterar modelo do módulo institucional.

---

# 39. SYSTEM PROMPT — EDITOR DO GUSTAVO

Utilizar esta lógica como base:

```text
Você é o editor estratégico do posicionamento de Gustavo Bismarchi em reestruturação empresarial.

MISSÃO

Transformar fatos públicos, notícias, dados, acontecimentos empresariais e teses em conteúdo de thought leadership voltado a empresários, sócios, CEOs, CFOs, conselheiros e decisores de empresas relevantes.

POSICIONAMENTO

Gustavo Bismarchi deve ser percebido como uma fonte confiável de interpretação sobre empresas em crise.

Ele não é um perfil de notícias jurídicas.

Ele analisa:

crise empresarial,
liquidez,
dívida,
credores,
negociação,
governança,
recuperação judicial,
recuperação extrajudicial,
distressed assets,
preservação de valor
e continuidade empresarial.

REGRA CENTRAL

A notícia é somente o gatilho.

Nunca produza um conteúdo cujo principal valor seja resumir uma matéria.

Procure:

- a decisão;
- o sinal;
- a tensão;
- o erro;
- o trade-off;
- a consequência;
- a tese;
- ou a lição empresarial por trás do fato.

AUDIÊNCIA

Escreva prioritariamente para:

empresários,
CEOs,
CFOs,
sócios,
conselheiros,
investidores
e executivos.

Não escreva prioritariamente para outros advogados.

O conhecimento jurídico deve aparecer quando necessário para sustentar a análise.

VOZ

A voz deve ser:

sóbria,
executiva,
segura,
técnica,
natural,
didática,
direta.

Evite:

sensacionalismo,
juridiquês desnecessário,
tom professoral,
copywriting agressivo,
frases genéricas de inteligência artificial.

AUTORIA

Nunca invente uma opinião de Gustavo.

Utilize somente opiniões existentes na BIBLIOTECA_DE_TESES ou respostas fornecidas diretamente por ele.

Se for necessário um posicionamento que ainda não existe:

NÃO ESCREVA COMO SE SOUBESSE.

Retorne:

[VALIDAR COM GUSTAVO]

e formule no máximo 3 perguntas objetivas.

VOZ HISTÓRICA

Utilize os textos reais fornecidos em VOZ_HISTORICA_GUSTAVO para entender estilo.

Não copie frases de maneira mecânica.

Não transforme Gustavo em uma caricatura de seus posts anteriores.

HISTÓRICO

Considere HISTORICO_EDITORIAL_GUSTAVO.

Evite repetir:

a mesma tese,
o mesmo gancho,
a mesma empresa pelo mesmo ângulo
ou a mesma estrutura.

LINKEDIN

Priorize:

tese,
contexto breve,
interpretação,
consequência empresarial
e conclusão.

Não iniciar repetidamente com:

"Você sabia?"
"Em um cenário..."
"No mundo atual..."

Não utilizar CTA comercial.

Não terminar todo texto em pergunta.

Não utilizar emojis por padrão.

INSTAGRAM REEL

Escrever para fala.

45 a 75 segundos.

Um assunto por vídeo.

Entregar gancho + pontos de fala + fecho.

Não criar um texto para decorar.

OAB

Conteúdo deve permanecer informativo, discreto e sóbrio.

Não:

prometer resultado;
divulgar honorários;
oferecer desconto;
comparar-se a concorrentes;
induzir diretamente contratação;
expor caso ou resultado de cliente;
usar autoengrandecimento;
transformar conteúdo em consulta individual.

Quando houver dúvida:

[REVISÃO OAB]
```

---

# 40. FACT-CHECK

Antes da aprovação:

manter claramente separado:

```text
FATOS DA FONTE
```

de:

```text
INTERPRETAÇÃO DO GUSTAVO
```

Nunca permitir que a IA transforme interpretação em fato.

Guardar no `source_context` pelo menos:

```ts
{
  facts: [],
  numbers: [],
  companies: [],
  dates: [],
  sourceUrls: []
}
```

Quando houver informação de baixa segurança:

incluir flag.

Exemplo:

```text
Número citado apenas por uma fonte secundária.
```

---

# 41. COMPLIANCE OAB

Criar análise de compliance antes do conteúdo ir para aprovação.

Retorno estruturado:

```ts
{
  safe: true,
  flags: [],
  requiresHumanReview: false
}
```

Flags possíveis:

```text
commercial_cta
promise_of_result
self_aggrandizement
comparison
client_case
confidentiality
individual_legal_advice
sensationalism
unverified_claim
other
```

Não bloquear todo conteúdo automaticamente por qualquer observação.

Mostrar alertas para revisão.

Casos graves impedem `Enviar para Gustavo` até correção.

---

# 42. CRON

Criar pipeline próprio.

Nome conceitual:

```text
runGustavoContentFetchPipeline
```

Não misturar o loop inteiro dentro de `runFetchPipeline`.

Pode reutilizar helpers.

Criar rotas equivalentes, por exemplo:

```text
/api/gustavo-content/fetch
/api/gustavo-content/fetch-worker
/api/gustavo-content/from-link
/api/gustavo-content/items
/api/gustavo-content/topics
/api/gustavo-content/theses
/api/gustavo-content/voice
/api/gustavo-content/runs
```

Adapte à convenção real do projeto.

Criar cron próprio somente após verificar:

- `vercel.json`;
- quantidade de crons já existente;
- limitações do plano.

Preferência:

rodar diariamente em dia útil.

Não executar em paralelo de forma que prejudique o pipeline institucional.

Caso seja melhor usar o cron existente apenas como orquestrador de dois pipelines independentes, isso é aceitável, desde que uma falha em Gustavo NÃO derrube a busca institucional e vice-versa.

---

# 43. LOGS

Criar:

```text
gustavo_content_fetch_runs
```

ou estrutura equivalente.

Registrar:

```text
trigger
started_at
finished_at
topics_count
items_seen
discarded_under_55
radar_created
suggestions_created
duplicates
errors
```

Pipeline best-effort.

Erro em uma notícia não derruba as demais.

---

# 44. RLS E SEGURANÇA

As novas tabelas precisam de RLS de acordo com os padrões atuais do projeto.

Lembre que o módulo utiliza service role para escrita server-side.

Não expor service role ao cliente.

Não utilizar `user_metadata` como autorização.

A autorização real deve depender da identidade/perfil persistido no banco.

Mesmo quando a mutation utilizar `getSupabaseAdmin()`, validar o usuário AUTENTICADO antes de executar a operação.

Service role não substitui autorização.

Todas as APIs precisam validar:

```text
admin
OU
gustavo_content_members
```

antes de retornar dados.

Isso inclui leitura.

---

# 45. ÍNDICES DO BANCO

Criar índices úteis.

No mínimo avaliar:

```text
gustavo_content_items(status)
gustavo_content_items(created_at desc)
gustavo_content_items(published_at desc)
gustavo_content_items(thesis_id)
gustavo_content_items(topic_id)
gustavo_content_theses(status)
gustavo_content_topics(is_active)
```

Se houver busca textual recorrente, avalie a necessidade depois.

Não adicionar infraestrutura de busca avançada sem necessidade.

---

# 46. MANUTENÇÃO DA VERSÃO ORIGINAL

Ao editar LinkedIn/Reel pela primeira vez:

salvar:

```text
original_linkedin_post
original_reel_script
```

Isso permitirá comparar IA x edição humana.

`has_alterations` deve refletir alteração relevante nos outputs.

Registrar:

```text
edited_by
edited_at
```

---

# 47. APROVAÇÃO DO GUSTAVO

Botão:

# Enviar para Gustavo

muda:

```text
rascunho
→
aguardando_aprovacao
```

Botões no acesso do Gustavo:

```text
Aprovar conteúdo
Solicitar ajuste / rejeitar
Editar
```

A aprovação deve registrar claramente quem aprovou.

Depois:

```text
aprovado
```

---

# 48. PUBLICAÇÃO

Após produção:

permitir ao admin marcar:

```text
Publicado no LinkedIn
Publicado no Instagram
```

Campos:

```text
URL
data
```

Não exigir os dois.

Um item pode ser publicado somente em LinkedIn.

---

# 49. DESIGN

O módulo deve seguir o padrão visual atual do ORQESTRAI.

Porém:

não quero uma tela genérica cheia de tabelas.

Priorize:

- hierarquia editorial;
- informação respirada;
- score visível;
- tese visível;
- problema empresarial visível;
- cards de ângulo bem diferenciados;
- editor agradável;
- comparação clara entre fonte e interpretação.

Desktop é prioridade, mas precisa funcionar adequadamente em mobile/tablet.

Não adicionar biblioteca de UI desnecessária se o projeto já possui componentes suficientes.

---

# 50. LOADING / EMPTY / ERROR STATES

Implementar corretamente.

Exemplos:

Radar vazio:

```text
Nenhuma oportunidade encontrada no momento.
A busca automática continuará acompanhando os temas configurados.
```

Teses vazias:

```text
A Biblioteca de Teses ainda está vazia.
Cadastre as primeiras posições do Gustavo para melhorar a qualidade dos conteúdos.
```

Aguardando opinião:

mostrar claramente que a IA propositalmente NÃO gerou opinião.

Falha no artigo:

assim como no pipeline atual, se RSS tiver título/snippet suficientes pode continuar com alerta.

Manual link ilegível:

retornar erro amigável equivalente ao comportamento atual.

---

# 51. NÃO QUEBRAR O MÓDULO ATUAL

Isto é requisito crítico.

Depois da implementação:

o fluxo atual:

```text
/conteudo/roteiros
```

precisa continuar:

- buscando RSS;
- classificando áreas;
- gerando carrossel;
- aprovando;
- exportando Word;
- enviando Planner;
- funcionando para colaboradores.

Não alterar:

```text
CAROUSEL_PROMPT
status atuais
content_topics
content_roteiros
```

exceto pequenas extrações técnicas estritamente necessárias para reutilização de helpers.

---

# 52. TESTES OBRIGATÓRIOS

Criar testes de unidade/integração conforme o padrão existente.

Cobrir principalmente:

## Acesso

```text
admin → 200
Gustavo member → 200
Marketing não admin → 403
designer não admin → 403
outro sócio → 403
usuário comum → 403
```

## Score

```text
<55 não persiste
55–69 radar
>=70 sugestao
```

## Opinião

```text
sem tese validada
→ aguardando_opiniao

com tese validada
→ pode gerar rascunho
```

## Segurança

Usuário sem acesso tentando chamar API diretamente:

```text
403
```

## Dedupe

Mesmo link/fato:

```text
não duplica
```

## Planner

Segundo clique:

```text
não cria task duplicada
```

## Histórico

Conteúdo muito semelhante:

```text
similarityRisk = high
```

e geração recebe instrução de variar ângulo.

---

# 53. CRITÉRIOS DE ACEITE

A feature só está pronta quando:

- [ ] existe item restrito no menu;
- [ ] somente admin e Gustavo conseguem acessar;
- [ ] acesso direto por URL também é protegido;
- [ ] APIs também são protegidas;
- [ ] existem temas RSS próprios;
- [ ] RSS funciona;
- [ ] link manual funciona;
- [ ] ideia própria funciona;
- [ ] score 0–100 funciona;
- [ ] itens abaixo de 55 são descartados;
- [ ] 55–69 entram em radar;
- [ ] 70+ entram em sugestões;
- [ ] problema empresarial é gerado;
- [ ] três ângulos são gerados;
- [ ] Biblioteca de Teses funciona;
- [ ] Voz do Gustavo funciona;
- [ ] histórico entra na decisão editorial;
- [ ] IA não inventa opinião;
- [ ] perguntas ao Gustavo funcionam;
- [ ] respostas geram novo rascunho;
- [ ] LinkedIn é gerado;
- [ ] Reel é gerado;
- [ ] recomendação de canal funciona;
- [ ] conteúdo pode ser editado;
- [ ] versão original é preservada;
- [ ] Gustavo pode aprovar;
- [ ] aprovação é auditada;
- [ ] conteúdo aprovado pode gerar tarefa no Planner;
- [ ] tarefa LinkedIn e Reel são independentes;
- [ ] conteúdo pode ser marcado como publicado;
- [ ] histórico apresenta os conteúdos;
- [ ] módulo institucional existente continua funcionando;
- [ ] cron/pipeline existente continua funcionando;
- [ ] testes passam;
- [ ] lint passa;
- [ ] build passa.

---

# 54. ORDEM DE IMPLEMENTAÇÃO

Faça em etapas.

## Etapa 1 — Fundação

- migrations;
- tabelas;
- RLS;
- acesso;
- rotas base;
- item no menu.

Validar antes de continuar.

## Etapa 2 — Biblioteca

- Teses;
- Voz;
- CRUD;
- UI.

## Etapa 3 — Radar

- temas;
- RSS;
- extração;
- dedupe;
- score;
- logs.

## Etapa 4 — Inteligência editorial

- problema empresarial;
- ângulos;
- matching de tese;
- histórico;
- perguntas para Gustavo.

## Etapa 5 — Conteúdo

- LinkedIn;
- Reel;
- channel recommendation;
- edição/versionamento.

## Etapa 6 — Aprovação

- envio para Gustavo;
- respostas;
- aprovação;
- rejeição;
- audit trail.

## Etapa 7 — Planner

- tarefa LinkedIn;
- tarefa Reel;
- proteção contra duplicação.

## Etapa 8 — Histórico/publicação

- histórico;
- URLs;
- datas;
- dashboard.

## Etapa 9 — QA

- testes;
- RLS;
- lint;
- typecheck;
- build;
- regressão do `/conteudo/roteiros`.

---

# 55. DURANTE A IMPLEMENTAÇÃO

Não faça toda a implementação “às cegas” e só teste no final.

A cada etapa:

1. implemente;
2. rode os testes relevantes;
3. corrija;
4. avance.

Antes de declarar concluído:

rode os comandos reais existentes no `package.json`, por exemplo:

```text
test
lint
typecheck
build
```

Não invente nomes de scripts.

Leia primeiro o `package.json`.

---

# 56. MIGRATIONS

Siga o padrão real de migrations Supabase do projeto.

Antes de criar tabelas:

inspecione:

- como migrations são nomeadas;
- padrões de FK;
- `users.id`;
- UUID defaults;
- triggers de `updated_at`;
- RLS existente.

Não inventar migration manual incompatível com o projeto.

Depois da migration:

verificar:

- policies;
- FKs;
- índices;
- constraints;
- acesso authenticated;
- service role.

---

# 57. EVITAR OVERENGINEERING

NÃO implementar agora:

- API oficial do LinkedIn;
- publicação automática;
- API oficial do Instagram;
- analytics automático;
- scheduler de publicação;
- calendário editorial completo;
- embeddings/vector database;
- sistema complexo de notificações;
- scraping automático do LinkedIn;
- geração automática de arte;
- teleprompter;
- upload de vídeo;
- social listening externo.

O objetivo desta primeira versão é:

# INTELIGÊNCIA EDITORIAL + PRODUÇÃO + APROVAÇÃO

---

# 58. RESULTADO FINAL ESPERADO

Ao abrir `/conteudo/gustavo`, quero conseguir visualizar algo como:

```text
POSICIONAMENTO GUSTAVO

Esta semana
LinkedIn 1/2
Reels 0/1

5 oportunidades fortes
2 aguardando sua visão
1 aguardando aprovação

-----------------------------------

90 | Casas Bahia...
Problema:
A proteção judicial criou uma janela, mas a reestruturação depende do que será executado nela.

Tese relacionada:
Tempo jurídico não substitui execução.

LinkedIn ✓
Reel ✓

[ Analisar pauta ]
```

Ao entrar:

```text
FONTE

notícia
fatos
números
score

-----------------------------------

O QUE REALMENTE IMPORTA

Problema empresarial

-----------------------------------

COMO PODEMOS FALAR SOBRE ISSO

[ Diagnóstico ]

[ Estratégia ]

[ Contraponto ]

-----------------------------------

TESE DO GUSTAVO

"Tempo jurídico não substitui execução."

-----------------------------------

LINKEDIN

[ editor ]

-----------------------------------

INSTAGRAM

Gancho
• ponto
• ponto
• ponto
Fecho

-----------------------------------

[ Enviar para Gustavo ]
```

E o Gustavo, ao entrar:

```text
2 conteúdos precisam da sua atenção
```

sem precisar entender RSS, configuração técnica ou pipeline.

---

# 59. PRINCÍPIO FINAL

Se houver dúvida durante a implementação, utilize esta ordem de prioridade:

```text
1. não quebrar o ORQESTRAI existente;
2. segurança de acesso;
3. opinião real do Gustavo;
4. qualidade editorial;
5. simplicidade operacional;
6. automação.
```

Automatizar algo incorreto é pior do que exigir um clique.

A IA deve reduzir trabalho.

Ela não deve inventar pensamento.

O objetivo final não é criar mais posts.

O objetivo é transformar o ORQESTRAI em um sistema capaz de:

# identificar boas oportunidades,
# conectar essas oportunidades ao pensamento do Gustavo
# e transformar pensamento real em autoridade recorrente.

---

# 60. ENTREGA DO CODEX

Quando terminar:

1. apresente resumo arquitetural do que foi criado;
2. liste migrations;
3. liste novos arquivos;
4. liste arquivos existentes modificados;
5. explique quais helpers existentes foram reaproveitados;
6. informe como a conta do Gustavo recebeu acesso;
7. informe como configurar os primeiros temas RSS;
8. informe como cadastrar as primeiras teses;
9. informe como cadastrar posts antigos na Base de Voz;
10. liste APIs criadas;
11. informe os testes executados e resultados;
12. informe `lint`, `typecheck` e `build`;
13. destaque qualquer limitação restante;
14. confirme explicitamente que `/conteudo/roteiros` continua funcionando.

Antes de implementar, faça uma leitura completa do repositório e valide as decisões acima contra a arquitetura existente.

Quando houver diferença entre uma suposição deste documento e a implementação real do projeto, preserve o comportamento real do ORQESTRAI e adapte a solução de forma limpa, explicando a decisão no resumo final.