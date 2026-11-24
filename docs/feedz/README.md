# Engenharia reversa do Feedz (TOTVS RH) → ORQESTRAI

Levantamento de 16/11/2026.

**Andamento**: o **PDI** já está no ORQESTRAI. Telas `/pdi` (Meu PDI e Minha equipe), `/pdi/[id]` e `/rh/pdi` (Planos, Gestores diretos, Tipos).
- Os 33 planos e o gestor direto de 74 pessoas foram importados do Feedz em 16/11/2026, com `scripts/importar-pdi-feedz.mjs`.
- Em teste, só admin abre (`PDI_ADMIN_ONLY` em `src/lib/access-control.ts`). Objetivo: trazer para o ORQESTRAI tudo o que a Bismarchi | Pires faz hoje no Feedz, a começar pelo **PDI**.

As **Reuniões 1:1** também já estão no ORQESTRAI desde 19/11/2026, conforme [proposta-1-1.md](proposta-1-1.md):
- **Telas**: `/1-1` (Minhas 1:1), `/1-1/[líder]/[liderado]` (página da dupla) e `/rh/1-1` (Cobertura, Histórico e Configurações).
- **Importação** com `scripts/importar-1-1-feedz.mjs`. Entraram 404 das 417 reuniões, com 763 tópicos de pauta, 174 anotações privadas e 118 ações. Ficaram de fora:
  - 12 reuniões de 6 pessoas desligadas que não têm cadastro no ORQESTRAI;
  - 1 reunião sem horário no Feedz.
- **Acesso**: em teste, só Pessoas e Cultura (chave `/rh`) e admin abrem (`ONE_ON_ONE_HR_ONLY`).

## Fontes e arquivos desta pasta

| Arquivo | Fonte | O que tem |
|---|---|---|
| [proposta-feedback.md](proposta-feedback.md) | Histórico do Feedz (23/11/2026) + benchmark | **Feedback contínuo**: uso real (496 feedbacks), benchmark, proposta e as 10 decisões de 23/11/2026 |
| [oportunidades.md](oportunidades.md) | Conta da empresa (19/11/2026) + o que o ORQESTRAI já tem | **O que mais dá para trazer**, com o uso real de cada módulo, esforço e ordem sugerida |
| [telas-logado.md](telas-logado.md) | Conta da empresa no Feedz, perfil admin | **Uso real**: menu contratado, configurações ligadas, modelo de dados do PDI pela API interna, critérios da avaliação, categorias de 1:1, pontos da gamificação, mapa de 214 endpoints |
| [pdi-e-1-1.md](pdi-e-1-1.md) | Central de ajuda (PDI e 1:1) | Especificação completa dos dois módulos |
| [avaliacoes.md](avaliacoes.md) | Central de ajuda (120 artigos) | Avaliação de desempenho, comitê de calibração, 9Box, avaliação de experiência, DISC |
| [feedback-celebracoes-comunicados.md](feedback-celebracoes-comunicados.md) | Central de ajuda (70 artigos) | Feedback, celebrações, comunicados, gamificação, humor, ouvidoria |
| [clima-pesquisas-metas.md](clima-pesquisas-metas.md) | Central de ajuda (cerca de 120 artigos) | Clima, eNPS, pesquisa rápida, Super Pesquisa, NR-01, OKR, incentivos (PLR) |
| [base-e-demais-modulos.md](base-e-demais-modulos.md) | Central de ajuda | Perfis, hierarquia, cadastro, integrações, relatórios, release notes, DP, R&S, assinatura |

As especificações da central de ajuda descrevem **tudo o que o Feedz oferece**. O `telas-logado.md` mostra **o que a empresa liga e usa**. Quando os dois divergem, vale o segundo.

## O que a empresa usa de verdade no Feedz

