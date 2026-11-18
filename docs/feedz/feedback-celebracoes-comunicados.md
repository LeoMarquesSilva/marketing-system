# Engenharia reversa do Feedz (TOTVS RH) — Feedback, Celebrações, Comunicados, Gamificação, Termômetro de Humor e Ouvidoria

Fonte: central de ajuda pública (Intercom) https://ajuda.feedz.com.br, lida em 16/11/2026. Foram lidos os 70 artigos das seis coleções. Tudo que não está na documentação aparece como "não documentado". Itens marcados "(inferido)" são dedução de modelagem, não texto da ajuda.

Convenções: "Admin" = perfil Administrador; "Gestor" = perfil Gestor; "Colaborador" = perfil Colaborador. Caminhos de menu em **negrito**. A Feedz usa três papéis: Colaborador, Gestor, Administrador (confirmado no artigo de criação de comunicado: "Papel: Colaboradores, Gestor ou Administrador"). Além do papel há **permissões individuais** por pessoa (Pessoas > Colaboradores > Editar > aba Permissões), por exemplo a de acessar histórico de feedbacks e a de ouvidor.

Observação geral dos artigos de visão geral: os recursos visíveis dependem das configurações da empresa e do perfil de acesso; o nome do módulo pode ser diferente na Feedz.

---

## 1. FEEDBACK

### 1.1 Propósito e menu
- Alinhar expectativas entre líderes e liderados; aproximar a equipe, melhorar engajamento, prevenir crises, reduzir turnover (Visão geral).
- Menu: **Desenvolvimento > Feedback(s)** (página com blocos; "Recebidos" e "Enviados" ficam no final/último bloco). Atalho: **Desenvolvimento > Enviar feedback**.
- Gestão: **Gestão > Gestão de Feedbacks** (exportar médias), **Gestão > Histórico de Feedbacks** (admin; apagados).
- Configuração: **Configurações > Configurações** (seções "Configurações", "Configuração do feedback 360", "Lembrete envio feedback", "Modelos de feedback").
- Permissão individual: **Pessoas > Colaboradores > (três pontinhos) Editar > aba Permissões > aba Feedbacks**.
- Artigo relacionado cita Jornada do Colaborador (tela com informações registradas, visível só para Admin/Gestor).

### 1.2 Perfis e permissões
| Ação | Quem |
|---|---|
| Enviar feedback | Todos, se "Permitir envio de feedback (padrão ativo)" estiver ligado |
| Limite diário de envio | Vale só para Colaborador; Gestor e Admin ilimitados |
| Excluir feedback enviado | Colaborador e Gestor: até 24 h após o envio (botão Excluir em Enviados, confirmar "Sim"); após 24 h só Admin (alerta de prazo expirado) |
| Ver feedbacks apagados | Somente Admin (**Gestão > Histórico de Feedbacks > Feedbacks apagados**) |
| Exportar médias | Somente Admin |
| Editar modelos | Somente Admin; modelos padrão da Feedz não editáveis |
| Acessar histórico de feedbacks (de outros) | Permissão individual na aba Permissões > Feedbacks (nomes das opções: não documentado) |
| Ver informações na Jornada do Colaborador | Admin ou Gestor |
| Anotações (+Anotações) | "Somente você tem acesso"; consultáveis na Jornada do Colaborador (o artigo é ambíguo, ver lacunas) |

Privacidade: o envio pode ser **anônimo ou identificado** (opção "Identificação"), se o admin permitir anonimato. Feedback presencial pode ser registrado.

### 1.3 Modelo de dados inferido
**Feedback**
| Campo | Tipo provável | Obrigatório | Valores / observações |
|---|---|---|---|
| Colaborador (destinatário) | FK pessoa | sim (inferido) | seleção de pessoa da empresa |
| Identificação | enum | sim (inferido) | anônimo / identificado (anônimo só se permitido pela empresa; "pode ser personalizada pela empresa") |
| Nota | inteiro/escala | não documentado | "nota relacionada aos itens da cultura"; escala não documentada |
| Itens da cultura | lista configurável | não documentado | configurados em "Configuração do feedback 360"; quais campos: não documentado |
| Texto | texto longo | sim (inferido) | pode usar modelo como guia |
| Feedback presencial | booleano | não | marcado quando foi dado pessoalmente e está sendo registrado |
| +Anotações | texto | não | notas internas do autor |
| Data/hora de envio | timestamp | sistema | base da regra de 24 h |
| Enviado por | FK pessoa | sistema | oculto se anônimo (inferido) |
| Estado | enum | sistema | enviado / apagado (com data de exclusão e quem apagou — "dados como a data em que foi apagado") |
| Ações do destinatário | — | — | responder, avaliar, compartilhar no LinkedIn (tela lateral de Recebidos) |

**Solicitação de feedback** (Desenvolvimento > Feedbacks > Solicitar Feedback): pessoa (de quem se quer feedback), texto da solicitação. Sem outros campos.

**Modelo de feedback**: entidade editável pelo Admin; campos não documentados. Existem modelos padrão da Feedz (somente leitura).

**Configurações da empresa (feedback):** Permitir envio de feedback (bool, padrão ativo); Permitir envio de feedback anônimo (bool); Limite de feedback por dia (inteiro; padrão, faixa e reset: não documentados); Lembrete envio feedback (intervalo em dias; mínimo/máximo não documentados); itens da cultura (Configuração do feedback 360).

