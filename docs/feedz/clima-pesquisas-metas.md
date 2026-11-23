# Engenharia reversa do Feedz (TOTVS RH): Clima, Pesquisas, Objetivos e Incentivos

Fonte: central de ajuda pública (ajuda.feedz.com.br), lida em 16/11/2026. Tudo abaixo vem dos artigos; o que não consta está marcado como "não documentado". Itens de "modelo de dados" são inferidos dos campos citados (tipos prováveis são suposição nossa).

Convenções: "RH/admin" = perfil Administrador; permissões são concedidas por pessoa em Pessoas > Colaboradores > Editar > aba Permissões. Em quase todo artigo o aviso é "verifique se você tem essa permissão junto ao seu RH" (a permissão exata quase nunca é nomeada).

---

## 1. Pesquisas (visão geral dos tipos)

Quatro tipos principais (artigo "Qual a diferença entre as pesquisas"), mais Desligamento e Riscos Psicossociais:

| Tipo | Perguntas | Anonimato | Periodicidade |
|---|---|---|---|
| Pesquisa de Engajamento (= Pesquisa de Clima) | várias, em dimensões (benefícios, bem-estar, gestão, saúde mental) | anônima; colaborador pode optar por se identificar (configurável) | pulsada ou pulso único |
| Pesquisa de Satisfação (e-NPS) | 1 (probabilidade de recomendar a empresa) | sempre anônima, nem admin quebra | não documentada |
| Super Pesquisa | várias, com dimensões opcionais | opcional, definida pelo admin | envio único (data de encerramento) |
| Pesquisa Rápida | 1 única pergunta | opcional (anônima ou aberta) | envio único (data de encerramento) |
| Pesquisa de Desligamento | perguntas livres, sem limite | respostas anônimas | link por colaborador |
| Mapeamento de Riscos Psicossociais (NR-01) | 35 fixas | anônima | pulso único |

Menu: lateral > **Pesquisas** > (Pesquisa de Engajamento | Pesquisa Rápida | Super Pesquisa | Pesquisa de Satisfação | Pesquisa de Desligamento | Mapeamento de Riscos Psicossociais | Plano de Ação).

Regra geral de anonimato (artigos de anonimato): nas pesquisas anônimas nem os administradores da plataforma conseguem ligar resposta a usuário. Nos comentários durante a resposta aparecem só as identificações "colaborador" e "administrador". As perguntas da Engajamento são enviadas "aleatoriamente" aos usuários, não direcionadas.

Permissões de pesquisa: Engajamento e demais exigem permissão no perfil (seção "Pesquisas" da aba Permissões). Gestor pode criar Super Pesquisa só para o próprio time e só se tiver a permissão ativa. Existe um artigo "Guia completo: Configurando permissões de acesso nas pesquisas" (citado, não lido, fora da coleção).

---

## 2. Clima e Engajamento (Pesquisa de Engajamento)

### 2.1 Propósito e menu
Mede o quanto os colaboradores se sentem valorizados, por dimensões, e gera plano de ação. Menu: **Pesquisas > Pesquisa de Engajamento**. Há o "Modelo Feedz" (pesquisa padrão) e a seção "Pesquisas customizadas" (botão **Criar Pesquisa**).

### 2.2 Perfis e permissões
- Administrador: tudo; vê e responde comentários (recurso visível só para Admin).
- Gestor/colaborador: dependem de permissão em Pessoas > Colaboradores > Editar > Permissões > Pesquisas. Exemplo nomeado: "Permite visualizar o resultado da Análise de Comentários" (Admin já tem por padrão; pode ser concedida a Gestores e Colaboradores).
- Líder atual vê somente as respostas recebidas no período em que esteve na liderança.
- Anonimato: configurável por pesquisa (ver 2.3, etapa 4). Corte mínimo: campo "Respondentes necessários por departamento e grupo"; com valor 2, o gráfico só aparece com 3 respondentes ou mais (mais que 2).
- Existe artigo citado "Como permitir que alguém gerencie a pesquisa de engajamento como administrador?" (não lido, fora da coleção).

### 2.3 Modelo de dados inferido
**Pesquisa** (4 etapas de configuração):
1. Informações iniciais: nome (texto, obrigatório), descrição.
2. Participantes, duas formas de segmentação combináveis (interseção: só recebe quem atende a todos os campos preenchidos):
   - Por tempo de admissão: "Periodicidade da admissão" (tempo mínimo de casa; valores: 3 semanas, 1, 2, 3 e 6 meses); "Data de corte" (admitidos após a data não recebem; admitidos até a data, inclusive, recebem).
   - Por Unidade/Departamento/Grupo: Departamentos participantes (obrigatório; para empresa toda, tag "Toda empresa"), Grupos participantes (opcional), Unidades participantes (opcional).
