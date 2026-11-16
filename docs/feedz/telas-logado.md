# Feedz (TOTVS RH) — telas vistas logado

Levantamento feito em 16/11/2026, dentro da conta da Bismarchi | Pires, com perfil de administrador.
Registra só a estrutura das telas e as configurações. Não traz dados pessoais nem conteúdo de feedbacks ou PDIs.

## Menu completo (o que a empresa tem contratado)

Barra do topo: Início, Mapeamento de Riscos Psicossociais (venda), Central de ajuda, Comunicados, Notificações (sino), Perfil.

Menu do perfil: Meu perfil (`/perfil`), Minha carreira (`/minha-carreira`), Configurações da empresa (`/empresa/perfil`), Organograma (`/organograma`), Colaboradores (`/colaboradores`), Comunicados, Auditoria do Sistema (`/auditoria`), Sair.

Menu lateral:

- **Início** (`/inicio`): feed.
- **Desempenho & Desenvolvimento**
  - Avaliações: Minhas Avaliações (`/avaliacao-desempenho/lista`), Administrar Avaliações (`/avaliacao-desempenho`), Administrar Comitês (`/avaliacao-desempenho/committees`)
  - Sucessão: Sucessão (`/sucessao`), Administrar Sucessões (Admin, Beta) (`/gerenciar-sucessao`)
  - Feedbacks: Feedbacks (`/feedbacks`), Gestão de Feedbacks (`/feedbacks/gestao`), Histórico de Feedback (`/feedbacks/historico`)
  - Planos de Desenvolvimento: Meus Planos de Desenvolvimento, com selo "IA" (`/trilhas`), Gestão dos Planos de Desenvolvimento (`/trilhas/gestao/pdi`)
  - Reuniões 1:1: Reuniões 1:1 (`/1on1`), Histórico de 1:1 (`/gestao/1on1`)
  - Painel do Gestor, novidade (`/gestao/painel`)
  - Resumo de Atividades (`/resumo`)
- **Clima & Engajamento**
  - Comunicados (`/comunicados`)
  - Pesquisas: Pesquisa de Satisfação / eNPS (`/enps`), Pesquisa Rápida (`/pesquisa-rapida`), Super Pesquisa (`/super-pesquisa`), Mapeamento de Riscos Psicossociais (não contratado, leva a uma página de venda)
  - Celebrações (`/celebracoes`)
  - Gamificação: Ranking (`/engajamento`), Histórico (`/engajamento/vencedores`), Recompensas (`/engajamento/recompensas`)
- **Pessoas**: Colaboradores (`/empresa/colaboradores`), Desengajados (`/empresa/colaboradoresdes`), Turnover (`/turnover`), Painel de Engajamento (`/dashboard/engajamento`), Dashboard (`/dashboard`), Recrutamento & Seleção (`/totvs-rh-atracao-de-talentos`, o ATS da TOTVS)
- **People Analytics**, novidade (`/people-analytics`)
- **Configurações**: Aparência (`/empresa/perfil`), Geral (`/empresa/configuracoes`), Cargos (`/empresa/cargos`), Integrações (`/empresa/integracoes`), Celebrações (`/empresa/celebracoes`), Gamificação (`/empresa/gamificacao`), PDI (`/empresa/planos-de-desenvolvimento`)

**Não aparecem no menu** (módulos da central de ajuda que a empresa não usa): Objetivos e Metas/OKR, Incentivos, Departamento Pessoal, Avaliação de Experiência como item próprio, Mapeamento Comportamental, Assinatura Digital, Ouvidoria e Termômetro de Humor como tela própria. O humor aparece só como gráfico no Dashboard, e sem dados.

**Notificações vistas no sino** (só os tipos): "Você ganhou moedas pelo seu acesso de hoje!", "Você tem ações ativas atrasadas. Vamos revisar?" (lembrete do PDI), "<pessoa> celebrou com todos!", "<pessoa> enviou um novo comunicado".