### 1.4 Fluxos
1. **Enviar:** Desenvolvimento > Enviar feedback (ou Feedback > Enviar feedback) > escolher Colaborador > Identificação > Nota > Texto (ou modelo) > opcional Feedback presencial / +Anotações > **Enviar**.
2. **Solicitar:** Desenvolvimento > Feedbacks > Solicitar Feedback > escolher pessoa > escrever > Enviar.
3. **Receber/ver:** Desenvolvimento > Feedbacks > rolar até **Recebidos** > clicar no feedback > painel lateral com responder / avaliar / compartilhar no LinkedIn.
4. **Excluir:** Desenvolvimento > Feedback > **Enviados** > escolher > **Excluir** > Sim (dentro de 24 h). Fora do prazo: procurar RH/Admin.
5. **Auditar apagados (Admin):** Gestão > Histórico de Feedbacks > botão azul **Feedbacks apagados**.
Estados: enviado -> (excluído/apagado). Não há outros status documentados.

### 1.5 Configurações (Admin)
- Configurações > Configurações: checkbox "Permitir envio de feedback (padrão ativo)" (desligar impede colaboradores de enviar).
- Checkbox "Permitir envio de feedback anônimo".
- Seção "Configuração do feedback 360": itens da cultura e "Limite de feedback".
- Seção "Lembrete envio feedback": intervalo de dias (lembrete para gestores enviarem feedbacks).
- Seção "Modelos de feedback" > Editar modelos de feedback > Salvar.
- Moderação: Admin pode excluir após 24 h e ver apagados.

### 1.6 Notificações
- Lembrete de envio de feedback para gestores a cada N dias (canal e formato: não documentado).
- Notificação ao destinatário ao receber: não documentado.
- Integração Slack: um artigo relacionado "Como integrar o Slack com a Feedz?" é citado (não lido por estar fora da coleção); conteúdo não documentado aqui.

### 1.7 Relatórios
- **Gestão > Gestão de Feedbacks**: ícone de nuvem exporta planilha de **médias** (Admin; colunas/formato: não documentado).
- Artigo relacionado citado: "Como exportar o histórico de conteúdos dos feedbacks" (fora desta coleção).
- Feedbacks apagados: lista com conteúdo e data de exclusão (sem filtros/exportação documentados).

### 1.8 Ligações com outros módulos
- Itens da cultura (competências/valores) alimentam a nota do feedback ("Configuração do feedback 360").
- Jornada do Colaborador exibe os registros.
- Gamificação: enviar feedback gera moedas (a qualquer colaborador).
- Artigos relacionados citam integração com Protheus, RM e Datasul (folha/ERP) e reuniões 1:1; PDI não é citado em relação ao feedback.

### 1.9 Lacunas
Escala da nota; campos do modelo de feedback; nomes das opções da aba Permissões > Feedbacks; se a resposta ao feedback é pública/privada; critérios de "avaliar"; formato/colunas da exportação; mensagem ao atingir limite diário; se há notificação ao destinatário; se anônimo esconde o autor também do Admin; limites do lembrete.

---

## 2. CELEBRAÇÕES

### 2.1 Propósito e menu
Mural social de reconhecimento: qualquer pessoa publica uma celebração mencionando pessoas, departamentos ou toda a empresa, com emojis, imagem/GIF; há celebrações automáticas (boas-vindas, aniversário, tempo de casa, aniversário da empresa).
- Uso: menu lateral **Celebrações** (mural + caixa de texto + botão Enviar + botão Exportar acima da caixa).
- Configuração do mural e automáticas: **Configurações > Celebração**.
- Opção @todes/@todxs: **Configurações > Configurações > Outras Configurações**.
- Análise: **Gestão > Dashboard** (volume), **Gestão > Painel de engajamento** (eficiência).

### 2.2 Perfis e permissões
- Criar celebração: todos; **Colaborador** limitado por "Limite de Celebrações" por dia; **Gestor e Admin ilimitados**. Se limite = 0, ninguém (colaborador) celebra.
- Curtir e comentar: qualquer pessoa em qualquer celebração.
- Personalizar mural, automáticas, @todes/@todxs, limite: somente Admin.
- Exportar: requer permissão ("Como permitir que alguém exclua celebrações e exporte relatório" — permissão individual; nomes: não documentados). Quem pode excluir celebrações: permissão individual (conteúdo do artigo não lido).
- Privacidade: mural público da empresa (todos veem). Filtro: enviadas / recebidas / todas.

### 2.3 Modelo de dados inferido
**Celebração (manual)**
| Campo | Tipo | Obrigatório | Observações |
|---|---|---|---|
| Texto | texto | sim (inferido) | placeholder configurável |
| Menções | lista (pessoa, departamento, @todos/@todes/@todxs) | **sim**, pelo menos uma | sem menção a ação não conclui |
| Emojis | — | não | botão |
| Imagem/GIF | arquivo | não | inserir só pelo botão; recomendado ≤1920x1080 px; máx 10 MB |
| Autor | FK pessoa | sistema | |
| Curtidas | lista | — | |
| Comentários | lista | — | |
| Data/hora | timestamp | sistema | |
Valores da empresa/tipos de celebração: **não documentado** (não existe seleção de tipo ou valor no formulário descrito).

**Configurações do mural (Configurações > Celebração, 1ª seção)**: Nome do Módulo (nome no menu lateral); Título da página; Subtítulo da página; Placeholder; Nome da Ação (nome do ato de celebrar); Limite de Celebrações (inteiro/dia, só colaboradores).