3. Dimensões e perguntas: **Dimensão** (nome; botão Adicionar Dimensão), com subdimensões (citadas em "não é possível editar dimensões, subdimensões ou perguntas após ativar"); **Pergunta** (todos os campos obrigatórios; habilitar/desabilitar perguntas existentes por dimensão).
4. Disparo: tipo (Pulsado | Pulso único); Quantidade de perguntas por pulso; Dia(s) da semana de envio (múltipla escolha); Respondentes necessários por departamento e grupo (inteiro); Exibir opção de remover anonimato (Sim/Não; no pulso único o anonimato "já vem marcado por padrão").

**Tipos de resposta da pergunta:** Escala (5 estrelas, caixa de texto opcional); NPS (escala de notas; comentário pode ser obrigatório para notas abaixo de um número escolhido); Múltipla Escolha (uma opção; opções editáveis; texto opcional); Caixa de seleção (várias opções); Texto Livre (só caixa de texto); Distribuição de pontos (100 pontos fixos para distribuir entre opções).

**Resposta/Comentário:** nota/seleção, texto, identificação (anônima ou identificada quando o colaborador opta), data; comentários podem ser respondidos pelo admin (gera notificação ao autor).

**Ciclo de perguntas (por usuário):** cada usuário tem seu próprio ciclo; novo ciclo só começa quando ele mesmo responde todas as perguntas ativas (antes era ciclo único global, e o primeiro a terminar reiniciava para todos).

**Histórico de liderança:** o líder direto é gravado no momento do disparo ao liderado (regra retroativa a partir de 14/03/2025); mudança posterior de líder não altera o dashboard daquela resposta. Histórico analisado até 10 níveis hierárquicos. Líderes desligados passam a aparecer no filtro de líderes.

### 2.4 Fluxo e estados
1. Configurar (3 pontinhos > Configurar), pré-visualizar (rodapé "Pré-Visualizar" > "Responder agora"; só simulação, não compartilhar a URL).
2. "Salvar Configuração" (rascunho) ou "Ativar Pesquisa".
3. Pulsado: primeiro envio no próximo dia de envio configurado (não no dia da configuração). Pulso único: envio imediato a todos, todas as perguntas ativas na ordem configurada; para interromper, editar e clicar "Parar pesquisa".
4. Colaboradores respondem; admin acompanha em "Ver resultado".
Estados citados: configurada/salva, ativa, inativa (editar permite ativar/inativar), parada. Lista formal de status: não documentada.
Restrições após ativar/disparar: não excluir o disparo/pulso, não resetar informações, não duplicar a Pesquisa Feedz nem Customizada (no artigo de pulso único; o artigo "Como duplicar" descreve duplicar via 3 pontinhos > Duplicar > "Duplicar pesquisa", inclusive a padrão — contradição não resolvida), não alterar configurações nem editar dimensões/perguntas. Alterar "Quantidade de perguntas enviadas por disparo" (aba 4-Disparo) vale só para o próximo disparo.
Link compartilhável: 3 pontinhos > "Copiar link da pesquisa"; um link por pesquisa; exige login; após login, o colaborador recebe link próprio "único e intransferível".

### 2.5 Cálculos
- **Favorabilidade** = (respostas com nota 4 ou 5 ÷ total de respondentes) × 100 (artigo de benchmark; implica escala 1-5).
- **Participação (%)** = respondentes ÷ participantes × 100; **média de participação dos pulsos** = soma da participação por pulso ÷ número de pulsos.
- **Média por dimensão**: citada (comparada no benchmark), fórmula não documentada.
- **eNPS/NPS em pergunta tipo NPS**: promotores 9-10, neutros 7-8, detratores 0-6; NPS = %promotores − %detratores (−100 a 100); exibição com 2 casas decimais desde 08/01/2026 (cálculo usa valores reais, não arredondados).
- Cores do mapa de calor: vermelho = ruim, azul = bom; limites numéricos não documentados. Benchmark: verde muito bom, laranja bom, vermelho atenção; limites não documentados.
- Comparação entre períodos: dashboard tem "histórico de participação por pulso" e filtro por data de início/fim; comparação lado a lado entre pesquisas/períodos: não documentada.

### 2.6 Configurações
Itens acima (etapas 1-4), Permissões, "Habilitar criação de Pesquisa de Desligamento" (ver 2.9). Texto da pergunta eNPS fica em Configurações (ver 3.4).

### 2.7 Notificações e lembretes
- Lembrete: Pesquisas > Pesquisa de Engajamento > **Ver resultado** > **Enviar lembrete**; só com pesquisa ativa; só para quem não respondeu; canal/texto/frequência não documentados.
- Resposta a comentário notifica o colaborador.
- Exportação: aviso no sininho quando o relatório fica pronto.
- Plano de ação: e-mail ao criar e lembretes automáticos perto do prazo (ver 2.8).