**Dashboard** (`/dashboard`): filtro por período (data de início e fim) e os gráficos Humor em toda a empresa (total atual e no período), E-NPS Satisfação (última pesquisa), Volume de celebrações por semana e Volume de feedbacks realizados por semana. Nos últimos 3 meses, de 17/08 a 16/11/2026: 1 a 5 celebrações por semana e 2 a 17 feedbacks por semana. Humor e eNPS estão sem dados.

## PDI — Configurações (`/empresa/planos-de-desenvolvimento`)

1. **ADs usadas pelo Aconselhador de PDI (IA)**: escolhe qual avaliação de desempenho a IA usa para recomendar PDI.
   - A lista só mostra ciclos criados nos últimos 12 meses, e só uma AD pode ser escolhida.
   - Só usa o Aconselhador quem está no ciclo escolhido e tem ao menos uma resposta na sua AD.
   - Hoje nenhuma AD está escolhida.
2. **Dias para edição do PDI após a expiração**: quantos dias o colaborador ainda pode editar o plano depois da data prevista de término. Valor atual: **999**, ou seja, na prática não trava.
3. **Tipos de plano de desenvolvimento**:
   - A chave "Exibição dos tipos padrões" está **desligada**, então só aparecem os tipos criados pelo admin.
   - Tipos padrão do sistema (não dá para editar nem excluir): Habilidades Técnicas, Liderança, Comunicação, Gestão.
   - Tipos criados pela empresa: **"Desenvolvimento de Competências Comportamentais e Técnicas"** e **"Não Usar"**. Cada tipo tem título e descrição, e o admin pode editar e remover os seus.

## PDI — Gestão (`/trilhas/gestao/pdi`)

- Três quadros no topo: **Individuais** (PDI), **Trilhas** (`/trilhas/gestao/pdl`) e **Onboardings** (`/trilhas/gestao/onboarding`). Cada quadro mostra quantos planos estão ativos e a % em dia e atrasados.
  - Hoje: 31 PDIs ativos, 25 em dia (80%) e 6 atrasados (19%); 2 finalizados.
  - Trilhas e Onboardings: nenhum ativo. **A empresa usa só o PDI individual.**
- Abas **Ativos (n)** e **Finalizados (n)**. Botões "Criar um novo plano de desenvolvimento" e "Exportar planos". Faixa "Experimente criar os PDIs com aprimoramento de IA".
- Busca por pessoa, botão Filtros, agrupamento por **Departamentos / Gestores / Cargos** e filtro de status (Todos, Em dia, Atrasados).
- **Card de cada plano**:
  - foto, nome, cargo e departamento do colaborador;
  - foto e nome de quem acompanha (o gestor);
  - prazo: "Faltam N dias" ou "Atrasada N dias";
  - anel com a % de conclusão.
- Gráfico de pizza "Todos os planos por departamento", com a tabela ao lado. Hoje: Reestruturação 11, Operações Legais 8, Trabalhista 5, Contratos e Societário 4, Cível 3.
- **Criar plano**: abre o modal "Como você gostaria de criar esse plano?", com as opções **Criar do Zero** e **Criar a partir de um modelo**. A empresa não tem nenhum modelo salvo: "Para utilizar um plano como modelo você deve criar seu primeiro plano". O editor ficou travado em "Carregando..." no Chrome, por isso os campos do formulário vieram da API (abaixo).

## PDI — Meu Desenvolvimento (`/trilhas`, visão do colaborador)

- Abas **Ativos / Finalizados / Expirados** e botão "Criar um plano" (o colaborador também cria o próprio).
- **Cabeçalho do plano**:
  - título, por exemplo "Plano de Desenvolvimento (PDI) – Avaliação de Competências 2025";
  - Tipo, Cargo e Departamento;
  - "Início em" e "Previsto";
  - Percentual de conclusão e "Concluídas X de Y tarefas";
  - link "Alterar Plano" (`/planos/{perfil}/pdi/editar/{plano}`).