**Celebrações automáticas** (campos comuns a todas: Ativo/Inativo; Usuário que aparecerá na celebração; opção de envio de e-mail "Ativar envio de e-mail de boas-vindas para toda a empresa"):
1. **Boas-vindas**: mensagem "Crie sua mensagem customizada de boas-vindas" com variável **NOME**; imagens/GIFs/emojis; pré-visualização; flag "Aguardar a data de admissão para celebrar". Regras: uma pessoa por vez; dispara na data de ativação do perfil ou na data de admissão; com a flag ligada e colaborador inativo ou data de admissão em branco, não dispara; cadastrado após a data de admissão, não dispara.
2. **Aniversário**: variável **NOMES**; reúne todos os aniversariantes do dia, ativos, com data de nascimento cadastrada no perfil pelo menos 1 dia antes.
3. **Tempo de casa (aniversário de admissão)**: NOMES; opção "Ativar a publicação da celebração dentro da Feedz" (gera notificação no feed da home, seção **Atividades Recentes**); data de admissão cadastrada pelo menos 1 dia antes (o artigo escreve "data de nascimento", provável erro).
4. **Aniversário da empresa**: mensagem sem NOMES; publicação em Atividades Recentes; data do aniversário da empresa em **Configurações > Empresa**, registrada ≥1 dia antes.
Imagens/GIFs das automáticas: sugerido máx 10 MB e 1.200 x 627 px.

### 2.4 Fluxos
1. **Criar:** Celebrações > escrever > digitar @ e escolher pessoa/departamento/@todos > (emoji, Imagem/GIF) > Enviar. Notifica os mencionados.
2. **Ver:** Celebrações > rolar; filtro enviadas/recebidas/todas; curtir/comentar.
3. **Erros ao celebrar (4):** limite diário atingido; imagem >1920x1080 ou >10 MB; "tempo para celebrar" (nova celebração logo após outra: aguardar 1 minuto, F5); celebração sem menção.
4. **Automáticas:** rodam por data (cadastro, nascimento, admissão, data da empresa); alterar no próprio dia não dispara, ajustar com 1 dia de antecedência. Atualização em massa de dados pelo importador de atualização de dados.
Estados: não documentado (publicada; exclusão por quem tem permissão).

### 2.5 Configurações (Admin)
Nome do módulo/título/subtítulo/placeholder/nome da ação/limite diário; ligar/desligar @todes/@todxs ("Listar as palavras todxs e todes no módulo de celebração"); cada celebração automática (ativo, usuário publicador, e-mail, publicação em Atividades Recentes, mensagem). Moderação: exclusão por quem tem a permissão.

### 2.6 Notificações
- Menção gera notificação à pessoa ou departamento citado (canal exato: não documentado).
- Automáticas: e-mail opcional para toda a empresa; notificação em Atividades Recentes (home).
- Integração Slack citada como artigo relacionado (não detalhada).

### 2.7 Relatórios
- **Exportar** (botão acima da caixa de texto, só com permissão): planilha com celebrações dos **últimos 12 meses**, quem celebrou, destinatário e mensagem.
- **Gestão > Dashboard > "Volume de celebrações no período"** (gráfico por período).
- **Gestão > Painel de engajamento**: filtros unidade, departamento, gestor, data inicial e final; seção "Engajamento por módulo" com tooltip (ícone "i") explicando cálculo de engajamento e eficiência (fórmula não documentada).

### 2.8 Ligações
- Gamificação: celebrar gera moedas para o celebrante e, conforme regras, para os marcados (ver seção 4.3).
- Dados de perfil (nascimento, admissão, status, Configurações > Empresa) alimentam as automáticas.
- Painel de engajamento agrega celebrações.

### 2.9 Lacunas
Valores/tipos de celebração; reações além de curtir; edição/exclusão pelo autor; moderação detalhada; quem tem a permissão de excluir; formato do e-mail; limite de caracteres do texto; padrão do limite diário; privacidade (mural é geral); fórmulas de eficiência.

---

## 3. COMUNICADOS

### 3.1 Propósito e menu
Comunicação interna da empresa para colaboradores, com segmentação, agendamento, destaque, comentários/curtidas e relatório de leitura.
- Acesso: ícone de megafone (ao lado do nome/foto) ou clicar no nome > **Comunicados**; botão **Criar comunicado**. Abas **Geral** e **Destaque**, busca por palavra-chave.
- Configuração: **Configurações > Configurações > Outras configurações** ("Permitir colar conteúdo estilizado na criação/edição de comunicados").

### 3.2 Perfis e permissões
- Criar/editar/agendar/duplicar/excluir/destacar/imagens/ver leitores/ver comentários: dependem de **permissão** ("Verifique com o RH"); existe permissão "gerenciar comunicados como administrador" (artigo relacionado).
- Arquivar/desarquivar: só quem administra comunicados, inclusive os de gestores; gestor sem essa permissão **não vê** os arquivados que ele mesmo criou; arquivados somem para quem não tem permissão.
- Colar conteúdo estilizado: Admin.
- Leitura: público conforme segmentação; qualquer destinatário comenta (se barra de comentários ligada) e curte.
- Gestor pode enviar "Apenas para os seus liderados diretos".