### 2.8 Relatórios, painéis, filtros, exportações
Ver resultado, abas: **Dashboard** (participação do período, participação geral detalhada, gráficos por pergunta conforme tipo NPS/Escala/Caixa de seleção/Múltipla escolha/Texto livre), **Comentários**, **Mapa de calor** (cruza dimensões/perguntas × equipes; filtros: data início/fim, papéis dos respondentes, unidades, grupos, departamentos, liderados diretos e/ou indiretos de líderes específicos; botão Aplicar), **Benchmark** (só no modelo padrão; compara médias e favorabilidade por dimensão com todas as pesquisas padrão da Feedz desde 2018; não separa por setor), **Análise de comentários** (IA: classifica comentários em positivo/negativo/neutro por dimensão e subdimensão; exporta para Excel; precisa de permissão).
Exportações: Dashboard, Comentários e Mapa de calor (ícone de download; mapa em XLSX; gráficos de participação em XLS ou PDF); gerado de forma assíncrona. Colunas/formato do dashboard: não documentados. Filtro por tempo de casa: só como critério de público (admissão), no mapa de calor não citado.

**Plano de Ação (módulo ligado à pesquisa de clima)** — menu Pesquisas > Plano de Ação; ou botão "Criar Plano de Ação" no resultado da pesquisa (alguns campos vêm preenchidos).
- Permissão: aba Permissões > Pesquisas (a geral dá criar, ver todos, editar, excluir); exige módulo Engajamento ativo.
- Plano: Data inicial (obrig.), Data final (obrig.), Nome (obrig.), Descrição (opc.), Responsáveis (obrig., até 10; editam/excluem o plano e concluem ações), Origem do plano (opc.; opções não documentadas).
- Ação (até 20 por plano): Nome (obrig.), Prazo (obrig.), Responsáveis (obrig., até 10).
- Fluxo: salvar > confirmação "Salvar e Criar Plano de Ação"; ação: "Marcar como concluído"/"Desfazer conclusão"; plano: 3 pontinhos > "Marcar como concluído" (só quem tem permissão do módulo ou é responsável do plano); após concluir o plano não edita ações; editar/excluir plano (responsável ou admin); excluir ação pelo ícone de lixeira. Status: em andamento e concluído (lista formal não documentada).

### 2.9 Pesquisa de Desligamento (subcoleção de Clima)
Menu Pesquisas > Pesquisa de Desligamento > **Criar Pesquisa**. Habilitar: Pessoas > Colaboradores > Editar > Permissões > Pesquisas > seção Pesquisa de Desligamento > "Permite administrar pesquisas" (exige módulo Clima contratado). Abas: 1 Informações básicas (nome, descrição); 2 Perguntas (livres, sem limite, reordenáveis); 3 Link de participação ("Gerar link de participação": escolher participante, tipo **Pesquisa de Desligamento** ou **Entrevista de Desligamento**, Gerar link, Copiar link). Regras: link único por colaborador (ativo ou desligado), uma resposta por colaborador. Resultado ("Ver resultado"): enviados, respondidos, todas as respostas, exportação; respostas anônimas.

### 2.10 Mapeamento de Riscos Psicossociais (NR-01)
Menu Pesquisas > Mapeamento de Riscos Psicossociais > **Criar pesquisa**.
- Permissões (por colaborador, seção Pesquisas): "Permite administrar pesquisas" (criar, editar, enviar, ver resultados) ou "Permite visualizar pesquisas" (só resultados); artigo orienta marcar uma.
- Etapas: 1 Título (obrig.), Descrição (opc.); 2 Participantes (Departamentos, Unidades, Grupos; mínimo um); 3 Perguntas (35 fixas, só leitura); 4 Disparo (pulso único; regra de anonimato por número mínimo de respondentes, valor não documentado). Finalizar: "Criar Pesquisa" > aceitar "Termos e Condições" > "Finalizar pesquisa". Após disparo não edita participantes nem fatores/perguntas. Link pode ser enviado sem login. Participação voluntária e anônima.
- 7 dimensões: Exigências, Controle, Apoio da chefia, Apoio dos colegas, Relações de trabalho, Papel na empresa, Mudanças. Escala Likert 1 a 5 (rótulos de "Nunca/Discordo totalmente" a "Sempre/Concordo totalmente"). Base: HSE-IT, ISO 45003, OMS. (Na criação o artigo cita 4 fatores para as 35 perguntas: Demandas, Controle, Apoio da liderança, Relacionamentos; divergência com as 7 dimensões do guia.)
- Cálculo: nível de risco = Probabilidade (P) × Severidade (S). P por % de frequência: 1 Rara <5%; 2 Remota 5-20%; 3 Moderada 21-50%; 4 Provável 51-80%; 5 Muito provável >80%. S de 1 (muito baixa) a 5 (crítico). Pesos iniciais por fator: 5 Demandas e Relacionamentos; 4 Apoio da chefia e Papel; 3 Controle, Apoio dos pares e Mudanças (ajustáveis por profissional habilitado). Classificação: Aceitável, Moderado, Significativo, Crítico, Intolerável (matriz está em imagem, não documentada).
- Resultados: participação (%), pessoas que responderam, receberam ao menos uma vez; resultados por Departamentos/Unidades/Grupos com busca; por fator: severidade, probabilidade, risco, classificação; glossário. Só exibe com o mínimo de respondentes. Exportação: não documentada.
- Finalizar pesquisa: Configurar > etapa 4 Disparo > "Finalizar pesquisa" (encerra ciclo; novos dados exigem nova pesquisa). Não substitui o PGR; validação por Médico do Trabalho, Eng. de Segurança ou Psicólogo; plano de ação obrigatório.

