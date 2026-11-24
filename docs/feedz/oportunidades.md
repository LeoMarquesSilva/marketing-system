# Feedz → ORQESTRAI: o que mais dá para trazer

Levantamento de 19/11/2026. Percorri a conta da empresa no Feedz (perfil admin), tela por tela, e cruzei com o que o ORQESTRAI já tem.
- O **PDI** já foi trazido; veja [README.md](README.md).
- Especificação detalhada de cada módulo: nos outros arquivos desta pasta.

## Resumo

| # | O que trazer | Uso na empresa hoje (Feedz) | O ORQESTRAI já tem | Esforço |
|---|---|---|---|---|
| 1 | **Reuniões 1:1** | 131 reuniões registradas; mensal; 7 categorias próprias | Nada (o PDI e o gestor direto já estão prontos) | Médio |
| 2 | **Feedback contínuo** | De 2 a 17 por semana; nota por valor CIVIL | Boas práticas (só registro do RH; a entrega ainda passa pelo Feedz) | Médio |
| 3 | **Painel do gestor** | Cobertura de feedback e de 1:1, PDI, dias sem conversa | A aba "Minha equipe" do PDI | Baixo depois de 1 e 2 |
| 4 | **Comunicados** | Cerca de 15 por mês, 17 etiquetas, leitura de 50% a 80% | Nada | Médio |
| 5 | **Mural de celebrações** | Posts "celebrar com" e arte de tempo de casa para todos | Aniversários e tempo de casa na tela inicial, com curtidas, comentários e elogio CIVIL | Baixo |
| 6 | **Avaliação de competências** | Ciclo anual 180°, 14 critérios CIVIL, 9Box; 2026 em andamento | Nada | Alto |
| 7 | **Desligamentos e turnover** | 22 desligamentos em 12 meses, com motivo e tipo | Só a data de desligamento (vem do VIOS) | Baixo |
| 8 | **Gamificação** | Ativa: meta mensal de 5.000 moedas, prêmio livro ou jantar | Nada (o BP Awards é anual) | Médio |
| 9 | **Quem não acessa o sistema** | Tela "Desengajados": 3 pessoas há mais de 30 dias sem entrar | `users.last_seen_at` já existe | Baixo |
| 10 | **Organograma por gestor direto** | Montado a partir do gestor direto, exportável | Organograma por estrutura, só para o RH | Baixo |
| 11 | **Cargos e carreira** | 34 cargos, com duplicados; a ficha do cargo está vazia | Cargo como texto livre | Médio |
| 12 | **Resumo por pessoa ("Jornada")** | Feedbacks, celebrações, PDI e 1:1 por pessoa, com exportação | — | Baixo depois de 1, 2 e 5 |

**Base que serve a quase tudo: notificações para o colaborador.** O Feedz avisa por sino, e-mail e celular em todos os módulos. O ORQESTRAI só tem o sino do RH e as pendências da tela inicial. Comunicados, feedback, lembretes de 1:1 e de PDI precisam de um sino geral, com e-mail pelo Microsoft 365 e push (que já existe para os leads).

---

## 1. Reuniões 1:1

**O que a empresa faz no Feedz:**
- **Volume**: 131 reuniões no histórico, quase sempre mensais.
- **Categorias próprias**:
  - "Acompanhamento do PDI"
  - "Devolutiva Avaliação de Competências"
  - "Alinhamento de prioridades e entregas"
  - mais 4 categorias
- **Lembrete**: "fazer outra 1:1 em até 30 dias".
- **Configurações**: o liderado não pode mudar a data nem avaliar a reunião.
- **Página do par (líder e liderado)**:
  - semáforo com feedbacks, dias desde a última 1:1 e situação do PDI;
  - "Jornada completa";
  - recorrência;
  - ações combinadas, com responsável e concluídas.
- **Cada reunião**:
  - data, horário e link da videochamada;
  - categoria;
  - pauta compartilhada (tópicos sugeridos ou novos, com a foto de quem incluiu);
  - ações da reunião;
  - **anotações privadas**, que viram a ata;
  - "Finalizar".
- **Vínculo com a agenda** (Google ou Outlook).
- **IA**: sugestão de pauta.

**Como trazer:**
- Usar o gestor direto que já existe. A pauta puxa sozinha as ações do PDI paradas ou vencidas.
- As ações combinadas viram tarefas com prazo.
- Lembrete quando passar de 30 dias sem 1:1.
- O convite da agenda pode sair pelo Microsoft 365, como o e-mail do "Esqueci senha".

**Migração**: as 131 reuniões, com pauta e ações. As **anotações privadas** são do autor; trazer só se a empresa decidir, e sempre visíveis apenas para quem escreveu.

## 2. Feedback contínuo