- **Grupos de tarefas**: cada um tem nome, "Descrição do grupo", percentual de conclusão, "Concluídas X de Y" e um botão de expandir/recolher. Na prática cada grupo é uma competência a desenvolver, por exemplo "Comunicação Assertiva e Clareza de Direcionamento" ou "Planejamento e Organização".
- **Tarefas**: número (01, 02…), nome, e então a "Data de finalização da trilha" (se concluída) ou a % atual.
- **Modal da tarefa**: nome, **descrição em texto rico**, campo **Progresso (%)**, editor **"Conte seus maiores aprendizados"** e os botões Voltar e **Atualizar Progresso**.
- **Como a empresa preenche a descrição**: a estrutura 70-20-10 vai escrita à mão dentro do texto:
  - "**Tipo:** 20% – Interações e trocas"
  - "**Descrição:**" com os passos
  - "**Evidência:**"
  - "**Prazo:**"
  - "**Indicador de conclusão:**"

  ➜ No ORQESTRAI, esses itens devem virar campos de verdade.
- Coluna lateral **"Minha equipe"**: o Líder (nome e cargo) e a Equipe (colegas com o mesmo gestor).

### PDI — modelo de dados real (API interna do Feedz)

Endpoints que a tela usa (vistos no tráfego de rede e no código):

- `GET /api/gestao/planos/associacao/{plano}` → `{ id, dt_start, id_profile, name, type, pdi_type, ai_advised, time_to_finish, time_to_finish_type, time_to_finish_description }`
  - `type`: 1 = PDI individual (provável: 2 = trilha, 3 = onboarding).
  - `pdi_type`: id do tipo de PDI configurado.
  - **O prazo é uma duração, não uma data**: `time_to_finish` = 10 e `time_to_finish_type` = 3 ("meses"). A data "Prevista" sai de `dt_start` + duração.
  - `ai_advised`: se o plano foi gerado pelo Aconselhador IA.
- `GET …/{plano}/blocos` → `{ trail_groups: [{ id, name, description, step, tasks_count }], count_groups, count_group_tasks }`. `step` é a ordem do grupo.
- `GET /api/gestao/planos/associacao/blocos/{grupo}/tarefas` → `[{ id, name, type, description (HTML), step, status, finish_date, lms_source, integration_afferolab }]`
  - `status` é **o próprio progresso, de 0 a 100**. Quando chega a 100, grava `finish_date`.
  - `type` = 2 em todas as tarefas da empresa (tarefa livre; os outros tipos devem ser cursos e conteúdos).
  - `lms_source` e `integration_afferolab`: ligação com cursos de LMS (Afferolab). A empresa não usa (`integrated_with_afferolab: false`).
- **Cálculo**:
  - % do grupo = média do `status` das suas tarefas, truncada;
  - % do plano = **média das % dos grupos**, truncada. Cada grupo pesa igual, não importa quantas tarefas tem.
  - Conferido nos 33 PDIs da empresa em 16/11/2026: 33 de 33 iguais. A média simples de todas as tarefas batia em só 17 de 33.
- **Visão do colaborador, tudo numa chamada**: `GET /trilhas/{perfil}/trilha/{plano}` (com cabeçalho JSON) devolve o plano completo.
  - **plano**: `id`, `pdi_type {id, title}`, `type`, `name`, `status` (a % do plano), `dt_start`, `dt_finish`, `days_left`, `task_number {done, total}`, `time_to_finish_description`.
    - `profile {id, name, photo, id_manager, direct_manager {id, name, photo}}`: **o Feedz guarda o gestor direto de cada pessoa**.
    - `profileInfo`: departamento (nome e sigla) e cargo.
  - **grupo**: `id`, `id_trail_group` (modelo de origem), `blocked_by` (**sequência**: o grupo só libera depois de outro), `status` (%), `name`, `description`, `sequence`, `task_number`, `tasks[]`.
  - **tarefa**:
    - `id`, `id_trail_group_task` (modelo de origem), `name`, `description` (HTML), `step`;
    - `status` (progresso de 0 a 100), `finish_date`, `finished_by_profile` (quem concluiu);
    - `learning` (**texto de "aprendizados"**) e `learning_type`;
    - `dt_to_realize` (**prazo da tarefa**, vazio nos planos da empresa);
    - `validation_type` (quem valida a conclusão), `type`;
    - `helped_by` e `blocked_by` (dependência entre tarefas);
    - `lms_source` e `external_payload` (curso de LMS).
  - Nos planos da empresa: `type` 2, `validation_type` 1 e `learning_type` 1 em todas as tarefas; aprendizados preenchidos em 5 de 6 tarefas; as tarefas concluídas foram marcadas pelo próprio colaborador.