### 2.11 Ligações com outros módulos
Plano de Ação (acima); Gamificação e outros só aparecem como "artigos relacionados". Avaliação de desempenho/PDI: não documentado nesta coleção.

### 2.12 Lacunas
Lista oficial de dimensões e perguntas do Modelo Feedz; fórmula da nota por dimensão; limites de cor do mapa de calor/benchmark; periodicidade mínima entre pulsos; valores mínimos de respondentes recomendados; formato exato das exportações; status formais; canal dos lembretes.

---

## 3. Pesquisas (Rápida, Super Pesquisa e Satisfação eNPS)

### 3.1 Pesquisa Rápida
- Menu: Pesquisas > Pesquisa rápida > **Nova pesquisa**.
- Campos obrigatórios: Pergunta principal; Departamento (destino); Data de encerramento (sem horário); Tipo de pesquisa (anônima ou aberta); Tipo de resposta (texto, escala ou múltipla escolha). Opcionais: Descrição, Grupos específicos, Imagem. Participantes: regra de **união** (quem tem departamento, unidade ou grupo informado).
- Disparo ao clicar "Criar Pesquisa". Lembrete: abrir a pesquisa > "Enviar Lembrete" (mensagem escrita; só para quem não respondeu). Resultados: Ações > Resultados; Exportar (planilha; formato não especificado). Excluir: Ações > Apagar (remove resultados, irreversível).
- Lacunas: opções de escala e de múltipla escolha, edição pós-envio, permissões, gráficos do resultado.

### 3.2 Super Pesquisa
- Menu: Pesquisas > Super pesquisa > **Nova Pesquisa**.
- Etapa 1 Público: Papel, Unidades, Departamentos, Grupos, Lideranças (diretos/indiretos), Colaboradores, Datas de admissão inicial e final (só se datas atualizadas), Outros Participantes (recebem mesmo sem atender aos filtros). Filtros em interseção.
- Etapa 2 Informações: título, descrição, data de encerramento, anônima (sim/não), permitir voltar às perguntas anteriores.
- Etapa 3 Perguntas: Dimensão (opcional), texto, tipo de resposta, obrigatória (sim/não); tipos disponíveis não listados no artigo (os tipos NPS, escala, múltipla escolha, texto aparecem em relatórios).
- Etapa 4 Envio: Enviar > conferir nº de respondentes > "Enviar agora".
- Edição: antes de respostas, tudo editável; depois, só participantes, data de encerramento e nome (Detalhes > Editar > Salvar > Enviar/"Enviar Agora!"). Duplicar: Detalhes > Duplicar. Deletar: Detalhes > Deletar (remove resultados, irreversível).
- Resultados: Detalhes > Ver resultado; lembrete na tela de resultados. Exportar (rodapé > Exportar): relatórios **Por pergunta**, **Por colaborador** (nome, tempo de casa, respostas; anônimo sem nome) e **Por dimensão**; gerado e enviado por e-mail e notificação no sino; gráfico individual tem ícone de download.

### 3.3 Comentários e comparação
Comentários podem ser respondidos pelo admin (eNPS e Engajamento); Super Pesquisa cita "permitir que alguém responda comentários" em artigo relacionado.

### 3.4 Pesquisa de Satisfação (eNPS)
- Menu: Pesquisas > Pesquisa de Satisfação > **Novo E-NPS** (canto superior direito).
- Campos de envio: "Selecione os departamentos desejados" (ou toda a empresa); "Data de encerramento"; "Comentário será obrigatório para nota abaixo" (nota ou nenhuma); "Selecione os grupos desejados" (opcional); "Apenas participantes com data de admissão inferiores a" (corte; muitas empresas usam 3 meses). Interseção entre filtros. Botão "Criar pesquisa".
- Pergunta padrão editável em Configurações > Configurações > seção Pesquisas > "Texto referência pesquisa E-NPS" > Salvar (efeito em pesquisas já enviadas: não documentado).
- Detalhes: botão Ativar/Desativar; Ver resultados; Exportar (rodapé; planilha, extensão citada ".xsl").
- Cálculo: nota 0-10; promotores 9-10, neutros 7-8, detratores 0-6; eNPS = %promotores − %detratores; 2 casas decimais; neutros fora da conta.
- Análise de Sentimentos (IA): botão "Gerar Análise de Sentimentos" na página de resultados (só após a data final); processa por minutos/horas; avisa pelo sino (sem e-mail). Saídas: Sem categoria, Sentimento geral, Tópicos mais mencionados (5), Quantidade de sentimentos (pode ser maior que comentários), Neutros.
- Comentários: Detalhes > Ver resultados > rolar até comentários > balão > Responder (só Admin; notifica o autor).
- Lacunas: periodicidade, corte mínimo de respondentes do eNPS, gráficos e filtros dos resultados (não descritos).

