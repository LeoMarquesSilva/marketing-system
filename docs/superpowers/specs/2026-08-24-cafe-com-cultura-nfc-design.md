# Café com Cultura — Confirmação e Check-in NFC

## Objetivo

Criar um controle mensal de participação no Café com Cultura integrado ao
módulo de Eventos e ao NFC Hub. Todos os colaboradores ativos entram como
confirmados por padrão, justificativas de ausência são importadas do
RESPONSUM e a presença real é registrada pelo próprio colaborador após login.

## Decisões aprovadas

- O Café com Cultura ocorre, por padrão, na última sexta-feira de cada mês.
- O administrador pode alterar a data quando houver feriado ou exceção.
- O prazo de fechamento da quantidade é informado manualmente em cada edição.
- A janela padrão de check-in é das 09h às 12h, em `America/Sao_Paulo`.
- A etiqueta NFC é permanente e sempre abre a edição ativa.
- O colaborador precisa entrar no ORQESTRAI e é identificado pela própria
  sessão; não existe seleção de outro nome.
- As ausências vêm de `Pessoas e Cultura > Café com Cultura > Justificativa de
  Ausência`, no RESPONSUM.
- A sincronização é automática e também pode ser disparada por um administrador.
- A administração da presença será parte do módulo de Eventos.

## Arquitetura

O cadastro principal continua em `events` e `event_series`. A série estável
usa o slug `cafe-com-cultura`; cada mês possui uma edição com nome no formato
`Café com Cultura — <mês> <ano>`.

Uma tabela `event_participants` armazena a expectativa e a presença por
colaborador. Ela é separada de `event_invites`: convidados externos e convites
continuam no domínio existente, enquanto a lista institucional exige vínculo
obrigatório com `users`, check-in idempotente e rastreabilidade da origem.

A etiqueta usa o fluxo de URL autenticada já existente no NFC Hub e redireciona
para `/cafe-com-cultura`. Essa rota encontra a edição ativa dinamicamente, logo
o cartão não precisa ser regravado a cada mês.

## Modelo de dados

### `events`

Adicionar campos genéricos de operação de presença:

- `attendance_cutoff_at timestamptz null` — prazo informado pelo administrador;
- `checkin_opens_at timestamptz null` — padrão 09h na data da edição;
- `checkin_closes_at timestamptz null` — padrão 12h na data da edição.

### `event_participants`

- `id uuid`;
- `event_id uuid`;
- `user_id uuid`;
- `expectation_status`: `confirmed`, `excused_absence` ou `excluded`;
- `expectation_source`: `automatic_roster`, `responsum` ou `admin`;
- `checkin_at timestamptz null`;
- `checkin_source`: `nfc`, `qr` ou `admin`;
- `responsum_ticket_ids uuid[]`;
- `responsum_synced_at timestamptz null`;
- `created_at`, `updated_at`;
- unicidade em `(event_id, user_id)`.

O motivo textual da ausência não será copiado. O ORQESTRAI guardará somente os
IDs das solicitações que sustentam a exceção, reduzindo duplicação de dados
potencialmente sensíveis.

### `event_attendance_sync_runs`

Registrar início, término, resultado, contagens, mensagem sanitizada e se a
execução foi automática ou manual. Essa tabela permite exibir a última
sincronização e investigar falhas sem registrar chaves ou conteúdo do ticket.

### Histórico

Correções feitas por administradores serão gravadas em `event_history`, com o
ator e os valores anteriores/novos. O check-in do próprio colaborador também
gera um registro funcional sem incluir informação sensível.

Todas as novas tabelas em `public` terão RLS. A Data API não será usada
diretamente pelo navegador para este domínio: leitura e mutação ocorrerão por
rotas autenticadas. `anon` não recebe acesso; administradores operam pelo
backend e o check-in permite apenas que a sessão atual altere sua própria linha.

## Geração mensal

Uma rotina idempotente garante as edições do mês atual e seguinte:

1. localizar ou criar a série `cafe-com-cultura`;
2. calcular a última sexta-feira;
3. criar a edição apenas se ainda não existir;
4. definir 09h e 12h em São Paulo;
5. inserir todos os usuários ativos no roster como confirmados;
6. preservar edições e participantes históricos.

Alteração manual da data recalcula a janela somente quando o administrador
solicitar; horários customizados não serão sobrescritos pelo cron.

## Integração com o RESPONSUM

O RESPONSUM foi identificado no projeto Supabase `ticket-bp`, com as tabelas:

- `app_c009c0e4f1_tickets`;
- `app_c009c0e4f1_users`;
- categoria `cafe_com_cultura`;
- subcategoria `justificativa_de_ausencia`.