- Atualizar progresso: `/trilhas/{perfil}/trilha/{plano}/grupos/{grupo}/tarefas/{tarefa}`. Finalizar plano: `/trilhas/{perfil}/trilha/{plano}/finalizar`. Criar: `/planos/{perfil}/pdi/criar`. Editar: `/planos/{perfil}/pdi/editar/{plano}`.
- **Migração**: com a lista de planos da gestão e essa chamada, dá para importar todos os PDIs com grupos, tarefas, progresso, datas, aprendizados e o gestor direto.
- Outros: `GET /api/planos/show-ai-advisor` (mostra o botão da IA), `GET /planos/pdi/afferolab/integration-status`, `gestao/planos/modelos/{x}` e `/criar` (modelos), `select2/{x}/permissoes/pdi`, `select2/{x}/planos/pdi/settings/perf-appraisal` (AD do Aconselhador).
- **Importadores em massa**: `importador/trails/trail-association` (cria PDIs por planilha) e `importador/trails/targets`.

## Feedbacks (`/feedbacks`, `/feedbacks/novo`)

- **Tela principal**:
  - botões **Solicitar Feedback** e **Enviar Feedback**;
  - filtro por período (data de início e data final);
  - contadores de Feedbacks recebidos e Feedbacks enviados;
  - **"Resumo por item"**: radar dos 5 valores CIVIL, com os meus feedbacks recebidos contra a **média da companhia**;
  - "Resumo mensal de feedbacks enviados e recebidos";
  - abas **Recebidos / Enviados / Solicitações Recebidas / Solicitações Enviadas**.
- **Item da lista**:
  - status **Visualizado** e **Respondido**;
  - a nota em cada valor, por exemplo "C – Cliente no centro: 5";
  - "Ler feedback", campo **Responder feedback**, "Anotações internas";
  - **Compartilhar no LinkedIn**, com texto opcional.
- **Enviar feedback** (`/feedbacks/novo`):
  1. Selecione um colaborador.
  2. **Itens da empresa**: "Atribua um ou mais itens da empresa a esse feedback". São os 5 valores CIVIL, cada um com nota em **estrelas**.
  3. **Modelo de feedback**: Nenhum modelo, "Bismarchi Pires" (criado pela empresa), parar/continuar/começar, SCI (Situação/Comportamento/Impacto), Comunicação Não Violenta, 1 on 1, ótimas ideias, boa reunião, claro e direto, falha prazos.
  4. **Descreva seu feedback**: texto rico, sem imagens.
  5. **Feedback presencial**: "Esse feedback foi dado presencialmente".
  6. **Anotações Internas**: "São privadas e aparecerão apenas para você".
- **Solicitar feedback**: modal "Selecione um colaborador para enviar a solicitação".
- **Itens da empresa** (Configurações > Geral): os 5 valores CIVIL, cada um com nome e descrição:
  - C – Cliente no centro
  - I – Inovação constante
  - V – Valorização das pessoas
  - I – Inteligência em resultados
  - L – Liberdade para criar

## Reuniões 1:1 (`/1on1`, `/1on1/{par}/one-on-one`)