---

## 4. Objetivos e Metas (OKR/KPI)

### 4.1 Propósito e menu
Gestão de OKRs (objetivos estratégicos) e KPIs (métricas). Menu lateral: **Objetivos** (lista/Gestão de Objetivos, botão **Novo objetivo**, mapa de objetivos, ícone de lixeira para deletados, ícone de download). Configurações: **Configurações > Gerenciar Objetivos**.

### 4.2 Perfis e permissões
- Quem cria/edita OKRs (configurável): colaborador, gestor ou líderes de objetivos; opção "Apenas usuários com perfil de gestor podem criar objetivo".
- **Líderes dos objetivos**: acesso administrativo (criar, editar, alterar qualquer objetivo, exceto privados), lista em Configurações.
- Responsável: atualiza, edita e exclui o objetivo. Contribuintes: ajudam. "Colaboradores que podem editar": alteram configurações sem necessariamente contribuir. Editar KR: só responsável do KR ou pessoa que pode editar. Excluir KR/check-in: responsável pelo objetivo ou KR. Check-in: dono ou participante. Plano de ação: só vinculados ao objetivo/KR/dono da ação.
- Objetivos privados: opção "Habilitar criação de objetivos privados"; "Configuração de objetivos privados" define visibilidade; líderes veem só privados em que são contribuintes/têm permissão. Em objetivo privado com aprovação, o avaliador precisa ser visualizador.
- Recuperar deletados: só Admin. Resumo de objetivos: "verifique se gerencia o módulo como líder".

### 4.3 Modelo de dados inferido
**Objetivo:** Descrição (texto); Atividade (flag: progresso do filho aparece no pai); Responsável; Contribuintes (várias pessoas); Área (departamento); Hierarquia (objetivo pai ou "objetivo sem pai"); Período (nome + início + fim, cadastrados em Configurações); Privacidade (Público | Privado); Colaboradores que podem editar; Etiquetas; Fluxo de Aprovação (Aprovação de Resultados-Chave, Avaliadores do Resultado-Chave, Aprovação Check-in); anexos (check-in). Obrigatórios: não documentado.
**Resultado-chave (KR/meta):** Nome; Descrição; Responsável; Tipo de meta (valores citados: Financeiro, Porcentagem, Número; lista completa não documentada); Tipo de moeda; Valor inicial (opcional); Meta a atingir; Peso; Forma de avanço (Linear | Com intervalos); Plano de ação (descrição da ação, responsável, prazo; um plano por KR; marcação de concluído por caixinha); Etiquetas; ordem (reordenável); KR compartilhado (aponta para KR de origem).
**KR não linear (habilitado pela Feedz sob pedido):** só tipos Financeiro/Porcentagem/Número; tipo de cálculo **Fixo** ou **Progressivo**; intervalos com "Entre os valores" e "% da meta" (aceita >100%); padrão 2 intervalos; ilimitados; remover a partir de 3. Fixo: dentro do intervalo, progresso = % definido. Progressivo: interpolação linear entre os % (fórmula inferida pelo próprio artigo: % inicial + (valor − início)/(fim − início) × (% final − % inicial)).
**Check-in:** Descrição da atualização (obrig.); Novo status (obrig.); valores dos KRs; nível de confiança (emoji, pergunta "Como vocês está se sentindo com relação a este objetivo?"); anexos (imagem inline, imagem/GIF/PDF; limites não documentados); mínimo de caracteres configurável; individual (por KR) ou coletivo (todos os KRs do objetivo; também "atualizar metas simultaneamente"). Exclusão: o artigo descreve excluir o KR (não só check-in).
**Nível de confiança:** emojis (pouco confiante, neutro, confiante), ativável em Configurações.
**Período anual:** deve cobrir exatamente 1 ano para a opção "Exibir os objetivos anuais...".