O adaptador de produção usará credenciais exclusivas server-side
`RESPONSUM_SUPABASE_URL` e `RESPONSUM_SUPABASE_SERVICE_KEY`. Nenhuma chave será
enviada ao cliente ou salva na configuração NFC.

Os IDs de usuário do RESPONSUM são a origem dos IDs sincronizados para
`users`, portanto o vínculo primário é por UUID. E-mail normalizado será apenas
fallback auditável para registros antigos.

Como os tickets atuais informam a data em título ou descrição, o sincronizador
extrai `DD/MM` ou `DD/MM/AAAA`, associa à edição correspondente e ignora tickets
sem data inequívoca. Casos não associados aparecem no resumo da sincronização
para correção no RESPONSUM. Uma nova sincronização reconcilia inclusões e
remoções sem apagar check-ins.

## Experiência do colaborador

1. Aproxima o celular da etiqueta.
2. O NFC Hub registra a leitura e exige login.
3. Após autenticar, o usuário retorna ao fluxo e é redirecionado para
   `/cafe-com-cultura`.
4. A página mostra nome do encontro, data, local e estado da janela.
5. Entre 09h e 12h, o botão `Confirmar minha presença` registra o próprio
   usuário.
6. Repetições retornam o horário original, sem duplicar a presença.

Estados visuais: carregando, login necessário, edição não encontrada, ainda não
aberto, check-in disponível, já confirmado, encerrado e erro recuperável. A
página é mobile-first, com alvos de toque de pelo menos 44px e sem dropdown de
colaborador.

Uma ausência justificada não impede o check-in: se a pessoa comparecer, a
presença real prevalece no indicador de comparecimento, enquanto a exceção
permanece no histórico administrativo.

## Painel administrativo

Eventos da série Café com Cultura recebem a aba `Presenças`, visível e operável
apenas por administradores. Ela contém:

- indicadores de confirmados para o local, ausências justificadas, presentes e
  pendentes;
- data, janela de check-in e prazo de corte editáveis;
- última sincronização e botão `Sincronizar agora`;
- atualização do roster de colaboradores ativos;
- busca e filtros;
- foto, nome, área, expectativa e horário de presença;
- correções manuais de confirmação, ausência, presença e remoção de presença;
- exportação CSV compatível com Excel.

Em celular a tabela vira uma lista de cartões; fotos e ações continuam visíveis.

## NFC permanente

Adicionar um template de sistema `Café com Cultura — Check-in mensal`, do tipo
URL autenticada, apontando para a URL canônica
`https://marketing-system-xi.vercel.app/cafe-com-cultura`. O administrador cria
ou associa a etiqueta física uma única vez.

## Rotas

- `GET /api/cafe-com-cultura/current` — estado público autenticado da edição e
  da presença do usuário atual;
- `POST /api/cafe-com-cultura/check-in` — check-in idempotente da sessão atual;
- `GET /api/eventos/:id/attendance` — painel administrativo;
- `PATCH /api/eventos/:id/attendance` — configuração/correção administrativa;
- `POST /api/eventos/:id/attendance/roster` — atualizar colaboradores ativos;
- `POST /api/eventos/:id/attendance/sync-responsum` — sincronização manual;
- `GET /api/eventos/:id/attendance/export` — CSV;
- `GET /api/cron/cafe-cultura-sync` — geração e sincronização automáticas.

## Segurança e confiabilidade

- Toda autorização usa `auth.getUser()` no servidor e vínculo por `users.auth_id`.
- Check-in é permitido somente para a própria sessão, na edição e janela ativas.
- Uma constraint única e `upsert` tornam o registro idempotente.
- APIs administrativas exigem papel `admin`.
- Credenciais do RESPONSUM e service role permanecem exclusivamente no servidor.
- Mensagens externas são sanitizadas antes de serem persistidas ou retornadas.
- Horários são comparados em instantes UTC derivados de `America/Sao_Paulo`.
- O cron exige `CRON_SECRET` e pode ser repetido sem duplicar dados.

## Critérios de aceite

- A edição mensal é criada na última sexta-feira e pode ter data alterada.
- Todos os usuários ativos entram confirmados por padrão.
- Justificativas válidas do RESPONSUM alteram a expectativa do usuário.
- A etiqueta permanente sempre abre a edição ativa.
- Usuário sem sessão entra e retorna ao fluxo original.
- Usuário autenticado não consegue registrar outra pessoa.
- Check-in só ocorre das 09h às 12h e não duplica.
- Administrador acompanha e corrige o quadro com histórico.
- Exportação apresenta a quantidade correta para o local e a presença real.
- Testes unitários, testes de rotas, TypeScript, lint e build passam.