- **Lista**:
  - "Desvincular Agenda": a 1:1 está ligada ao calendário (Google/Outlook);
  - filtros: Colaborador, Status do colaborador (Ativos/Desligados), Categoria e Frequência (**Boa/Ruim**);
  - colunas: Nome, Última reunião, Próxima reunião;
  - bloco "Em breve";
  - botão "Criar reunião 1:1".
- **Categorias de 1:1 criadas pela empresa**:
  - Acompanhamento das metas individuais e coletivas
  - **Acompanhamento do Plano de Desenvolvimento Individual**
  - Alinhamento de prioridades e entregas
  - Desenvolvimento contínuo e alinhamento de expectativas
  - Devolutiva Avaliação de Competências
  - Discussão de desempenho e evolução de competências
  - Reforço de cultura, valores e boas práticas do escritório
- **Página do par** (líder e liderado):
  - **Participantes**, com papel Líder e Liderado.
  - **"Resumo do liderado"**, em três semáforos:
    - **Feedbacks**: "33 dias que você enviou", em vermelho;
    - **1:1**: "Boa – 17 dias desde a última reunião", em verde;
    - **PDI**: "Todos em dia", em verde.
  - Botão **"Jornada Completa"**.
  - **Reuniões**: abas "Próxima reunião e anteriores" (linha do tempo) e "Reuniões agendadas", com Filtros e **Finalizar em massa**.
  - **Recorrências**: "Mantenha suas 1:1 agendadas com as recorrências".
  - **Ações**: abas Em andamento e Concluídas. Cada ação tem texto e responsável, e as opções marcar como concluída, desfazer, editar e excluir.
- **Card de cada reunião**:
  - data, horário de início e fim, editar, **Acessar** (link da videochamada), excluir;
  - status (por exemplo **Finalizada**) e a etiqueta da categoria.
  - **Pauta compartilhada**: "Adicione um tópico sugerido na pauta" (lista de tópicos padrão) ou "Adicione um novo tópico". Cada tópico mostra a foto do autor.
  - **Ações da reunião**: "Registrem as tarefas discutidas nesta 1:1".
  - **Anotações privadas**: editor rico, visível só para quem escreve.
- **Como a empresa usa hoje**: 1:1 mensal de acompanhamento do PDI. A anotação privada vira uma ata, com o % atual do PDI, o que foi combinado e a evolução por competência.

## Configurações > Geral (`/empresa/configuracoes`), valores atuais

| Grupo | Configuração | Valor |
|---|---|---|
| Feedback | Exibir modelos de feedback padrão | ligado |
| | Permitir feedback anônimo | **desligado** |
| | Permitir envio de feedback | ligado |
| | Lembrete de envio de feedback para gestores | **a cada 30 dias** |
| | Limite de feedbacks por colaborador | **10** |
| | Compartilhar feedback no LinkedIn | ligado |
| 1:1 | Lembrete de reunião (dias para fazer outra 1:1) | **30** |
| | Permitir selecionar qualquer pessoa | desligado |
| | Liderado pode alterar a data da 1:1 | desligado |
| | Liderado pode avaliar a 1:1 | desligado |
| | Exibir tópicos padrão da 1:1 | ligado |
| Segurança | Autenticação de 2 fatores | desligada |
| Humor | Frequência do termômetro | Diário (o módulo está desligado) |
| | Humor anônimo | desligado |
| Gestão | Filtro de departamentos gerenciáveis | ligado |
| | Organograma completo para todos os colaboradores | **desligado** |
| Comunicados | Colar conteúdo estilizado | ligado |
| Turnover | Usar admissões no cálculo | desligado |
| Celebrações | Listar "todxs/todes" | desligado |
| Cadastro | Desativar e-mail automático de boas-vindas | desligado |
| | Colaborador altera nome, cargo, e-mail, admissão, nascimento | tudo desligado |
| Relatórios | Relatório semanal (às segundas) de Ações e Planos perto do prazo final | ligado (prazo em até 7 dias) |
| | Relatório automático do gestor | ligado |