### 3.3 Modelo de dados inferido
**Comunicado**
| Campo | Tipo | Obrigatório | Valores |
|---|---|---|---|
| Assunto | texto | sim (inferido) | título |
| Notificação por e-mail | bool | não | avisa destinatários |
| Etiquetas | lista de tags | não | agrupam por tema |
| Conteúdo | rich text | sim (inferido) | fonte, hiperlink, imagem, vídeo, PDF, tabela |
| Publicação | enum | sim | Imediata / Agendada (data+hora, sem retroativo) |
| Expiração | data | não documentado se obrigatório | até quando aparece na home |
| Publicar como comunicado em destaque | bool | não | aba Destaques |
| Exibir barra de comentários | bool | não | só exibição desktop |
| Destinatários: Apenas liderados diretos | bool | — | bloqueia os demais |
| Departamento / Papel (Colaboradores, Gestor, Administrador) / Unidades / Grupos | multi-seleção | não | **interseção (E)**: só quem atende a todos os critérios preenchidos |
| Status | enum | sistema | rascunho, agendado, publicado, arquivado (excluído = definitivo) |
| Leitores | lista | sistema | quem visualizou |
| Curtidas / Comentários | listas | sistema | |
Imagens: sem comentários, largura máx. da janela 1140 px; com comentários, 764 px. Inserção: Conteúdo > Mídia > Imagem > Geral > seta ao lado de Origem (arquivo local) ou seção Incorporar com link público do Google Drive. Anexos como arquivo separado: não documentado (PDF vai no conteúdo).
**Confirmação de leitura:** o leitor clica em **Marcar como Lido** (fecha e some da home); lista em Detalhes > Leitores.

### 3.4 Fluxos
1. **Criar:** Comunicados > Criar comunicado > informações básicas (Assunto, e-mail, Etiquetas, Conteúdo) > Postagem > Destinatários > **Salvar como rascunho** ou **Próximo** (pré-visualização) > **Voltar** ou **Salvar** > **Publicar**.
2. **Agendar:** Postagem > Publicação > Agendada + data/hora; arquivar um agendado impede o disparo.
3. **Editar publicado:** três pontinhos > Editar > Salvar (prévia) > Salvar > Publicar. Se reenvia notificação: não documentado.
4. **Duplicar:** três pontinhos > Duplicar > confirmar; edita a cópia e dispara.
5. **Destacar:** marcar "Publicar como comunicado em destaque" (novo ou editando).
6. **Arquivar/Desarquivar:** três pontinhos > Arquivar/Desarquivar > confirmar.
7. **Excluir:** três pontinhos > Excluir > Sim; definitivo, irrecuperável.
8. **Ler:** aparece na home, sino e (opcional) e-mail; Marcar como Lido; comentar e curtir.
9. **Quem leu:** três pontinhos > **Detalhes** > seção **Leitores** > busca > **Exportar** (Excel enviado por e-mail).
10. **Comentários/curtidas:** clicar no comunicado; comentários no lado direito junto com curtidas.

### 3.5 Configurações
Colar conteúdo estilizado (Admin). Demais comportamentos são por comunicado. Moderação de comentários: não documentado.

### 3.6 Notificações
Sino da Feedz; e-mail se o comunicado tiver a opção ligada; aviso na tela inicial. Reenvio na edição e notificação de arquivamento: não documentado.

### 3.7 Relatórios
Lista de leitores (com busca e exportação Excel por e-mail); comentários e curtidas na janela do comunicado (sem filtros/exportação documentados). Taxa de leitura agregada: não documentado.

### 3.8 Ligações
Segmentação usa departamento, papel, unidade, grupo e hierarquia (liderados diretos) do cadastro de Pessoas. Permissão individual de gestor de comunicados fica em Pessoas > Permissões. Gamificação: ler/comentar comunicado não aparece como ação que gera moedas.

### 3.9 Lacunas
Limite de destaques; edição de agendado/cancelamento; como o destaque é exibido; quem pode criar por padrão; moderação de comentários; limite de anexos; regra de expiração; se há obrigatoriedade de leitura/lembrete de não lidos.

---

## 4. GAMIFICAÇÃO

### 4.1 Propósito e menu
Ranking de engajamento: cada ação na plataforma gera **moedas** (Feedzcoin/"Coins", nome configurável); há ciclo, meta do mês e recompensa do mês definidas pelo RH.
- Menu **Gamificação** com **Ranking**, **Recompensas**, **Histórico**.
- Configuração: **Configurações > Gamificação** (Periodicidade, Configurações das moedas, Calculadora, Importador de Coins); habilitar ranking: **Configurações > Configurações > Funcionalidades**.
- Participação individual: **Pessoas > Colaboradores > Editar > Participações > Ranking**.

### 4.2 Perfis e permissões
- Admin: configurar valores/ciclo, recompensas, calculadora, importador de moedas, habilitar ranking.
- Extrato: quem tem permissão no perfil vê o de todos; os demais, só o próprio.
- Histórico e relatórios: permissão individual ("acessar recompensas e exportar relatório de Gamificação"); nomes: não documentado.
- Colaborador só ganha moedas se a participação no ranking estiver ativa.