### 4.4 Fluxos e estados
1. Criar objetivo (Objetivos > Novo objetivo > Salvar) > criar KRs ("Novo resultado") com plano de ação opcional.
2. Check-ins periódicos (individual/coletivo); anexos; nível de confiança.
3. Fluxo de aprovação (opcional, só Admin ativa; exige módulo Objetivos): Configurações > Gerenciar Objetivos > Fluxo de Aprovação > "Habilitar Fluxo de Aprovação"; escolher se vale para KR, check-ins ou ambos; opções: "Tornar Aprovação ... obrigatória", "Quem pode avaliar..." (por papel, por objetivo), "Avaliadores Globais". Telas "Aprovação de Resultados": abas **Pendentes**, **Aprovados**, **Reprovados**. Reprovar exige justificativa; aprovar não permite pedir ajustes depois; criador ajusta e "Enviar para aprovação" volta a Pendentes. Aviso na tela inicial ao aprovador.
4. Encerramento do período; "Dias após o encerramento do período para criar resultados-chave ou check-ins" (0 bloqueia).
5. Deletar (engrenagem > Apagar); recuperar (lixeira > Histórico de Objetivos e Resultados Chaves > Recuperar; meta apagada com objetivo exige recuperar o objetivo antes).
Estados do objetivo/KR: em andamento/em progresso, atenção/sem atualização, atrasado (config de dias), concluído (plano de ação); lista formal: não documentada.

### 4.5 Cálculos
- Objetivo sem pesos: média dos atingimentos dos KRs = (RC1 + ... + RCn) ÷ n. Exemplo 100% e 50% = 75%.
- Com pesos: contribuição = status × peso / 100; soma das contribuições; exemplo pesos 75/25 e status 100%/50% = 87,5%, arredondado 88% (a Feedz sempre arredonda).
- **Limite do resultado** (padrão 100): KR acima do limite entra na média com o limite; exemplo limite 300, KRs 127% e 800% = (127+300)/2 = 213,5 ≈ 214%; KR pode exibir percentual sem teto.
- Objetivo sem KR pode usar média dos objetivos filhos (opção; pai sem resultados cadastrados).
- KR compartilhado: check-in em um reflete no outro; peso só afeta o objetivo onde está; excluir a origem exclui os compartilhados; precisa estar em objetivo público.
- **Cor do progresso:** vermelho até 40%, amarelo 41-69%, verde acima de 70% (do esperado para o período, se a opção estiver ligada; senão da meta final). Esperado proporcional ao tempo (exemplo trimestre de 12 semanas). Cor do objetivo = média dos KRs. Artigo admite lacunas/inconsistências nas faixas.
- Acompanhamento/Distribuição/Projeção (só metas Numérica, Financeira, Porcentagem): distribui a meta no período, insere valor de projeção por parcela, acompanhamento semanal; desvio em valor = check-in − meta (ou projeção); desvio % = desvio ÷ meta (ou projeção) × 100; meta semanal = meta ÷ dias do mês × dias do período semanal.
- Comparação entre períodos: via filtros de período; comparação automática não documentada.

### 4.6 Configurações (Configurações > Gerenciar Objetivos)
Dias restantes para notificar o fim; dias sem check-in para considerar atraso; dias após o encerramento para criar KR/check-in; mínimo de caracteres no check-in; limite do resultado (100); quem cria/edita OKRs; quem vê privados; objetivos sem KR calculados pelos filhos; filtro padrão só período atual; exibir anuais; permitir peso (vale para KR e metas); cor do progresso conforme esperado; nível de confiança; só gestor cria; habilitar privados; períodos (Nome do Período, Data de Início, Data de Término; "Adicionar período"/Excluir); líderes dos objetivos; fluxo de aprovação. Filtros favoritos (estrela, nome, opção "Adicionar filtro para toda a Empresa", excluir pelo X).

### 4.7 Notificações
Aviso de fim do período; aviso de atraso na tela inicial do dono do resultado (ex.: check-in semanal, aviso no 8º dia); aviso ao aprovador na tela inicial. Frequência/destinatários exatos e e-mail: não documentados. Check-ins podem gerar moedas na gamificação (período do campo de atraso define a pontuação).

### 4.8 Relatórios e visualizações
Barra de progresso por objetivo, seta para KRs e histórico de check-ins; Mapa de objetivos (pais e filhos ativos, respeita filtro, zoom, PDF, nova guia, modo monitor); Resumo (Objetivos > filtrar > ícone de informações; indicadores: progresso geral, nº objetivos, nº KRs, % em andamento, % em atenção/sem atualização, colaboradores sem objetivo; tabela com Departamento/Objetivos/Colaborador, último check-in, status, gestor, responsável, nº metas, média das metas e dos objetivos; Exportar "Excel (.xml)"); exportação de dados (ícone de download; relatórios disponíveis e colunas: não documentados); histórico de deletados.

### 4.9 Ligações
Incentivos (metas vinculadas aos grupos de metas); Avaliação de Desempenho (existe artigo "vincular resultados dos objetivos e metas à Avaliação de Desempenho", não lido, fora da coleção); Gamificação (moedas por check-in); PDI e Celebrações aparecem só como relacionados.

### 4.10 Lacunas
Lista de tipos de meta e de moeda; obrigatórios; limite do peso; alinhamento em cascata além de pai/filho; escalas de confiança; status formais; formatos de exportação; retenção de deletados.