**Módulos ligados**: Pesquisa de Satisfação (eNPS), Pesquisa Rápida, Super Pesquisa, Celebrações, Sucessão, Ranking de Engajamento, Planos de Desenvolvimento, Reuniões de 1:1, Comunicados, Feedbacks.
**Desligados**: Termômetro de Humor e Ouvidoria.

## Celebrações — Configurações (`/empresa/celebracoes`)

- **Textos editáveis do módulo**: nome do módulo, título e subtítulo da página, placeholder, nome da ação e limite de celebrações.
- **Quatro disparos automáticos**: boas-vindas a novos colaboradores, aniversário, tempo de casa e aniversário da empresa. Cada um tem:
  - mensagem personalizada;
  - foto, imagem ou GIF de até 10 MB, com pré-visualização;
  - chave ativo/inativo;
  - "Ativar envio de e-mail para toda a empresa";
  - "Usuário que aparecerá na celebração": o autor do post automático, uma pessoa do RH;
  - só nas boas-vindas: "Aguardar a data de admissão para celebrar".
- No tempo de casa existe também "Ativar a publicação da celebração dentro da Feedz".

## Gamificação — Configurações (`/empresa/gamificacao`)

- **Ciclo**: periodicidade de 1 mês. Ciclo atual: 01/11/2026 a 30/11/2026.
- **Moeda**: "Feedzcoin".
- **Pontos por ação**, cada uma com limite opcional de "vezes por ciclo":

| Ação | Pontos |
|---|---|
| Alterar foto do perfil | 500 (1 vez por ciclo) |
| Enviar feedback | 500 |
| Responder eNPS | 500 |
| Responder pesquisa rápida | 500 |
| Responder Super Pesquisa | 500 |
| Enviar celebração | 200 |
| Responder humor | 100 |
| Acesso diário | 100 |
| Check-in em objetivo | 100 |
| Responder pesquisa de engajamento | 10 |
| Receber celebração | 0 |
| PDI vigente | 0 |
| PDI concluído | 0 |
| Finalizar 1:1 | 0 |

- Existe uma calculadora: "Simule a quantidade ideal de pontos para atingir a recompensa".

## Avaliação de desempenho — o que a empresa roda (`/avaliacao-desempenho`)

- **Ciclos**:

| Ciclo | Status | Prazo da autoavaliação | Prazo dos gestores |
|---|---|---|---|
| Avaliação de Competências_2025 | Finalizada | 24/10/2025 | 27/11/2025 |
| **Avaliação de Competências_2026** | **Em andamento** | 24/11/2026 | 15/11/2026 |
| [TESTE] Avaliação de Competências_2026.1 | Desativada | — | — |

- Nenhuma avaliação de experiência. Por ciclo existem as ações: Ver detalhes, Editar, Finalizar ou Reabrir, Duplicar (com ou sem respostas), Enviar respostas em rascunho e Excluir. Há também "Exportar participantes e sua última nota".
- **Assistente em 5 passos**: Informações iniciais → Avaliações e prazos → Critérios e respostas → Configurações → Participantes.
  - Informações iniciais: nome, período analisado e descrição.
- **Tipos de avaliação usados em 2026**: **Gestores** e **Autoavaliação**, isto é, 180°. "Outros avaliadores" (pares, clientes internos, liderados) está **desligado**.
- **Escala**: modelo "Conceito" com **4 opções** (1º a 4º), cada uma com texto e descrição, e **nota esperada**. A outra opção seria uma escala de figuras (estrelas, corações ou foguetes).
- **Conjunto "Todos os participantes"**: 12 critérios agrupados nos 5 valores CIVIL.
  - **Cliente no centro**: Empatia e escuta ativa; Personalização de soluções
  - **Inovação constante**: Curiosidade e aprendizado contínuo; Experimentação e adaptação
  - **Valorização das pessoas**: Acolhimento e respeito interpessoal; Inteligência emocional; Colaboração e desenvolvimento
  - **Inteligência em resultados**: Planejamento e organização; Foco e execução estratégica; Responsabilidade e ownership
  - **Liberdade para criar**: Protagonismo e iniciativa; Autonomia responsável