**O que a empresa faz no Feedz:**
- **Volume**: de 2 a 17 feedbacks por semana; 45 no último período do painel.
- **Enviar feedback**:
  - colaborador;
  - nota em estrelas para cada valor CIVIL;
  - um de 10 modelos (um deles "Bismarchi Pires", outro "falha prazos");
  - texto;
  - "foi presencial";
  - anotações internas.
- **Também**: solicitar feedback, responder, ver se foi visualizado, compartilhar no LinkedIn.
- **Regras**: limite de 10 por pessoa, lembrete ao gestor a cada 30 dias, sem anonimato.

**Como trazer:**
- **Juntar com as Boas práticas.** Hoje o RH registra a ocorrência no ORQESTRAI e o feedback sai pelo Feedz, depois importado de volta para marcar a visualização. Com o feedback dentro do ORQESTRAI, a ocorrência vira um feedback com categoria do manual e a visualização fica registrada sozinha.
- A nota por valor CIVIL alimenta o radar da pessoa e, mais tarde, a avaliação de competências.

**Migração**: o histórico de feedbacks (De, Para, nota por valor, texto, data, data de visualização). O Feedz exporta essas colunas, e o importador das Boas práticas já lê esse relatório.

## 3. Painel do gestor

**No Feedz**:
- números do time: tamanho, cobertura de feedbacks, cobertura de 1:1 e progresso do PDI;
- um cartão por liderado: "1:1 há 20 dias sem realizar", "feedback há 36 dias sem enviar", "PDI em dia".

**Como trazer**: evoluir a aba "Minha equipe" do PDI para um painel único da equipe, com PDI, 1:1 e feedback por pessoa. É barato depois dos itens 1 e 2.

## 4. Comunicados

**O que a empresa faz no Feedz:**
- **Volume**: cerca de 15 comunicados no último mês, para todos os departamentos ou por papel (gestor, administrador).
- **17 etiquetas**:
  - Ciclo de Avaliação de Competências
  - BPM
  - Feijoada Solidária
  - Programa Legacy (Formação de Líderes)
  - Confraternização
  - Café com Cultura
  - Feriados
  - Recesso e Bônus
  - Facilities
  - Responsum
  - Comercial | Financeiro
  - Gestão de Pessoas
  - Arraiá
  - Fotos corporativas
  - Equipe de Clima
  - Sócios e Diretoria
  - Festa 10 anos
- **Status**: Rascunho, Agendado, Ativado, Desativado, Arquivado.
- **Expiração** opcional.
- **Leitura confirmada** ("lidos / não lidos"): de 20/39 a 48/11 nos últimos.
- **Na entrada**: o comunicado abre em janela e pede "Marcar como lido".
- **Também**: destaque, comentários, curtidas, duplicar, exportar a lista de leitores.

**Como trazer:**
- Mural de comunicados na tela inicial, que hoje não tem fonte para isso.
- Público por área, papel ou equipe do organograma.
- Confirmação de leitura no mesmo modal dos convites (BP Awards, pesquisas), aviso no sino e e-mail.
- A tela de envio fica com o RH, nos moldes do envio de convites da festa.

## 5. Mural de celebrações

**O que a empresa faz no Feedz:**
- **Post livre** "Celebre com alguém!": `@colega`, `@departamento` ou `@todos`, com texto, imagem, GIF ou vídeo, curtidas e comentários.
- **Uso na prática**:
  - o RH posta a **arte de tempo de casa do Marketing** "com todos";
  - a equipe usa como canal de novidades (em 17/11, o anúncio da sugestão da IA na Vistagem).
- **Automáticas**: boas-vindas, aniversário, tempo de casa e aniversário da empresa, com e-mail para toda a empresa.

**O que o ORQESTRAI já tem**: a tela inicial mostra aniversários, tempo de casa e novos, com a arte, curtidas, comentários marcando colegas, elogio CIVIL e o post para as redes.

**O que falta**:
- o post livre "celebrar com" (vitórias, entregas, novidades);
- a celebração de boas-vindas no dia da admissão (os dados já vêm da ficha cadastral);
- o e-mail automático para todos.

## 6. Avaliação de competências

**No Feedz:**
- ciclo anual 180° (gestor e autoavaliação);
- escala de 4 conceitos;
- 12 critérios agrupados nos valores CIVIL, mais 2 de liderança;
- quadrante 9Box no resultado;
- devolutiva com status.
- O ciclo de 2026 está em andamento, com prazos em 15/11 e 24/11.

**Como trazer**: é o maior módulo. Vale construir antes do ciclo de 2027 e ligar direto ao PDI: os critérios com nota baixa viram as frentes do plano, como a empresa já faz à mão. Os critérios e o mapa com os valores CIVIL já estão no código (`src/lib/rh/pdi/civil.ts`).