| Módulo do Feedz | Uso na BP | Evidência (16/11/2026) |
|---|---|---|
| **PDI** | **Intenso** | 31 planos ativos (25 em dia, 6 atrasados) e 2 finalizados, nas 5 áreas. Os planos nasceram da Avaliação de Competências 2025: cada grupo de tarefas é uma competência avaliada. Trilhas e Onboarding de PDI não são usados. |
| **Avaliação de desempenho** | Anual | Ciclos "Avaliação de Competências_2025" (finalizado) e **"_2026" (em andamento, autoavaliação até 24/11)**. Modelo 180° (gestor e autoavaliação), escala de 4 conceitos, 12 critérios agrupados nos valores CIVIL e mais 2 de liderança, quadrante 9Box no resultado. |
| **Reuniões 1:1** | Mensal | 7 categorias próprias (uma é "Acompanhamento do PDI"). Usa pauta compartilhada, ações, anotações privadas (viram ata) e vínculo com a agenda. |
| **Feedback** | Semanal | De 2 a 17 por semana. Nota por valor CIVIL, 10 modelos (um da casa), "feedback presencial", limite de 10 por colaborador, lembrete ao gestor a cada 30 dias. Anônimo desligado. |
| **Celebrações** | Semanal | De 1 a 5 por semana, mais as automáticas: boas-vindas, aniversário, tempo de casa e aniversário da empresa, com e-mail para toda a empresa. |
| **Comunicados** | Em uso | O sino avisa "enviou um novo comunicado". |
| **Gamificação** | Ligada | Moeda Feedzcoin, ciclo mensal, pontos por ação (ver `telas-logado.md`). |
| eNPS, Pesquisa Rápida, Super Pesquisa | Ligados | O gráfico de eNPS do Dashboard está sem dados. |
| Sucessão (beta) | Ligado | Sem indício de uso. |
| Humor, Ouvidoria | **Desligados** | — |
| OKR, Incentivos, DP, Assinatura, DISC, Riscos psicossociais | **Não contratados** | Não aparecem no menu. O R&S é o ATS da TOTVS, outra plataforma. |

## Feedz × ORQESTRAI

Inventário do ORQESTRAI feito em 16/11/2026.

| Módulo | ORQESTRAI hoje | Falta para substituir o Feedz |
|---|---|---|
| **Gestor direto (hierarquia)** | Não existe. `hr_employees` não tem gestor, o organograma tem divisões fixas no código e só o RH vê. O gestor por área só existe no módulo de férias e em `email_area_managers`. | **Pré-requisito de tudo**: PDI, 1:1, feedback e avaliação dependem de "quem é o líder de quem". |
| **PDI** | Não existe. | Módulo inteiro (ver abaixo). |
| **1:1** | Não existe. | Módulo inteiro, ligado ao PDI. |
| **Avaliação de desempenho** | Não existe. | Ciclo, critérios CIVIL, autoavaliação + gestor, resultado, 9Box, devolutiva. Calibração por comitê é opcional (a BP não usa). |
| **Feedback** | `/rh/boas-praticas` é **registro do RH** de ocorrências do manual. A entrega ao colaborador **ainda passa pelo Feedz** (importa o relatório de visualização). | Feedback entre pessoas: enviar, pedir, responder, nota por valor CIVIL, modelos, privado ou presencial. As boas práticas podem virar um tipo de feedback. |
| **Celebrações** | A tela inicial mostra aniversário, tempo de casa e novos colaboradores, com arte do Marketing. Curtir, comentar e elogio CIVIL existem **sem commit**. | Celebração livre (mural "celebrar com todos"), posts automáticos, e-mail para a empresa e notificação. |
| **Comunicados** | Não existe ("comunicado" hoje é um pedido ao Marketing no Planner). | Mural com público-alvo, leitura confirmada, destaque, agendamento e comentários. |
| **Pesquisas / eNPS** | `team_surveys` é um formulário genérico, só admin cria, com síntese por IA. O clima é um painel estático. | Cálculo de eNPS, recorrência e corte mínimo de anonimato. |
| **Gamificação** | Não existe (o BP Awards é anual). | Decidir se vale manter. |
| **Painel do gestor / People Analytics** | Só o painel das boas práticas. | Visão do gestor: PDI, 1:1, feedback e avaliação dos liderados. |
| **Notificações ao colaborador** | Só boas-vindas e senha por e-mail, mais pendências na tela inicial. | Sino geral e e-mail para lembretes de PDI, 1:1, feedback e avaliação. |

## Ordem sugerida

0. **Base**: gestor direto em `hr_employees` (com histórico), valores CIVIL e competências como cadastro e um sino de notificações para o colaborador.
1. **PDI**, já com a importação dos 33 planos do Feedz.
2. **1:1**: a pauta puxa as ações do PDI, porque hoje a 1:1 mensal é justamente o acompanhamento do PDI.
3. **Avaliação de competências**: o ciclo 2026 termina no Feedz (o prazo da autoavaliação é 24/11) e o resultado vem para cá. O ciclo 2027 roda no ORQESTRAI e gera os PDIs automaticamente.
4. **Feedback contínuo**, juntando com as boas práticas.
5. **Celebrações e comunicados** no mural da tela inicial.
6. eNPS e pesquisas, gamificação e sucessão: avaliar depois se valem.

## PDI no ORQESTRAI — proposta a partir do modelo real do Feedz