---

## 5. Incentivos (PLR/bonificação por metas)

### 5.1 O que é e menu
Módulo de programas de incentivo para pagamento de bonificação (descrito como "bônus de participação nos lucros") calculado por múltiplo salarial × atingimento de metas × tempo trabalhado. Não é loja de pontos. Menu lateral: **Incentivos** (tela "Programas de Incentivos", abas incluem Finalizados, botão **+ Novo programa**). Cadastro de grupos de cargos: Configurações > Cargos.

### 5.2 Perfis e permissões
Permissão "Incentivos" concedida pelo administrador por colaborador (Permissões > Incentivos); para limite: "Incentivos: administrar programas de incentivo" + "Departamento Pessoal: visualização do campo remuneração". Ver resultados/memória de cálculo exige permissões de ver salário.

### 5.3 Modelo de dados inferido
**Programa:** nome (obrig.), descrição, data início, data encerramento, casas decimais para cálculos, data limite para considerar check-in nas metas (todos obrigatórios exceto descrição); status: Rascunho, Ativo, Pronto para pagamento, Finalizado.
**Elegibilidade (critérios):** tipo de contrato, unidades, departamentos, cargos, grupo de cargos (≥1 grupo por categoria; interseção).
**Múltiplo salarial:** por critério (vínculo/unidade/departamento/cargo/grupo de cargos), valor > 0 (0,5 = até 50% do salário); "Definir valor para todos".
**Regras individuais:** assiduidade (mín. meses ativos na empresa; mín. meses trabalhados no período; mín. dias para mês integral), desligamentos (elegibilidade por motivo; opcional), movimentações internas (departamento e cargo: "última posição" ou "posição de maior tempo"; salário: última posição, maior tempo, média entre salários ou salário vigente).
**Grupo de metas:** nome (5-100 caracteres), atingimento mínimo (obrig.; abaixo = 0%), atingimento máximo (opc.), gatilho de pagamento, variação do múltiplo salarial, aplicação (Todos os elegíveis | Por departamento | Por cargo | Individual). Metas vinculadas vêm do módulo Objetivos (Ver detalhes > Grupos de metas > Vincular metas > objetivo e meta).
**Fórmula de pagamento:** nome, unidades/vínculos/cargos/departamentos aplicáveis, estrutura com variáveis (F, G, M, T, D, S) e operadores + − × ÷ % e parênteses; "Validar fórmula"; exemplo F = G × M × T / D (artigo do fator multiplicador). Variáveis na versão antiga: Múltiplo Salarial, Meses Trabalhados, Meses Totais do Programa, Grupos de Metas.
**Participante (base de elegíveis):** elegível/não elegível, múltiplo salarial, meses trabalhados, justificativa; "Restaurar padrão". Colaboradores sem data de admissão ou remuneração podem ficar fora.
**Grupo de cargos:** nome (obrig.); um cargo em só um grupo; sem grupo = "Sem grupo de cargos definido".
**Limite de pagamento:** flag + valor.
**Importação em massa:** colunas Identificador (e-mail ou CPF, obrig.), Elegibilidade ("Elegível"/"Não Elegível"), Múltiplo Salarial (até 2 casas), Meses trabalhados (limitado à duração).

### 5.4 Fluxo e estados
Criar (6 telas: Configurações gerais, Critérios de elegibilidade, Múltiplo salarial, Regras individuais, Grupos de metas, Fórmulas de pagamento; "Concluir e ativar") > Ativo > gerar **Base de elegíveis** (só a partir da data de início; Excel) > editar elegíveis/importar em massa (só programa ativo) > vincular metas > aba **Resultado** > "Gerar Resultado Individual" (coluna "Valor a pagar"; "Valor indefinido" sem salário) > Pronto para pagamento (limite opcional) > **Finalizar programa** (irreversível, após pagamento, vai para "Finalizados"). Duplicar: 3 pontinhos > "Criar uma cópia" (origem ativa ou finalizada; cópia em Rascunho; notifica). Importação tem histórico (planilha, data/hora, responsável, status; "Atualizada com erros" devolve planilha com erros).

### 5.5 Cálculos
- Bônus máximo = salário base × múltiplo salarial.
- Fator multiplicador F = (atingimento das metas) × (múltiplo) × (meses trabalhados) ÷ (duração do programa em meses); exemplo 0,8 × 1,2 × 9/12 = 0,72 (72% do salário). Valor a pagar = salário × F (derivado do artigo, que diz que o salário base é multiplicado pelo fator).
- Mês trabalhado conta apenas se cumprir o mínimo de dias (exemplo 15 dias: admitido em 20/03 conta a partir de abril = 9 meses no ano).
- Atingimento do grupo: abaixo do mínimo = 0%; acima do máximo = máximo; gatilho não atingido zera pagamentos dos elegíveis.
- Limitação da bonificação: quando o total ultrapassa o limite, pagamentos individuais são ajustados proporcionalmente; fórmula do artigo está em imagem (não documentada). Limites por valor fixo ou % do EBITDA são citados como exemplo de prática.
- Memória de cálculo (programa ativo/finalizado): Resultado > colaborador > Ver detalhes; blocos Dados (colaborador e gestor direto), Detalhes do programa, Detalhes do cálculo (fórmula e fator), Atingimento dos grupos de metas, Detalhes do colaborador.