**Migração**: resultados de 2025 e 2026, com nota por critério e quadrante.

## 7. Desligamentos e turnover

**No Feedz:**
- 22 desligamentos nos últimos 12 meses;
- **tipo**: 68% voluntário, 27% involuntário, o resto comum acordo;
- **motivo**: nova oportunidade, insatisfação com a chefia, baixo desempenho, salário, trancou a faculdade, abandono, outro;
- gráficos por mês e por departamento;
- histórico.

**Como trazer**:
- Campos de tipo e motivo do desligamento no cadastro (Dados cadastrais), mais um painel de turnover.
- A data já chega do VIOS. Admissões e desligamentos já estão em `hr_employees`.

**Migração**: tipo e motivo dos 22 desligamentos.

## 8. Gamificação

**No Feedz:**
- **Pontos por ação**: 500 por feedback, 200 por celebração, 100 por acesso diário, 500 por responder pesquisa…
- **Ciclo mensal**: meta de 5.000 Feedzcoins, com prêmio de "um livro até R$ 100 ou um jantar até R$ 200" (julho a dezembro de 2026).
- **Ranking** por colaboradores e gestores; 55.400 moedas distribuídas.

**Como trazer**: só faz sentido depois do feedback, das celebrações e da 1:1, que são as ações que pontuam. Antes, a empresa precisa decidir se mantém (custa prêmios todo mês). Dá para usar os valores CIVIL e o BP Awards como tema.

## 9. Quem não acessa o sistema

**No Feedz**: lista de quem não entra há mais de 30 dias, por papel, com o último acesso; exporta e copia os e-mails.

**Como trazer**: uma aba em Usuários com base em `users.last_seen_at`. Ajuda a cobrar quem não atualiza o PDI.

## 10. Organograma por gestor direto

**No Feedz**: árvore pelo gestor direto, com foto, cargo e área; zoom e exportação. Em Configurações, "visualização completa do organograma para todos" está desligada.

**Como trazer**:
- O ORQESTRAI já tem o gestor direto de 74 pessoas.
- Dá para uma visão "quem responde a quem" ao lado do organograma por estrutura.
- Depois, se a empresa quiser, liberar para todos verem a própria linha.

## 11. Cargos e carreira

**No Feedz:**
- 34 cargos e grupos de cargos, com duplicados ("ADVOGADA PLENO" e "Advogado(a) Pleno");
- "Minha carreira" mostra a ficha de cada cargo (missão, responsabilidades, requisitos, competências), mas **está tudo em branco**.

**Como trazer**:
- Cadastro de cargos no ORQESTRAI, ligado a `hr_employees.position`, limpando os duplicados.
- Depois, a ficha do cargo com as competências esperadas, que serve de base para a avaliação por cargo e para a trilha de carreira.
- Precisa de decisão do RH sobre a lista oficial de cargos.

## 12. Resumo por pessoa ("Jornada do colaborador")

**No Feedz**: tabela com média de feedback, feedbacks enviados e recebidos, celebrações enviadas e recebidas, PDI, 1:1 como gestor e como liderado, por período, com exportação.

**Como trazer**: uma aba no RH e uma linha do tempo dentro da ficha da pessoa. Sai quase de graça depois dos itens 1, 2 e 5.

---

## O que não vale trazer agora

| Feedz | Por quê |
|---|---|
| eNPS, Pesquisa Rápida, Super Pesquisa | **Nunca usadas** (as três listas estão vazias). O ORQESTRAI já tem as Pesquisas com a equipe, com anonimato e síntese por IA; no máximo, um modelo pronto de eNPS. |
| Sucessão | Nenhum ciclo criado. |
| Termômetro de humor, Ouvidoria | Desligados na empresa. |
| Trilhas e Onboarding do PDI | Nenhum em uso. O onboarding de acesso já existe no ORQESTRAI. |
| Integrações com ERP (TOTVS, Senior, Convenia) | O ORQESTRAI já sincroniza com o VIOS. |
| Mapeamento de riscos psicossociais (NR-01) | Não contratado. Pode virar um modelo de pesquisa no ORQESTRAI se a empresa precisar cumprir a norma; vale confirmar a exigência com a área trabalhista antes. |

## Ordem sugerida

1. **O dia a dia do gestor**: notificações → 1:1 → feedback (junto com Boas práticas) → painel do gestor.
2. **Comunicação**: comunicados com leitura confirmada → post livre e boas-vindas no mural.
3. **Ciclo anual**: avaliação de competências, pronta antes do ciclo de 2027, gerando os PDIs.
4. **Gestão de pessoas**: desligamentos e turnover, quem não acessa, organograma por gestor, cargos.
5. **Decisão da empresa**: gamificação.