- **Conjunto "Participantes que são gestores no ciclo"**: mais 2 critérios de **Lideranças**, "Gestão de pessoas e desenvolvimento de talentos" e "Tomada de decisão estratégica orientada a resultados".
- **Configurações do ciclo 2026**:
  - **Ligado**:
    - e-mails automáticos;
    - comentário obrigatório (avaliador e autoavaliação);
    - informar o status da devolutiva;
    - aplicar os critérios de liderança a quem é gestor;
    - prévia do resultado para os gestores;
    - **quadrante da 9Box** no resultado;
    - comentários por critério para gestor e participante;
    - identificação dos avaliadores para o admin;
    - gráfico de teia por classe e por critério;
    - gráfico de barras por critério.
  - **Desligado**:
    - editar respostas depois de enviadas;
    - enviar o resultado aos gestores automaticamente;
    - resultado em forma de conceito;
    - limitar o participante à nota final;
    - ocultar critérios.
- **Ligação com o PDI**: os PDIs de 2026 se chamam "PDI – Avaliação de Competências 2025", e cada grupo de tarefas é um critério da avaliação. **O PDI nasce da avaliação**: os critérios com nota mais baixa viram grupos do PDI.

## Mapa da API interna (extraído do código das telas, 214 endpoints sem OKR, ATS e incentivos)

Serve de checklist do que cada módulo faz por trás da tela.

- **1:1**:
  - reunião: `1on1/{id}`, `/finish`, `/finish-details`, `/validate-finish`;
  - pauta: `meeting-topics`;
  - anotações privadas: `private-notes`;
  - nota dada ao liderado: `score-evaluated`;
  - sugestões de pauta por IA: `ai-suggestions/apply`, `/accept-topic`, `/reject-topic`;
  - ações combinadas: `actions/{id}`, `/finish`;
  - recorrência: `recurrences/{id}`.
- **Avaliação de desempenho**:
  - critérios e classes de critério;
  - fluxo de participantes (novo, remover, alterar gestor);
  - indicação e validação de avaliadores, com contadores;
  - escalas e critérios, configurações específicas por grupo;
  - importar/exportar critérios;
  - curva ideal;
  - nine box dos participantes;
  - enviar resultado e remover entregas;
  - relatório "análise completa por critérios".
- **Comitês de calibração**:
  - criar, iniciar e finalizar;
  - facilitador, avaliadores e avaliados;
  - discussão por pessoa;
  - nine box com calibração;
  - visibilidade.
- **Avaliação de experiência**: buscar colaboradores em experiência, participantes, alterar o prazo de respostas.
- **Comunicados**:
  - geral, gestor, enviados, destaque, etiquetas, status, logs;
  - banner e limite de banners;
  - novo, editar, duplicar, arquivar, remover banner;
  - comentários, curtir;
  - marcar como lido, leitores (com pré-visualização), exportar detalhes.
- **Sucessão**: ciclos (v2), posições, indicação de colaboradores pelo gestor, aprovação e validação, "minha sucessão" e relatório.
- **Pesquisa NR-1** (riscos psicossociais): perguntas, departamentos, grupos, unidades, parar pesquisa.
- **Humor**: `humor/{id}/chat` (conversa privada do gestor com quem marcou humor baixo).
- **Holerites**: períodos, importação, distribuição e reversão.
- **Importador**: colaboradores, atualização de colaboradores, férias, saldo de férias, trilhas.
- **Outros**: `feedz-persona/{id}/individual-result` (mapeamento comportamental), `notifications/push`, `upload/image`.
- **Telas renderizadas no servidor** (sem API JSON no pacote, vistas pela tela): feedbacks e celebrações.