### 5.6 Relatórios
Base de elegíveis (exportar Excel), planilha de resultados individuais (aba Resultado > três pontos > Exportar), memória de cálculo por colaborador. Colunas e formato: não documentados. Notificações: só a de conclusão de duplicação.

### 5.7 Ligações
Objetivos e Metas (metas vinculadas aos grupos de metas); RH/Pessoas (cargo, departamento, admissão, remuneração, desligamento); Departamento Pessoal (salário). Avaliação de desempenho e gamificação: não documentado.

### 5.8 Lacunas
Estados exatos fora Rascunho/Ativo/Pronto para pagamento/Finalizado; fórmula de limitação; colunas das exportações; como o gatilho "variação do múltiplo" altera M numericamente; permissões granulares além de "administrar programas".

---

## 6. Exportação existente: INDICADORES CLIMA.csv (raiz do repositório)

- Não é uma exportação nativa do Feedz: é uma coluna única de texto (638 linhas, 1 campo por linha, sem cabeçalho de colunas, com BOM UTF-8), parecendo o despejo de uma planilha/quadro de trabalho de análise de clima feita pela empresa (workshop).
- Estrutura repetida por bloco de indicador: título do indicador (ex.: propósito, segurança, performance/meritocracia, reconhecimento, motivação, abertura a feedback, comunicação interna, suporte à saúde mental, equilíbrio trabalho-vida, felicidade); a pergunta/afirmativa da pesquisa (ex.: "1. Como vai o seu senso de propósito..."; afirmativas sobre gestores); para cada afirmativa, 4 valores percentuais decimais (somam 100, distribuição das respostas em 4 faixas; 218 linhas são só números); texto livre de práticas sugeridas agrupadas como Acelerar / Evitar / Começar (legenda "A- acelerar, B- evitar, C- começar"); textos de "Análise" por indicador; ao final uma matriz "Faça Primeiro (urgente)/Programe (menos urgente, mas importante)" de priorização.
- O período, o público e a pesquisa de origem não constam no arquivo. Não foram copiados respostas ou dados pessoais para este documento.
- Uso para o ORQESTRAI: indica o formato de "indicadores" (10 pilares) e plano de ação em 3 verbos (Acelerar/Evitar/Começar) e matriz de prioridade usados pelo escritório.

---

## 7. URLs lidas

Clima e Engajamento: collections 3587518, 14913387, 11749197, 3595735, 3595784, 3595869 e artigos:
https://ajuda.feedz.com.br/pt-BR/articles/12090165, /12088692, /12090759, /10641498, /10628006, /10591438, /10592158, /10628594, /6483424, /6483410, /6483381, /9773973, /6483482, /6483577, /9940178, /6483616, /6483632, /6483641, /9105590, /9887907, /9376279, /6483685, /6483743, /8757030, /10131923, /10134425, /10201035, /12816793, /12816629 (prefixo https://ajuda.feedz.com.br/pt-BR/articles/ + id; slugs no índice da central).

Pesquisas: collections 17053195, 3587536, 3587547, 3587527, 19540142; artigos /6482226, /6482765, /6483989, /6484137, /6482786, /6484078, /6482278, /6482291, /6482796, /6482380, /6483591, /6482761, /6484152, /9631551, /6484146, /6484170, /6484232, /6484250, /9112954, /6484274, /6484264, /6484294, /6484301, /8852047, /13342519, /16020536, /14698677, /14663351, /14698382, /14698477, /14698562.

Objetivos e Metas: collection 3587519; artigos /6488577, /6488589, /6545179, /6866149, /6571207, /6488578, /6762658, /6495900, /6542833, /6745009, /6848527, /6488839, /6488641, /6495920, /6542855, /6542887, /8233735, /8880923, /8856892, /8856931, /8837980, /9927527, /10370373, /11738694, /6495925, /6495929, /6488842, /6458331, /8694506, /11250292, /6549326, /6488680, /6488836, /6488686, /6488696, /6654209, /6488685, /6488692, /6488683, /6644722.

Incentivos: collection 9122726; artigos /9172373, /9157080, /9170958, /9170860, /9170916, /9170993, /9176093, /9170969, /9500408, /9170894, /9172350, /9170988, /9172357, /9829017, /9829122, /9829129, /9172365, /10099430, /10099744, /10275261, /10289404, /10542328.

Observação: os artigos foram lidos via resumo automático da página (WebFetch); imagens e GIFs dos artigos não foram interpretados.