### 4.3 Modelo de dados inferido
**Configuração de gamificação:** ranking habilitado (bool); duração do ciclo (campo de duração; unidades de tempo não documentadas; datas início/fim calculadas); Nome da moeda; valor em moedas por ação.
**Ações que pontuam** (lista da tela Ranking; valores definidos pelo RH, não documentados):
1. Responder Pesquisa de Engajamento (uma vez por pesquisa, não por pergunta)
2. Responder pesquisa de satisfação
3. Responder Pesquisa Rápida
4. Responder Super Pesquisa (por pesquisa)
5. Alterar avatar/foto do perfil (**só a primeira troca**)
6. Enviar Feedback (cada feedback enviado a qualquer colaborador)
7. Responder Termômetro de Humor
8. Check-in em objetivo/resultado-chave (só dono/responsável do resultado-chave, contribuintes não; só após período mínimo configurado pelo admin em Objetivos, ex.: 15 dias conta só o primeiro check-in do intervalo)
9. Acesso diário à plataforma (primeiro acesso do dia)
10. Celebrar
**Regras de moedas em celebração:** celebrante sempre ganha; pessoas marcadas individualmente ganham; @departamento + pessoas de outros departamentos marcadas: só as de fora do departamento ganham; @todos + marcados individualmente: ninguém marcado ganha; @departamento + as mesmas pessoas do departamento: ninguém marcado ganha.
**Recompensa mensal:** mês; Meta do Mês (número); Recompensa do Mês (texto do prêmio); ativar Gamificação. Prêmio ao 1º lugar não é obrigatório; aparece na home abaixo do "Perfil Campeão" com meta e premiação.
**Movimentação manual (importação):** E-mail do colaborador; Quantidade de Feedzcoin (positivo adiciona, negativo remove); Descrição. Todas obrigatórias.
**Extrato** (por colaborador): lista de movimentações (colunas não documentadas).
**Histórico mensal:** top 3 de cada mês.

### 4.4 Fluxos
1. Habilitar: Configurações > Configurações > Funcionalidades > marcar ranking > Salvar.
2. Configurar: Configurações > Gamificação > ciclo (datas calculadas), nome da moeda, valor por ação > Salvar.
3. Calculadora: seção Calculadora, informar quantas vezes se espera cada atividade, ver meta mínima, clicar **"Clique aqui"** para aplicar a meta em Recompensas.
4. Recompensas: Gamificação > Recompensas > mês > Meta do Mês + Recompensa do Mês > ativar > Salvar.
5. Importar moedas: Configurações > Gamificação > **Importador de Coins** > Baixar planilha modelo > preencher > localizar planilha > escolher administrador responsável > Importar. Erros: Baixar planilha de erros (e-mail incorreto, coluna em branco, caractere especial no título, colaborador inativo). Limites: .XLS/.XLSX, 500 linhas, sem fórmulas/colunas extras; não é possível excluir ações, só somar/subtrair.
6. Ver extrato: Gamificação > Ranking > colaborador > **Extrato**.
7. Histórico: Gamificação > Histórico; botão azul **Criar relatório** (todos os meses) ou ícone de nuvem no quadro do mês (exporta o mês).
8. Participação: ativar "Ranking" no cadastro do colaborador.

### 4.5 Configurações
Habilitar ranking; ciclo; nome da moeda; valores; recompensas por mês; calculadora; importador; participação individual; período mínimo entre check-ins (em Objetivos).

### 4.6 Notificações
Não documentado (nenhum artigo cita notificação de moedas). Importação de moedas: sem notificação documentada.

### 4.7 Relatórios
Ranking com quadro de ações e moedas; Extrato; Histórico top 3 por mês; exportação geral e por mês (colunas/formato: não documentados); Painel de engajamento (Gestão).

### 4.8 Ligações
Alimentada por: Pesquisas (engajamento, satisfação, rápida, super), Feedback, Humor, Objetivos/OKR, Celebrações, perfil (foto), acesso diário. Ranking mostrado na home (Perfil Campeão).

### 4.9 Lacunas
Valores padrão por ação; unidades do ciclo; conversão moeda -> prêmio (resgate/loja não aparece; só meta e recompensa por mês); critérios de desempate; fórmula da calculadora; limites diários de moedas; reinício do ranking a cada ciclo; notificações.

---

## 5. TERMÔMETRO DE HUMOR

### 5.1 Propósito e menu
Medição periódica do humor do colaborador, com possibilidade de conversa privada de acompanhamento por gestor/admin.
- Resposta: widget na **página inicial**.
- Análise: **Gestão > Humor** (filtros, "Histórico de Humor" ao final da página).
- Config: **Configurações > Configurações > Funcionalidades** (habilitar "Termômetro de Humor") e **Outras configurações** ("Frequência do termômetro de humor").

### 5.2 Perfis e permissões
- Colaborador responde. Resposta **identificada** (a documentação diz que o que se registra será visto por gestão e RH; não há anonimato).
- Gestor: vê o humor só dos **liderados diretos**; filtro de departamento limitado aos departamentos que ele gerencia.
- Admin: vê toda a empresa e exporta. Exportação: somente Admin.
- Conversa privada: Admin e Gestor podem iniciar; resposta de Admin não é identificada ao colaborador; resposta de Gestor é identificada.

### 5.3 Modelo de dados inferido
**Resposta de humor**
| Campo | Tipo | Obrigatório | Valores |
|---|---|---|---|
| Humor | enum de 5 níveis (emojis) | sim | níveis incluem "triste" e "muito triste"; nomes dos 5 não documentados |
| Motivo | texto livre | não | caixa de texto opcional; aparece na coluna "Descrição" |
| Colaborador | FK | sistema | identificado |
| Data/hora | timestamp | sistema | |
| Imutável | — | — | não pode ser editada após envio ("Obrigado por compartilhar como se sente") |
**Configuração:** habilitado (bool); frequência: Várias vezes ao dia (reabre a cada hora cheia após resposta, ex.: 12h33 -> 13h33), Diário (a partir de 00h01 do dia seguinte), Semanal (7 dias depois, a partir de 00h do dia correspondente).
**Interação privada (Histórico de Interações):** mensagens entre gestor/admin e colaborador; encerramento pelo colaborador no **X**; reabertura por Gestor e Admin.
Motivos predefinidos: não existem (texto livre).