**Como o Feedz guarda** (pela API interna):
- **plano**: `name`, `type`, `pdi_type`, `dt_start`, prazo como **duração** (`time_to_finish` + unidade, ex.: 10 meses), `ai_advised`;
- **grupos de tarefas**: `name`, `description`, `step`;
- **tarefas**: `name`, `description` HTML, `step`, `status` = **progresso de 0 a 100**, `finish_date` quando chega a 100, vínculo com LMS;
- **percentuais**: o do grupo é a média do progresso das suas tarefas, truncada. O do plano é a média dos grupos, truncada, e cada grupo pesa igual. Conferido nos 33 planos.

Pela central de ajuda (detalhes em `pdi-e-1-1.md`):
- **Tipos de tarefa**: "Atingido/Não atingido" ou "Porcentagem".
- **Prazo do plano**: em dias, semanas ou meses.
- **Status**: Ativo (em dia ou atrasado), Finalizado e Expirado. Só o plano ativo pode ser editado.
- **Criação**: o colaborador cria o próprio PDI **sem aprovação**, o líder só recebe um e-mail, e **não há comentários** do gestor.
- **"Criar a partir de modelo"**: no PDI, copia o plano de outra pessoa. Modelo de verdade só existe em Trilha e Onboarding.
- **Aconselhador IA**: monta o PDI a partir de uma avaliação de desempenho escolhida pelo RH.

**O que levar igual**:
- plano → grupos (competências) → tarefas;
- progresso de 0 a 100 por tarefa, com média no grupo e no plano;
- "em dia" ou "atrasado" pela data prevista;
- abas Ativos, Finalizados e Expirados;
- visão de gestão por área, gestor e cargo;
- modelos de plano;
- campo de aprendizados por tarefa.

**O que melhorar** em relação ao Feedz:
- **70-20-10 como campo**: hoje a equipe escreve à mão "Tipo: 20% – Interações e trocas / Evidência / Prazo / Indicador de conclusão" dentro da descrição. No ORQESTRAI isso vira campos: tipo (70 prática, 20 troca, 10 curso), evidência esperada, prazo da ação e indicador de conclusão.
- **Prazo por ação**, além do prazo do plano.
- **Histórico de progresso**: cada atualização guarda a data, o valor e o comentário. O Feedz só guarda o valor atual.
- **Evidência anexada** (arquivo ou link) ao concluir.
- **Grupo ligado ao critério da avaliação**, para gerar o PDI a partir das notas mais baixas.
- **Ligação com a 1:1**: as ações do PDI aparecem na pauta da reunião mensal.
- **Combinado com o gestor**: o gestor pode aprovar o plano e comentar cada tarefa. O Feedz não tem nenhum dos dois.
- **Modelos reais de PDI**, por cargo ou competência, em vez de copiar o plano de outra pessoa.
- **Telas** no padrão do ORQESTRAI: fotos, ícones, detalhe em modal centralizado e nunca painel lateral.

**Tabelas propostas** (prefixo `hr_pdi_`):
- `plans`: colaborador, gestor acompanhante, título, tipo, ciclo e critério de origem, início, previsto, status (rascunho, ativo, concluído, cancelado), criado por, gerado por IA.
- `goals`: plano, competência ou critério, título, descrição, ordem.
- `actions`: objetivo, título, descrição, tipo 70/20/10, evidência esperada, indicador, prazo, progresso, concluída em, aprendizados.
- `action_updates`: histórico de progresso.
- `types`.
- `templates`.

**Lembretes que o Feedz manda e precisam continuar**:
- "Você tem ações ativas atrasadas", todos os dias, ao colaborador;
- relatório às segundas para o gestor, com ações e planos que vencem em 7 dias.

**Migração**: uma única chamada da API interna (`/trilhas/{perfil}/trilha/{plano}`) devolve o plano inteiro: grupos, tarefas, progresso, datas, **aprendizados**, quem concluiu e o **gestor direto** do colaborador. Dá para importar os 33 PDIs com um script lendo pela sessão logada. O Feedz não guarda histórico de progresso, só o valor atual.

O Feedz também tem recursos que a BP **não usa** mas que valem no modelo:
- prazo por tarefa (`dt_to_realize`);
- quem valida a conclusão (`validation_type`);
- dependência entre grupos e tarefas (`blocked_by`);
- origem em modelo (`id_trail_group_task`).

## Decisões para a empresa

1. **Data de fim do contrato com o Feedz.** Ela define o prazo de tudo, e o histórico precisa ser exportado antes.
2. **Histórico a migrar**: PDIs, feedbacks, atas de 1:1, resultados das avaliações 2025 e 2026.
3. **Gestor direto**: quem é o líder de cada pessoa. O Feedz tem essa informação e dá para importar.
4. **Gamificação, sucessão, eNPS**: manter, trocar ou deixar de lado.