### 5.4 Fluxos
1. Colaborador: escolhe emoji > texto opcional > **Enviar**.
2. Gestor/Admin: Gestão > Humor > Histórico de Humor > ícone de balão de mensagem > abre Histórico de Interações > conversa. Colaborador é avisado na tela inicial.
3. Colaborador pode encerrar com X; Gestor/Admin reabrem.
4. Exportar (Admin): Gestão > Humor > Histórico de Humor > **Exportar** (planilha).

### 5.5 Configurações
Habilitar/desabilitar; frequência; (ativar notificação ao gestor indireto exige acionar o suporte pelo chat).

### 5.6 Notificações
- Humor "triste" ou "muito triste": e-mail ao gestor direto e ao gestor indireto (indireto só se configuração ativada via suporte).
- Aviso ao colaborador na home quando começa a interação privada.

### 5.7 Relatórios
Tela de gestão com filtros (período, unidade, departamento e "muito mais", não detalhados); Histórico de Humor com coluna Descrição; exportação de planilha (colunas não documentadas). Indicadores/gráficos agregados: não documentado.

### 5.8 Ligações
Gamificação (responder humor dá moedas); Jornada do Colaborador e resumo de atividades (artigos relacionados, não lidos); Gestão hierárquica (direto/indireto).

### 5.9 Lacunas
Nomes/pontuação numérica dos 5 níveis; indicadores agregados e médias; anonimização em visões agregadas; formato da exportação; quem acessa Gestão > Humor por perfil; retenção de dados.

---

## 6. OUVIDORIA

### 6.1 Propósito e menu
Canal para registrar sugestões, dúvidas, reclamações, denúncias e pedidos de auxílio (profissionais ou pessoais), com opção de anonimato e tratativa por um ouvidor.
- Colaborador: ícone de duas mãos no menu superior, ou nome > **Ouvidoria**; botão **Nova Manifestação**.
- Ouvidor: **Gerenciar Manifestação** no módulo (acesso também pela notificação).
- Configuração: **Configurações > Ouvidoria**. O módulo precisa estar habilitado para a empresa.

### 6.2 Perfis e permissões
- Colaborador (qualquer): envia e acompanha as suas.
- Ouvidor: quem tem a permissão **Permissões de ouvidor** (Pessoas > Colaboradores > Editar > Permissões > aba Geral > subseção Ouvidoria > Salvar). Novos admins criados a partir da publicação já têm a permissão ativada por padrão. Mudar permissão envia e-mail de segurança a todos os administradores.
- Admin: configura nomes, descrição, imagem, categorias.
- Privacidade: manifestação pode ser **totalmente anônima** (caixa "Manter-me anônimo") ou identificada. Como o ouvidor responde a um anônimo: não documentado.

### 6.3 Modelo de dados inferido
**Manifestação:** campos do formulário (todos obrigatórios exceto anexo; os nomes são personalizáveis pela empresa e não são listados): provavelmente categoria, assunto/título, descrição, **Anexar arquivo** (opcional); caixa **Manter-me anônimo**. Número de protocolo: não documentado.
**Status da interação:** Novo (chegou nova manifestação; interação permitida), Em andamento (tratativa em curso; permitida), Finalizado (concluída pelo ouvidor; interação não permitida). Reabertura: somente o ouvidor, mudando para Em andamento.
**Interação:** mensagens trocadas na caixa de diálogo (balão de conversa) entre ouvidor e colaborador; ouvidor escolhe o status da interação.
**Categoria:** cadastro com campos não listados (Adicionar categoria / Editar / Ativar / Desativar com confirmação).
**Configuração textual:** "Como as manifestações serão chamadas" (rótulo), "Nome do módulo", "Nome padrão do ouvidor", "Imagem padrão do ouvidor" (arquivo, Escolher arquivo; limites não documentados), "Descrição do módulo" (mensagem de explicação).

### 6.4 Fluxos
1. **Enviar:** abrir Ouvidoria > Nova Manifestação > preencher > (opcional anexo) > Manter-me anônimo (ou não) > **Salvar**.
2. **Ouvidor recebe:** e-mail + sino > Gerenciar Manifestação > filtrar > balão de conversa > escolher status > interagir.
3. **Colaborador acompanha:** cada interação do ouvidor gera e-mail e sino; clicar abre caixa de diálogo para responder.
4. **Encerrar:** ouvidor finaliza; sem mais interação; reabertura só pelo ouvidor.

### 6.5 Configurações (Admin)
Nome do módulo; rótulo "manifestações"; nome padrão e imagem do ouvidor (usados ao responder); descrição do módulo; categorias (adicionar, editar, ativar/desativar); atribuir permissão de ouvidor por pessoa.

### 6.6 Notificações
E-mail e sino 🔔: ao ouvidor quando há nova manifestação; ao colaborador a cada interação do ouvidor. E-mail aos admins quando permissões mudam. Slack/Teams: não documentado.

### 6.7 Relatórios
Lista com filtros em Gerenciar Manifestação (quais filtros: não documentado). Dashboards e exportação: não documentado.

### 6.8 Ligações
Permissões individuais em Pessoas; notificações do sistema (sino/e-mail). Sem ligação documentada com gamificação.

### 6.9 Lacunas
Protocolo; SLA/prazos; lista de categorias padrão; campos exatos do formulário; garantia técnica do anonimato (quem vê o autor, inclusive Admin); como o ouvidor responde anônimos; múltiplos ouvidores e atribuição; relatórios; efeito de desativar categoria em registros existentes; limites de anexo.

---

## 7. Ligações entre módulos (resumo)
- **Gamificação** é o hub: Feedback, Humor, Celebrações, Pesquisas, Objetivos, perfil e acesso diário geram moedas; Importador permite ajuste manual.
- **Celebrações automáticas** dependem do cadastro de Pessoas (nascimento, admissão, status) e de Configurações > Empresa.
- **Feedback** liga-se a itens da cultura (feedback 360) e à Jornada do Colaborador; solicitação de feedback é par do envio.
- **Humor** aciona hierarquia (gestor direto/indireto) e tem conversa privada.
- **Comunicados** segmentam por departamento, papel, unidade, grupo.
- **Todos** compartilham: papéis (Colaborador/Gestor/Admin), permissões individuais por pessoa, notificação por sino e e-mail, Painel de engajamento (Gestão).

## 8. URLs lidas
Coleções:
- https://ajuda.feedz.com.br/pt-BR/collections/3587523-feedback
- https://ajuda.feedz.com.br/pt-BR/collections/3587522-celebracoes
- https://ajuda.feedz.com.br/pt-BR/collections/3587516-comunicados
- https://ajuda.feedz.com.br/pt-BR/collections/3587525-gamificacao
- https://ajuda.feedz.com.br/pt-BR/collections/3892728-termometro-de-humor
- https://ajuda.feedz.com.br/pt-BR/collections/3587528-ouvidoria

Feedback (14):
- https://ajuda.feedz.com.br/pt-BR/articles/6485584-visao-geral-feedback
- https://ajuda.feedz.com.br/pt-BR/articles/6485630-como-envio-um-feedback
- https://ajuda.feedz.com.br/pt-BR/articles/6485626-como-solicitar-um-feedback
- https://ajuda.feedz.com.br/pt-BR/articles/6485718-como-visualizar-os-feedbacks-recebidos
- https://ajuda.feedz.com.br/pt-BR/articles/6485722-como-permitir-o-acesso-ao-historico-de-feedbacks
- https://ajuda.feedz.com.br/pt-BR/articles/6485691-como-editar-os-modelos-dos-feedbacks
- https://ajuda.feedz.com.br/pt-BR/articles/6485701-como-configurar-o-lembrete-de-envio-de-feedback
- https://ajuda.feedz.com.br/pt-BR/articles/6485661-como-ativar-e-desativar-a-permissao-de-envio-do-feedback-anonimo
- https://ajuda.feedz.com.br/pt-BR/articles/6485644-como-configurar-os-itens-da-cultura-para-o-feedback
- https://ajuda.feedz.com.br/pt-BR/articles/6485687-como-configurar-o-limite-de-feedback-que-podem-ser-enviados-por-dia
- https://ajuda.feedz.com.br/pt-BR/articles/6485696-como-desativar-a-permissao-de-envio-de-feedbacks
- https://ajuda.feedz.com.br/pt-BR/articles/6485737-como-visualizar-os-feedbacks-apagados
- https://ajuda.feedz.com.br/pt-BR/articles/10113035-como-excluir-um-feedback-enviado
- https://ajuda.feedz.com.br/pt-BR/articles/6485729-como-exportar-as-medias-dos-feedbacks

Celebrações (12):
- https://ajuda.feedz.com.br/pt-BR/articles/6475966-visao-geral-do-modulo-de-celebracoes
- https://ajuda.feedz.com.br/pt-BR/articles/6486244-como-personalizar-o-mural-de-celebracoes
- https://ajuda.feedz.com.br/pt-BR/articles/8632470-como-desativar-ou-ativar-todes-e-todxs-das-opcoes-nas-celebracoes
- https://ajuda.feedz.com.br/pt-BR/articles/10004013-como-configurar-o-limite-de-celebracoes-que-podem-ser-enviados-por-dia
- https://ajuda.feedz.com.br/pt-BR/articles/6476004-como-criar-uma-celebracao
- https://ajuda.feedz.com.br/pt-BR/articles/6475989-como-ver-as-celebracoes-da-empresa
- https://ajuda.feedz.com.br/pt-BR/articles/6630799-como-marcar-alguem-em-uma-celebracao
- https://ajuda.feedz.com.br/pt-BR/articles/9853419-nao-consigo-celebrar-e-agora
- https://ajuda.feedz.com.br/pt-BR/articles/6486160-como-personalizar-as-celebracoes-automaticas
- https://ajuda.feedz.com.br/pt-BR/articles/6486317-como-exportar-as-celebracoes
- https://ajuda.feedz.com.br/pt-BR/articles/6486300-como-visualizar-o-volume-das-celebracoes
- https://ajuda.feedz.com.br/pt-BR/articles/6486288-como-visualizar-a-eficiencia-das-celebracoes

Comunicados (13):
- https://ajuda.feedz.com.br/pt-BR/articles/6616624-visao-geral-do-modulo-de-comunicados
- https://ajuda.feedz.com.br/pt-BR/articles/6485776-como-ler-os-comunicados
- https://ajuda.feedz.com.br/pt-BR/articles/6486615-como-criar-e-enviar-um-comunicado
- https://ajuda.feedz.com.br/pt-BR/articles/6657029-qual-e-o-tamanho-ideal-de-imagem-para-os-comunicados-e-como-inseri-las
- https://ajuda.feedz.com.br/pt-BR/articles/6486832-como-editar-comunicados-publicados
- https://ajuda.feedz.com.br/pt-BR/articles/6486776-como-colocar-os-comunicados-em-destaque
- https://ajuda.feedz.com.br/pt-BR/articles/6486662-como-agendar-comunicados
- https://ajuda.feedz.com.br/pt-BR/articles/6486681-como-duplicar-comunicados
- https://ajuda.feedz.com.br/pt-BR/articles/6486773-como-permitir-a-colagem-de-conteudos-estilizados-nos-comunicados
- https://ajuda.feedz.com.br/pt-BR/articles/6486827-como-excluir-comunicados
- https://ajuda.feedz.com.br/pt-BR/articles/9859084-como-arquivar-desarquivar-um-comunicado
- https://ajuda.feedz.com.br/pt-BR/articles/6486699-como-saber-quem-leu-um-comunicado
- https://ajuda.feedz.com.br/pt-BR/articles/6486837-como-visualizar-os-comentarios-e-as-curtidas-dos-comunicados

Gamificação (13):
- https://ajuda.feedz.com.br/pt-BR/articles/6483773-visao-geral-da-gamificacao
- https://ajuda.feedz.com.br/pt-BR/articles/6484234-como-habilitar-desabilitar-o-ranking-de-engajamento
- https://ajuda.feedz.com.br/pt-BR/articles/9376412-como-ganhar-moedas-na-gamificacao
- https://ajuda.feedz.com.br/pt-BR/articles/6484193-como-fazer-a-importacao-das-moedas
- https://ajuda.feedz.com.br/pt-BR/articles/6484206-como-usar-a-calculadora-de-moedas-na-gamificacao
- https://ajuda.feedz.com.br/pt-BR/articles/6484248-como-configurar-as-recompensas-da-gamificacao
- https://ajuda.feedz.com.br/pt-BR/articles/6484214-como-configurar-os-valores-das-moedas
- https://ajuda.feedz.com.br/pt-BR/articles/6483783-ganho-algum-premio-quando-fico-em-primeiro-lugar-na-gamificacao
- https://ajuda.feedz.com.br/pt-BR/articles/6558407-ganho-moedas-cada-vez-que-faco-check-in-em-meu-resultado-chave
- https://ajuda.feedz.com.br/pt-BR/articles/6484218-ganho-moedas-cada-vez-que-mudo-minha-foto-de-perfil
- https://ajuda.feedz.com.br/pt-BR/articles/6593968-como-ativar-a-participacao-de-um-colaborador-no-ranking-de-gamificacao
- https://ajuda.feedz.com.br/pt-BR/articles/6484241-como-ver-o-extrato-de-pontos-na-gamificacao
- https://ajuda.feedz.com.br/pt-BR/articles/6484283-como-visualizar-e-exportar-o-historico-da-gamificacao-por-mes

Termômetro de Humor (7):
- https://ajuda.feedz.com.br/pt-BR/articles/6465096-como-responder-o-termometro-de-humor
- https://ajuda.feedz.com.br/pt-BR/articles/9590446-como-responder-o-humor-do-colaborador
- https://ajuda.feedz.com.br/pt-BR/articles/6485604-como-configurar-a-frequencia-do-termometro-de-humor
- https://ajuda.feedz.com.br/pt-BR/articles/6465104-como-habilitar-ou-desabilitar-o-termometro-de-humor
- https://ajuda.feedz.com.br/pt-BR/articles/9149731-visao-geral-fluxo-de-respostas-de-humor
- https://ajuda.feedz.com.br/pt-BR/articles/6465087-como-analisar-o-humor-do-time-que-voce-lidera
- https://ajuda.feedz.com.br/pt-BR/articles/6465100-como-exportar-os-dados-do-humor

Ouvidoria (11):
- https://ajuda.feedz.com.br/pt-BR/articles/6480064-visao-geral-do-modulo-de-ouvidoria
- https://ajuda.feedz.com.br/pt-BR/articles/6480394-como-alterar-o-nome-manifestacoes-na-ouvidoria
- https://ajuda.feedz.com.br/pt-BR/articles/6480278-como-mudar-o-nome-padrao-da-pessoa-ouvidora
- https://ajuda.feedz.com.br/pt-BR/articles/6480286-como-mudar-o-nome-do-modulo-de-ouvidoria
- https://ajuda.feedz.com.br/pt-BR/articles/6480164-como-alterar-a-mensagem-de-explicacao-da-ouvidoria
- https://ajuda.feedz.com.br/pt-BR/articles/6836926-como-permitir-que-uma-pessoa-gerencie-a-ouvidoria
- https://ajuda.feedz.com.br/pt-BR/articles/6480188-como-alterar-a-imagem-da-pessoa-ouvidora
- https://ajuda.feedz.com.br/pt-BR/articles/6480135-como-adicionar-e-editar-as-categorias-da-ouvidoria
- https://ajuda.feedz.com.br/pt-BR/articles/6480084-como-enviar-uma-manifestacao-para-a-ouvidoria
- https://ajuda.feedz.com.br/pt-BR/articles/9797161-como-acompanho-uma-manifestacao-criada-por-mim-na-ouvidoria
- https://ajuda.feedz.com.br/pt-BR/articles/9797216-como-acompanho-uma-nova-manifestacao-na-ouvidoria
