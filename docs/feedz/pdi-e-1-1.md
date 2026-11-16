# Feedz (TOTVS RH): Planos de Desenvolvimento (PDI, Trilhas, Onboarding) e Reuniões 1:1

Engenharia reversa feita a partir da central de ajuda pública (ajuda.feedz.com.br), em 16/11/2026.

**Fontes lidas**
- Coleção "Planos de Desenvolvimento": 22 artigos (subcoleções "Visão geral", "PDI", "Trilha de Desenvolvimento" e "Onboarding").
- Coleção "Reuniões 1:1": 14 artigos (subcoleções "Primeiros passos", "Criação e configuração", "Acompanhamento e relatórios").
- Todos os 31 release notes da coleção "Atualizações do Produto" (jan/24 a jul/26) e os 37 artigos de "Configurações" foram baixados e filtrados por palavra-chave. Os que falam de PDI ou 1:1 foram lidos inteiros.
- Para responder ao item 9 (ligações com outros módulos), também foram lidos 5 artigos de "Gestão e relatórios" e "Gamificação".
- Além do texto, foram lidas cerca de 90 capturas de tela dos artigos e quadros extraídos dos GIFs. Grande parte dos campos só aparece nessas imagens.

**Convenções**
- **"não documentado"**: a central não diz.
- *(captura)*: visto em imagem do artigo, sem estar escrito no texto.
- *(inferido)*: dedução de modelagem feita por nós, não texto da Feedz.
- *(release notes mês/ano)*: veio de nota de versão.
- As capturas são de épocas diferentes, de 2021 a 2026. Há duas gerações de tela: a antiga, com o logo "Feedz", e a nova, com o logo "TOTVS", vista nos artigos de 2025/2026 sobre IA e Afferolab. Quando os rótulos mudam entre as duas, as duas versões são citadas.
- No fim de cada parte, em "Lacunas", há um bloco **"Já respondido no levantamento logado"**. Ele cruza com `docs/feedz/telas-logado.md`, que tem as telas vistas dentro da conta da Bismarchi | Pires. É outra fonte e está separada de propósito.

---

# PARTE A. PLANOS DE DESENVOLVIMENTO (PDI, TRILHAS E ONBOARDING)

## A.1 Propósito e localização no menu

**Propósito** (artigos "Visão geral" e "Qual a diferença entre PDI, Trilha e Onboarding?"): é o módulo "Planos de Desenvolvimento", onde se criam, gerenciam e analisam três tipos de plano.

| Tipo de plano | Para quem | Definição da Feedz |
|---|---|---|
| **PDI** (Plano de Desenvolvimento Individual) | 1 pessoa | Plano com objetivos e prazos para desenvolver habilidades técnicas e/ou comportamentais **únicas** daquela pessoa ("conforme as suas especificidades, demandas e dificuldades"). |
| **Trilha de Desenvolvimento** | mais de 1 pessoa | Plano "em grupo", com habilidades **iguais para todos** da trilha. Feito a partir de um modelo da empresa para economizar tempo. Exemplos citados: cursos para futuros líderes, treinamento de nova plataforma, "Trilha de Avaliação de Desempenho para líderes". |
| **Onboarding** | colaborador novo | Integração do novo colaborador. Pode ser **Cultural** (valores, metas, objetivos) e **Técnico** (ferramentas, cursos, conhecimentos). É um onboarding único dividido em blocos por categoria. |

**Caminhos de menu documentados**

| Quem / para quê | Caminho exato | Tela que abre |
|---|---|---|
| Colaborador: ver, criar, editar e atualizar os próprios planos | Menu lateral **Desenvolvimento > Planos de Desenvolvimento**. Na captura o item tem o selo "Novidade!". O artigo de IA (2026) chama o item de **"Meus Planos de Desenvolvimento"**. | **"Meu Desenvolvimento"**, com abas Ativos / Finalizados / Expirados e botão "Criar um plano" |
| Gestor/Admin: gestão de planos de terceiros | Menu lateral **Gestão > Gestão dos Planos de Desenvolvimento** (selo "Novidade!" na captura) | **"Planos de Desenvolvimento"**, com três quadros: **Individuais**, **Trilhas**, **Onboardings** |
| Módulo antigo (legado) *(captura)* | **Desenvolvimento > Plano de Desenvolvimento (PDI)** (singular) e **Gestão > Painel de Plano de Desenvolvimento (PDI)** | Não documentado. É o módulo que está sendo desativado (ver A.4.16). |
| Admin: tipos de PDI | **Configurações > Configurações > PDI** *(release notes fev/24)* | Não documentado (só a flag citada) |
| Admin: IA do PDI | "configurações avançadas de PDI" (artigo do Aconselhador IA). O caminho exato não está documentado. | — |
| Admin: integração LMS | **Configurações > Integrações**, seção **"Integração Afferolab"** | — |
| Admin: moedas da gamificação | **Configurações > Gamificação** | "Configurações do Feedzcoins" |
| Gestor/Admin: plano de uma pessoa específica | Jornada do Colaborador (Gestão > Resumo de Atividades > clicar na pessoa, ou foto de perfil > Colaboradores > três pontinhos > "Jornada do Colaborador (Resumo)") | Bloco "Planos de Desenvolvimento do <pessoa>" |

**Submenus vistos nas capturas (geração antiga):**
- Menu lateral: Início, Celebrações, Desenvolvimento, Objetivos, Gamificação, Pesquisas, Gestão, Desempenho, Configurações.
- **Desenvolvimento**: Enviar Feedback, Feedbacks, Plano de Desenvolvimento (PDI), Planos de Desenvolvimento (Novidade!), Reuniões 1:1.
- **Gestão**: Dashboard, Painel de Engajamento, Painel de Plano de Desenvolvimento (PDI), Gestão dos Planos de Desenvolvimento (Novidade!), Humor, Resumo de Atividades, Histórico de 1:1, Histórico de Feedback, Gestão de Feedbacks, Diversidade, Turnover.

## A.2 Perfis e permissões

Papéis existentes na Feedz (artigo "Resumo de atividades"): **Administrador, Gestor, Colaborador, Visitante**. Os artigos de gestor, trilha, onboarding e exportação trazem o aviso **"Verifique se você tem essa permissão junto ao seu RH"**, o que indica permissões granulares além do papel.

| Ação | Colaborador (dono) | Gestor (líder direto) | Administrador / RH | Fonte |
|---|---|---|---|---|
| Ver os próprios planos (PDI, trilha, onboarding) em "Meu Desenvolvimento" | Sim, e só os próprios | Sim (os dele, como colaborador) | Sim (os dele) | Artigo "Como encontrar e acompanhar..." |
| Criar PDI para si | Sim, "sem bloqueios, quando o módulo está habilitado" | Sim | Sim | "Como gerenciar os PDIs" |
| Editar o próprio PDI | Sim, só se **ativo** | — | — | "Como editar o meu PDI?" |
| Atualizar progresso das tarefas do próprio plano | Sim | Não documentado se o gestor pode atualizar a tarefa do liderado | Não documentado | "Como atualizar o progresso..." |
| Ver a tela de Gestão dos Planos | Não documentado (aparentemente não) | Sim: **só os PDIs dos liderados** | Sim: **a empresa toda** | "Como gerenciar os PDIs" |
| Ver o próprio PDI na tela de Gestão | — | **Nunca** ("você nunca verá os seus próprios PDIs criados") | **Nunca** | Idem |
| Criar PDI para outra pessoa | Não | Sim, com permissão do RH | Sim | "Como criar um PDI para o colaborador?" |
| Editar PDI/Trilha/Onboarding de outra pessoa | Não | Sim, se o plano estiver ativo | Sim, se ativo | "Como o gestor pode editar um PDI?" |
| Finalizar plano de outra pessoa | Não documentado | Sim (botão "Finalizar" no painel do plano *(captura)*; na Jornada, "administradores e gestores diretos") | Sim | Jornada do Colaborador |
| Exportar planilha de PDI / Trilha / Onboarding | Não | Com permissão | Com permissão | Artigos de exportação |
| Ver/exportar coluna CPF no relatório de PDI | — | Só "pessoas autorizadas" | Só "pessoas autorizadas" | *(release notes jul/26)* |
| Editar modelo de Trilha / de Onboarding | Não | Com permissão | Com permissão | Artigos de modelo |
| Vincular Trilha / Onboarding a uma pessoa | Não | Com permissão | Com permissão | Artigos de vincular |
| Migrar dados do módulo antigo | — | — | Quem acessa Gestão dos Planos (o papel exato não está documentado) | "Como migrar dados..." |
| Configurar tipos de PDI, IA, integração | — | — | Admin. O "Gerar Token" da API só pode ser clicado por **Administrador**. | Release notes fev/24; artigo Afferolab |
| Usar o Aconselhador IA | Sim, se participar da AD escolhida e já tiver recebido respostas | Sim, para liderado nas mesmas condições | — | Artigo IA |

**Escopo do gestor**
- Padrão: **gestor direto**. A pessoa liderada fica ligada ao líder no próprio perfil, e não pode ter dois gestores diretos.
- Alternativa: **departamentos gerenciados**. O gestor passa a gerenciar todas as pessoas de um departamento e pode gerenciar mais de um departamento. Um departamento pode ter mais de um gestor. Precisa ser ativado pelo time da Feedz e **substitui** a gestão por gestor direto. (Artigo "O que são os departamentos gerenciados", em Configurações.)

**Permissionamento de Planos** *(release notes nov/24)*: "controlar o acesso aos módulos de PDI, Trilhas e Onboarding, definindo permissões para diferentes grupos, como gestores e departamentos". A tela não está documentada.

**Não documentado:** aprovação de PDI pelo gestor (não existe fluxo de aprovação descrito); visibilidade do PDI para pares; o que o papel Visitante vê; se o gestor pode excluir PDI do liderado.

## A.3 Modelo de dados inferido

Estrutura geral, igual nos três tipos: **Plano → Blocos → Tarefas**. Cada tarefa tem progresso. O texto da Feedz usa "atividade" e "tarefa" como sinônimos.

### A.3.1 Plano (`plano_desenvolvimento`)

| Campo (rótulo na interface) | Tipo provável | Obrigatório | Valores / observações |
|---|---|---|---|
| Modalidade | enum | sistema | `Individual` (PDI), `Trilha`, `Onboarding`. A etiqueta "Individual" aparece no card *(captura)*. |
| Colaborador (dono) | FK pessoa | sim | Escolhido no modal "Escolha qual colaborador irá realizar esse plano" (busca + Filtros). No PDI para si, é o próprio usuário. |
| Nome do plano | texto | sim na tela nova (asterisco) *(captura)* | Placeholder antigo "Nome do plano". Na tela nova aparece "Plano de Desenvolvimento (PDI)" *(captura)* (não está claro se é valor padrão ou placeholder). Nas telas de Trilha e Onboarding não aparece campo de nome *(captura)*. |
| Tipo | FK tipo de PDI (lista) | sim na tela nova | Padrões vistos no seletor *(captura)*: **Habilidades Técnicas, Liderança, Comunicação, Gestão**. Outros vistos em cards, possivelmente tipos criados pela empresa: "Plano de Ação", "Plano de voo", "Resultados". Primeira opção: "Selecione o tipo". Não aparece em Trilha/Onboarding *(captura)*. |
| Data de início | data | sim | Na tela antiga vem preenchida com a data do dia *(captura)*. |
| Tempo estimado de conclusão | inteiro + unidade | sim | Unidade por botões **Dias / Semanas / Meses**. Padrão na tela antiga: 0 Dias; no PDI novo: 30 Dias *(captura)*. |
| Previsto (data final prevista) | data calculada | — | *(inferido)* = Data de início + Tempo estimado. Bate com as capturas: 25/03/2023 + 3 meses = 25/06/23; 31/08/22 + 1 mês = 01/10/22. |
| Status | enum | sistema | Ativo / Finalizado / Expirado (ver A.5) |
| Progresso (%) | decimal calculado | sistema | Ver A.5 |
| "N de M tarefas" | contadores calculados | sistema | N = tarefas concluídas, M = total |
| Cargo, Departamento, Líder do dono | exibição (FK da pessoa) | — | Aparecem no cabeçalho do plano *(captura)*. Não documentado se ficam gravados no plano (retrato) ou se são lidos ao vivo. |
| Criado com IA | booleano | — | Não documentado na central. O levantamento logado achou `ai_advised`. |
| Criado por / datas de criação e finalização | auditoria | — | Não documentado. A tarefa concluída mostra data e hora *(captura)*. |

### A.3.2 Bloco (`plano_bloco`)

| Campo | Tipo | Obrigatório | Observações |
|---|---|---|---|
| Título do bloco | texto | sim na tela nova | Placeholder "Dê um título para esse bloco" (antiga) / "Ex.: Envio de Feedback" (nova) |
| Descrição do bloco | texto curto | **opcional** (rótulo "(opcional)" na tela nova) | Placeholder "Escreva uma descrição para esse bloco" |
| Ordem | inteiro | sistema | Tela nova tem alça de arrastar (⠿) nos blocos e nas tarefas *(captura)*. Arrastar para reordenar está *(inferido)*. |
| Tipo do bloco | enum + FK | só em **modelos** de Trilha/Onboarding | **Geral** ("para todos os seus liderados"), **Departamento** (+ qual) ou **Cargo** (+ qual). Etiquetas coloridas: Geral (roxo), Departamento (vermelho), Cargo (laranja) *(captura)*. |
| Progresso do bloco (%) e "N de M tarefas" | calculados | sistema | Ver A.5 |

### A.3.3 Tarefa (`plano_tarefa`)

Nomes do modal: "Edição de tarefa" na tela antiga, "Criar tarefa" na nova.

| Campo | Tipo | Obrigatório | Valores / observações |
|---|---|---|---|
| Nome da tarefa | texto | sim (asterisco na tela nova) | "o que o colaborador deve fazer? (Exemplo: assistir um vídeo, realizar um curso, etc.)" |
| Tipo da tarefa | enum | sim | **Atingido/Não atingido** ("A tarefa é determinada concluída quando o colaborador informar que foi finalizada") ou **Porcentagem** ("O progresso da tarefa pode ser atualizado aos poucos, em formato de porcentagem"). Textos da tela nova *(captura)*. Os artigos também escrevem "Concluído/Não concluído". Ícones na lista: bandeira para Atingido e "%" para Porcentagem *(captura)*. |
| Descrição da tarefa | texto rico (HTML) | não marcado como obrigatório | Editor com estilo, negrito, sublinhado, limpar formatação, fonte, cor/realce, listas, alinhamento, **tabela, link, imagem, vídeo e upload de PDF** *(captura)*. O artigo diz que dá para "inserir links, fotos, vídeo e demais arquivos". |
| Número/ordem | inteiro | sistema | Exibido como 01, 02… |
| Progresso | 0–100 | — | Porcentagem: campo numérico com setas e "%". Atingido: só concluir de uma vez. |
| Aprendizados | texto rico | não | Campo "Conte seus maiores aprendizados" (placeholder "Aprendizados"), preenchido ao atualizar o progresso |
| Data/hora de conclusão | datetime | sistema | Mostrada na tarefa concluída, ex.: "03/05/21 13:12" *(captura)* |
| Origem LMS (Afferolab) | FK curso externo + link | — | Quando vem da integração: nome, tipo (sempre Porcentagem) e descrição **não podem ser editados**. A tarefa mostra "O conteúdo pode ser acessado clicando aqui". |

**Histórico de atualizações de progresso:** não documentado. Não se sabe se cada "Atualizar Progresso" gera um registro com data e aprendizado, ou se só sobrescreve.

### A.3.4 Tipo de PDI (`plano_tipo`)

Há tipos padrão do sistema e tipos customizados pelo administrador. A flag "Habilitar/Desabilitar Tipo de PDI Padrão" *(release notes fev/24)*:
- **ligada** (padrão): os tipos padrão aparecem na criação;
- **desligada**: só aparecem os tipos criados pelo admin.

Os campos do tipo não estão documentados.

### A.3.5 Modelo de Trilha e Modelo de Onboarding (`plano_modelo`)

Há **um modelo por empresa** para cada tipo ("Editar modelo de trilha de desenvolvimento" e "Editar modelo de plano de onboarding"). Os blocos do modelo são segmentados por público.

| Campo | Tipo | Observações |
|---|---|---|
| Tempo estimado de conclusão | inteiro + Dias/Semanas/Meses | Captura do onboarding: 4 Semanas |
| Criação automática de onboarding | Ativa / Inativa | **Só no Onboarding** |
| Blocos | lista | Cada bloco tem tipo (Geral/Departamento/Cargo + alvo), título, descrição e "Conhecimentos" (lista de tarefas). No onboarding já existe um bloco **"Geral"** por padrão. |
| Busca de bloco + Filtros | UI | "Busque por um bloco" |

Texto da tela de onboarding *(captura)*: "Edição do plano de Onboarding. Aqui você pode editar o plano de Onboarding da sua empresa. As alterações realizadas aqui refletirão apenas nos novos planos de Onboarding." Ou seja, os planos já criados são cópias e não mudam com o modelo.

**PDI não tem modelo próprio.** "Criar a partir de um modelo" copia o PDI de outra pessoa (ver A.4.3).

### A.3.6 Configuração do módulo (`plano_config`, por empresa)

- Módulo habilitado/desabilitado ("quando o módulo está habilitado na plataforma").
- Exibição dos tipos padrão de PDI (flag).
- Avaliação de Desempenho usada como fonte do Aconselhador IA.
- Permissionamento de Planos (grupos com acesso a PDI, Trilhas, Onboarding).
- Restrição da coluna CPF no relatório.
- Integração Afferolab: ativar integração, Token Afferolab, Chave de Integração (API 2.0), Chave de usuário (e-mail ou CPF).

### A.3.7 O que NÃO aparece documentado como entidade

Comentários no PDI, check-ins periódicos, vínculo formal a **competências** (só a frase de subtítulo da tela nova: "definindo objetivos, competências e ações"), anexos fora da descrição, aprovação, histórico/log de alterações e prazo por tarefa (as tarefas não têm data própria nas capturas).

## A.4 Fluxos passo a passo

### A.4.1 Colaborador cria um PDI para si

1. Desenvolvimento > Planos de Desenvolvimento > botão **"Criar um plano"** (texto antigo: "Criar um novo plano").
2. Preencher Nome, **Tipo**, **Data de início** e **Tempo estimado de conclusão** (valor + Dias/Semanas/Meses).
3. **"Adicionar um bloco"** (ou "Adicionar novo bloco") → título e descrição do bloco.
4. **"Nova tarefa"** / "Adicionar nova tarefa" → modal com Nome, Tipo e Descrição → **"Salvar"**.
5. Repetir blocos e tarefas → **"Salvar alterações"** (tela antiga) ou **"Criar plano"** (tela nova).
6. Efeito: **o líder direto recebe um aviso por e-mail** assim que um plano é criado.

Na tela nova *(captura)* aparecem ainda os contadores "N blocos" e "N tarefas", o botão "Aprimorar meu plano com I.A." ou "Criar plano com I.A." e a busca "Pesquise por um bloco". O botão de bloco se chama "Novo bloco" e o de tarefa "Adicionar tarefa". Durante o salvamento aparece "Voando..." (tela antiga) ou "Carregando..." (nova).

### A.4.2 Gestor/RH cria PDI para um liderado (do zero)

1. Gestão > Gestão dos Planos de Desenvolvimento. A tela abre no quadro **"Individuais"**.
2. **"Criar um novo plano de desenvolvimento"**.
3. Modal **"Escolha qual colaborador irá realizar esse plano"** ("Aqui você escolhe quem irá realizar esse desenvolvimento individual"). Tem busca "Busque por uma pessoa" e **Filtros**. Cada linha mostra foto, nome, cargo e líder, com o botão **"Criar plano de desenvolvimento"**.
4. Modal **"Como você gostaria de criar esse plano?"** → **"Criar do Zero"** ou **"Criar a partir de um modelo"**.
5. Do zero: o cabeçalho mostra foto, nome, cargo, departamento e "Líder: <nome>". O gestor preenche nome, tipo, data de início, tempo estimado, blocos e tarefas → **"Salvar alterações"**.

### A.4.3 Criar a partir de um modelo (equivale a duplicar)

1. Depois do passo 4 acima, escolher "Criar a partir de um modelo".
2. Modal **"Escolha um plano para usar como modelo"** ("Aqui você escolhe qual plano deseja utilizar como modelo"). Tem busca por pessoa e Filtros. O texto diz que se pesquisa "o modelo de PDI de alguma outra pessoa que lidera". A lista mostra PDIs existentes, **inclusive expirados**, que aparecem com a etiqueta "Expirado" *(captura)*. À direita fica a pré-visualização com os blocos.
3. **"Criar um plano a partir deste"** → o editor abre com tudo copiado → ajustar → "Salvar alterações".
4. Restrição: com a integração Afferolab, "Criar a partir de um modelo" **só mostra PDIs sem nenhuma tarefa vinculada ao Afferolab**.

**Não documentado:** se o colaborador também pode criar a partir de modelo para si; se copia datas e progresso; se a lista de modelos inclui PDIs de fora da equipe.

### A.4.4 Criar com IA (Aconselhador de PDI)

Pré-requisitos:
- Recurso "ainda não está disponível para todos os clientes"; é preciso pedir ao Analista de Sucesso.
- Existir uma AD **em andamento ou finalizada**, selecionada pelo RH como fonte da IA nas "configurações avançadas de PDI".
- A pessoa precisa ser **participante dessa AD** e **já ter recebido respostas** em alguma etapa (gestor, pares ou autoavaliação).

Passos:
1. Colaborador: Desenvolvimento > Meus Planos de Desenvolvimento > "Criar um plano". Gestor: Gestão > Gestão dos Planos > "Criar um novo plano de desenvolvimento" > escolher pessoa > "Criar plano de desenvolvimento".
2. Botão **"Criar plano com I.A"** (na captura também aparece "Aprimorar meu plano com I.A.").
3. Modal **"Defina o objetivo do plano"** *(captura)*:
   - Faixa: "A nossa tecnologia de IA utiliza os dados disponíveis do colaborador para gerar um plano personalizado. É recomendado sempre revisar o conteúdo sugerido."
   - **"Qual o prazo de conclusão deste plano?"**: número + Dias/Semanas/Meses. Ajuda: "Essa informação é útil para calcular a quantidade de tarefas do seu plano".
   - **"Como deseja adicionar o conteúdo do agente?"**: "Sobrescrever conteúdos existentes" (substitui o que já existe no plano) ou "Apenas adicionar os novos conteúdos" (complementa).
   - **"Qual o foco deste plano?"**: texto livre (prompt). Exemplo de placeholder: "Me ajude a criar um objetivo de desenvolvimento focado em liderança".
   - Botões "Cancelar" / **"Gerar plano"**.
4. A IA devolve blocos e tarefas editáveis. Dá para repetir com "Apenas adicionar os novos conteúdos" e outro prompt.
5. Revisar → **"Criar plano"**. Nas capturas, as tarefas geradas vieram todas como "Atingido/Não atingido".

### A.4.5 Adicionar curso de LMS (Afferolab) como tarefa

1. No editor do plano (colaborador ou gestor), dentro de um bloco → **"Adicionar conteúdo Afferolab"**.
2. Modal **"Conteúdos Afferolab"**:
   - busca "Busque por um conteúdo" e lista "Conteúdos disponíveis";
   - cada item tem capa, título, descrição, barra de progresso, "Prazo de finalização", duração e situação ("Em andamento", "Não matriculado");
   - paginação "Itens por página";
   - botão **"Adicionar conteúdo"**.
3. Só aparecem conteúdos permitidos ao usuário e cursos que permitem matrícula. Se o curso não tiver turma, a Afferolab cria uma.
4. O curso vira tarefa do tipo Porcentagem, com link de acesso. O progresso e a conclusão sincronizam sozinhos.
5. Cenários:
   - curso já finalizado e com validade → entra com 100% e status finalizado;
   - finalizado com validade vencida → nova matrícula, mostrando as turmas;
   - finalizado sem data de expiração → modal pergunta se entra como finalizado (100%) ou faz nova matrícula.
6. Se o PDI estiver **finalizado**, o progresso deixa de sincronizar.

### A.4.6 Acompanhar os próprios planos (colaborador)

Desenvolvimento > Planos de Desenvolvimento → tela **"Meu Desenvolvimento"**:
- Abas **Ativos / Finalizados / Expirados**.
- Card do plano *(captura)*: nome, etiquetas (Tipo + "Individual"), "Iniciou dd/mm/aaaa", "Previsto dd/mm/aaaa", aviso em vermelho "Atrasada N dias", barra com % e "N de M tarefas".
- Clicar no card abre o detalhe: cabeçalho com nome, tipo, cargo, departamento, "Inicio em", "Previsto", barra, % e ícone de edição. Blocos sanfonados com título, descrição, barra e "N de M tarefas". Tarefas numeradas com anel de %, ou, se concluídas, check verde, texto riscado e data/hora.
- Coluna lateral *(captura)*:
  - **"Minha equipe — Essa é a sua equipe"**: Líder e Equipe, com botão de olho para ver a pessoa;
  - **"Mapa de objetivos — Descubra os objetivos de sua equipe que ainda estão vigentes e os concluídos no último período"**, com botão "Ver todos os objetivos".
- Faixa: "Novidade! Experimente criar seu PDI com aprimoramento de IA! Experimente já!".
- A mesma tela mostra PDIs, Trilhas e Onboardings ativos.

### A.4.7 Atualizar progresso de uma tarefa

1. Meu Desenvolvimento > clicar no plano > no bloco, clicar na tarefa.
2. Modal com número e nome da tarefa:
   - **Progresso** (campo % com setas, só no tipo Porcentagem);
   - **"Conte seus maiores aprendizados"** (texto rico, opcional);
   - botões "Voltar" / **"Atualizar Progresso"** → "Ok".
3. Tipo "Concluído/Não concluído": "a atividade só pode ser finalizada de uma vez, ou permanecer pendente sem nenhum tipo de status, até ser concluída".
4. Tipo "Porcentagem": atualização manual aos poucos, refletida numa barra.

**Não documentado:** se dá para baixar a % ou desfazer uma conclusão; se o gestor atualiza a tarefa do liderado; se há trava para tarefa com data futura.

### A.4.8 Editar

- Colaborador: Meu Desenvolvimento > selecionar o PDI > **ícone de edição**. Pode alterar "todas as informações, desde nome do PDI, data até adicionar novas ou deletar tarefas" → "Salvar alterações".
- Gestor/Admin: Gestão dos Planos > clicar no plano (PDI, Trilha ou Onboarding) > ícone de edição no painel à direita > mesmas opções.
- **Regra:** só planos com status **ativo**. "PDIs finalizados ou expirados não podem ser editados."
- No modo edição *(captura)* aparecem lixeira no topo do plano (excluir plano), lixeira em cada bloco, sanfona e, nas tarefas, ícone do tipo e data de conclusão.

### A.4.9 Finalizar

- O texto da central diz que finalizados são planos "que tiveram todas as atividades concluídas pelos donos" e que ativos "não foram marcados como concluídos pelas pessoas donas deles".
- Há um botão **"Finalizar"** no painel de detalhe do plano na Gestão *(captura)* e na Jornada do Colaborador, onde a central diz que o botão existe "no caso de administradores e gestores diretos".
- **Não documentado:** se a finalização é automática ao chegar a 100%; se o colaborador tem botão "Finalizar"; se dá para finalizar com tarefas pendentes; se dá para reabrir.

### A.4.10 Excluir

- Tarefa: botão **"Excluir"** no modal da tarefa (rosa, à esquerda) *(captura)*, ou lixeira na lista da tela nova.
- Bloco: **lixeira** ao lado do bloco, com confirmação (citada nos artigos de trilha e onboarding).
- Plano: lixeira no topo do plano em modo edição *(captura)*. Não há texto sobre isso: quem pode, se pede confirmação e se é exclusão definitiva estão em aberto.

### A.4.11 Cancelar, arquivar, duplicar, aprovar e comentar

- **Cancelar / arquivar:** não documentado (não existe status "cancelado").
- **Duplicar:** só pelo "Criar a partir de um modelo" (A.4.3).
- **Aprovar:** não documentado. Não há fluxo de aprovação. O colaborador cria "sem bloqueios" e o líder é só avisado por e-mail.
- **Comentar:** não documentado. Só existe o campo "aprendizados" por tarefa.

### A.4.12 Trilha de Desenvolvimento

**Editar o modelo:**
1. Gestão > Gestão dos Planos > quadro **"Trilhas"** > **"Editar modelo de trilha de desenvolvimento"**.
2. Definir o tempo estimado.
3. **"Adicionar novo bloco"**: escolher o tipo do bloco (Geral / Cargo / Departamento), título, descrição e as tarefas em **"Conhecimentos"**. Na captura, "Adicionar nova tarefa" aparece desabilitado antes de configurar o bloco *(inferido)*.
4. **"Salvar alterações"**.

**Vincular a uma pessoa:**
1. Quadro "Trilhas" > **"Vincular trilha a uma pessoa"**.
2. Escolher a pessoa: cada linha mostra "Último plano criado em: dd/mm/aaaa" *(captura)* e o botão **"Criar Trilha de Desenvolvimento"**.
3. O editor mostra nome, cargo, departamento e líder (preenchidos). Definir **Data de início** e **Tempo estimado de conclusão**.
4. Aparecem "todos os modelos de trilhas que já foram cadastrados". Excluir os blocos que não fazem sentido (lixeira + confirmação), ajustar e adicionar tarefas ("Adicionar nova tarefa"), ou apagar tudo e criar do zero ("Adicionar novo bloco").
5. **"Salvar alterações"**.

**Não documentado:** vincular a trilha a várias pessoas de uma vez. O fluxo descrito é pessoa a pessoa, apesar de a trilha ser "em grupo".

### A.4.13 Onboarding

**Editar o modelo:**
1. Gestão > Gestão dos Planos > **"Onboardings"** > **"Editar modelo de Onboarding"** (rótulo na captura: "Editar modelo de plano de onboarding").
2. Definir o tempo estimado de conclusão e a **Criação automática de onboarding** (Ativa/Inativa).
3. Bloco padrão "Geral" (seta > "Adicionar nova tarefa").
4. "Adicionar novo bloco": tipo (Geral, Cargo ou Departamento), título, descrição e Conhecimentos (tarefas).
5. "Salvar" na tarefa → **"Salvar alterações"** na página.

**Criação automática:** com a opção ativa, "assim que um novo colaborador for adicionado automaticamente será criado um onboarding para ele, respeitando os critérios de cargos, geral e departamento". Exemplo da central: quem entra no Comercial recebe os blocos Geral + departamento Comercial + o cargo dele.

**Vincular manualmente:**
1. "Onboardings" > **"Vincular onboarding a uma pessoa"** > escolher a pessoa > **"Criar Onboarding"**.
2. Aparecem os blocos do modelo que valem para o cargo e o departamento da pessoa, mais o bloco Geral. O Geral pode ser apagado (lixeira). Dá para editar livremente e criar blocos personalizados.
3. Definir "Data de início" e "Tempo estimado de conclusão" no topo → "Salvar alterações".

**Papéis recomendados:** o gestor monta o Onboarding Técnico e o RH monta o Cultural.

### A.4.14 Migração do módulo antigo de PDI

1. Gestão > Gestão dos Planos de Desenvolvimento. Aparece a faixa "Migre os dados dos seus PDIs antigos. Os PDIs antigos serão desativados. Traga seus dados para o novo modelo de Planos de Desenvolvimento." com o link "Saiba mais" e o botão **"Migrar agora"**.
2. Modal **"Iniciar migração de dados? Esta operação levará um certo tempo. Não se preocupe, lhe avisaremos assim que o processo terminar"**, com os botões "Cancelar" e **"Iniciar migração"**.
3. Mensagem de sucesso → **atualizar a página**. "Você não perderá nenhuma informação."

### A.4.15 Quem cria plano para quem

| Criador | Para | Como |
|---|---|---|
| Colaborador | si mesmo | Meu Desenvolvimento > Criar um plano (do zero, com IA ou com curso Afferolab) |
| Gestor com permissão | liderado (ou departamento gerenciado) | Gestão dos Planos > Criar um novo plano (do zero, modelo, IA ou Afferolab) |
| Admin/RH | qualquer pessoa da empresa | Idem |
| Gestor/RH | pessoa (Trilha) | Vincular trilha a uma pessoa |
| Gestor/RH | novo colaborador (Onboarding) | Vincular onboarding a uma pessoa, ou criação automática na admissão |
| **Em massa** | várias pessoas | **Não documentado na central.** O único automático é o onboarding na entrada de colaborador. O release notes de mar/26 cita "importações em massa" ao falar do relatório de modelos, mas o importador não é descrito. |

## A.5 Estados, transições e cálculo de progresso

### Status do plano

| Status | Definição da central | Onde aparece |
|---|---|---|
| **Ativo** | "ainda em andamento e não foram marcados como concluídos pelas pessoas donas deles" | Aba "Ativos" (colaborador e gestão) |
| Ativo em dia / Ativo atrasado | Subdivisão dos ativos nos quadros da Gestão ("Em dia N Planos" / "Atrasados N Planos", com %) | Quadros Individuais/Trilhas/Onboardings. O card mostra "Atrasada N dias" em vermelho *(captura)*. |
| **Finalizado** | "tiveram todas as atividades concluídas pelos donos" (e/ou botão Finalizar) | Aba "Finalizados" |
| **Expirado** | "ultrapassaram a data definida para conclusão e não foram concluídos" / "não foram concluídos dentro do prazo estabelecido" | Aba "Expirados" (só no colaborador). Na Gestão é a **etiqueta** "Expirado". |

Transições *(inferido)*:
- Ativo → Finalizado: todas as tarefas concluídas, ou botão "Finalizar".
- Ativo → Expirado: data prevista vencida sem conclusão.

**Inconsistência a confirmar:** nas capturas aparecem planos na aba **Ativos** com "Atrasada 862 dias". Ou seja, passar do prazo nem sempre move o plano para Expirado. A regra que separa "atrasado" de "expirado" não está documentada. Edição só vale em Ativo.

### Status da tarefa

- Atingido/Não atingido: pendente ou concluída.
- Porcentagem: 0–100. Considerada concluída em 100% *(inferido)*.
- Concluída mostra check verde, texto riscado e data/hora *(captura)*.

### Cálculo do progresso

A central não documenta a fórmula. *(Inferido das capturas)* Um bloco com duas tarefas, uma em 90% e outra concluída (100%), mostra **95%** no bloco e no plano, e "1 de 2 tarefas". Ou seja, **% = média simples das tarefas**, e Atingido conta 0 ou 100. "N de M tarefas" conta só as concluídas.

Cores da barra e do anel *(captura)*: verde (70%, 95%), laranja (50%), vermelho (0%). As faixas de corte não estão documentadas.

Quadros da Gestão: "Em dia" e "Atrasados" são % e contagem sobre o total de ativos, por modalidade.

## A.6 Configurações do módulo (o que o admin liga e desliga)

| Configuração | Onde | Efeito | Fonte |
|---|---|---|---|
| Módulo habilitado | Não documentado | O colaborador só cria PDI "quando o módulo está habilitado" | Artigo de gestão |
| Exibir tipos padrão de PDI | Configurações > Configurações > PDI | Liga: mostra tipos padrão + customizados. Desliga: só os customizados. | Release notes fev/24 |
| Tipos customizados de PDI | Não documentado (provavelmente no mesmo lugar) | Criados pelo administrador | Release notes fev/24 |
| AD fonte do Aconselhador IA | "configurações avançadas de PDI" | Habilita a IA para participantes dessa AD | Artigo IA |
| Permissionamento de Planos | Não documentado | Acesso a PDI, Trilhas e Onboarding por grupos (gestores, departamentos) | Release notes nov/24 |
| Restringir CPF no relatório de PDI | Não documentado | Só autorizados veem e exportam o CPF | Release notes jul/26 |
| Criação automática de onboarding | Modelo de Onboarding | Cria onboarding na entrada do colaborador | Artigo de modelo |
| Modelos de Trilha e Onboarding | Gestão dos Planos | Blocos por Geral/Cargo/Departamento | Artigos de modelo |
| Integração Afferolab | Configurações > Integrações > "Integração Afferolab" | "Ativar integração", campo "Token Afferolab", seção "Chave de Integração (API 2.0)" com "Gerar Token" (só admin), "Chave de usuário" (e-mail ou CPF), "Testar conexão" | Artigo de integração |
| Moedas por PDI | Configurações > Gamificação | "Plano de Desenvolvimento (PDI) Vigente" e "Plano de Desenvolvimento (PDI) Vigente Concluído" valem moedas configuráveis (exemplo da captura: 700 e 500) | Captura do artigo "Como configurar os valores das moedas" |
| Departamentos gerenciados | Ativado pelo time da Feedz | Troca o escopo do gestor | Artigo de Configurações |

## A.7 Notificações e lembretes

| Gatilho | Canal | Para quem | Fonte |
|---|---|---|---|
| Novo plano de desenvolvimento criado | **E-mail** | Líder direto | Artigos "Diferença PDI/Trilha/Onboarding" e "Como gerenciar os PDIs" |
| Fim da migração | Aviso na tela ("lhe avisaremos assim que o processo terminar") | Quem iniciou | Artigo de migração |
| Progresso do curso Afferolab | Sincronização automática, sem notificação | — | Artigo Afferolab |
| Prazo vencendo, plano atrasado ou expirado | **Não documentado** | — | — |
| Lembrete semanal de atualização (a Feedz recomenda acompanhar toda semana) | **Não documentado** como recurso | — | — |

Configuração individual: foto/nome (canto superior direito) > **Meu perfil > Notificações**, onde cada pessoa desliga as notificações por e-mail que não quer. A central não lista quais tipos existem. O ADM/RH controla o envio de alguns módulos, mas a lista citada (celebrações, comunicados, AD, pesquisas) não inclui PDI. Existem também **notificações push** (sininho azul, "Se inscrever"), sem lista por módulo. Na integração com o **Slack**, PDI não está entre as notificações sincronizadas.

## A.8 Relatórios, painéis, filtros e exportações

**Tela Gestão dos Planos de Desenvolvimento**
- **Quadros** Individuais / Trilhas / Onboardings. Cada um mostra "N ativos", barra, "Em dia x% N Planos" e "Atrasados y% N Planos". Clicar no quadro troca a lista. Título da lista na tela nova: "Plano de Desenvolvimento Individual".
- **Abas** "Ativos (N)" e "Finalizados (N)".
- **Busca** "Busque por uma pessoa".
- **Filtros** (painel) *(captura)*:
  - "Status do plano": **Status**, **Progresso**, **Tipo**, **Data de início**, **Data final prevista**;
  - "Grupo de participantes": **Líder**, **Departamento**, **Grupo**, **Cargo**;
  - botões "Limpar filtros" e "Aplicar filtros".
- **Seletor** "Todos os status".
- **Gráfico** de planos criados por **Departamentos / Gestores / Cargos** (abas). Na captura é uma pizza, "Todos os planos por departamento", com legenda paginada.
- **Card** na lista *(captura)*: foto, nome do plano, pessoa, cargo, foto, nome e papel de quem acompanha ("Líder", "Gestora"), "Atrasada N dias" e anel de %.
- **Painel de detalhe** à direita: nome completo do plano, colaborador, cargo, departamento, gestor, progresso por bloco e por tarefa, ícone de edição e botão "Finalizar".
- **Exportar** (canto superior direito): planilha com "todas as informações expostas na tela", por aba (Individuais, Trilhas, Onboarding). **As colunas não estão documentadas**, exceto CPF (release notes jul/26).
- **Relatório de modelos de planos** *(release notes mar/26)*: exporta a estrutura dos modelos de trilhas e onboarding, "facilitando a revisão, auditoria e preparação de dados para importações em massa".

**Fora da tela de gestão**
- **Painel de Engajamento** (Gestão > Painel de Engajamento):
  - Card "Eficiência > Desenvolvimento". Tooltip *(captura)*: "É a porcentagem de colaboradores que possuem plano de desenvolvimento ativo na Feedz". Exemplo: PDIs ativos 2, PDIs esperados 47, colaboradores ativos 47 → (2/47)*100 = 4%.
  - Linha "PDI" em "Engajamento por módulo".
  - Filtros: Unidade, Departamento, Liderados de, Data inicial, Data final, Colaboradores (Ativos e Desligados).
- **Resumo de Atividades** (Gestão): coluna **"Planos de Desenvolvimento"** = "número de planos de desenvolvimentos ativos durante o período em filtro". Exporta para Excel.
- **Jornada do Colaborador**: bloco "Planos de Desenvolvimento do <pessoa>" com abas Ativos/Finalizados, lista com anel de %, painel de detalhe e botões editar/"Finalizar".
- **Início** *(captura)*: widget "Como está sua gestão?" com "Desenvolvimento — Eficiência: x%".
- Painel antigo "Painel de Plano de Desenvolvimento (PDI)": não documentado.

## A.9 Ligações com outros módulos

| Módulo | Ligação | Fonte |
|---|---|---|
| **Avaliação de Desempenho** | É a fonte de dados do Aconselhador IA. A AD é escolhida pelo RH, e a pessoa precisa ter respostas. | Artigo IA |
| **Reuniões 1:1** | A tela interna da 1:1 tem "Resumo do liderado" com o card **PDI** (ex.: "Não possui") | Captura do artigo de Ações na 1:1 |
| **Objetivos** | O widget "Mapa de objetivos" fica na própria tela Meu Desenvolvimento | Captura |
| **Gamificação** | Moedas por "PDI Vigente" e "PDI Vigente Concluído". A regra exata de pontuação não está documentada. | Captura de Configurações do Feedzcoins |
| **Painel de Engajamento / Resumo de Atividades / Jornada** | Indicadores de PDI ativos, eficiência, lista de planos | Artigos de Gestão e relatórios |
| **Cargos e Departamentos** | Blocos de Trilha e Onboarding segmentados por cargo e departamento; filtros e gráficos por cargo, departamento e gestor | Artigos de modelo |
| **Cadastro de colaboradores / admissão** | Onboarding automático quando um colaborador é adicionado | Artigo de modelo de onboarding |
| **LMS Afferolab** | Cursos viram tarefas com progresso sincronizado | Artigos Afferolab |
| **Plano de Ação (Pesquisa de Clima)** | Só aparece como "artigo relacionado". Não há integração descrita. | Visão geral |
| **Competências** | Não documentado. Não há vínculo descrito. | — |
| **Feedback** | Não documentado. Não há vínculo descrito. | — |

## A.10 Regras, limites e boas práticas da Feedz

- O PDI deve durar **no máximo 3 meses** e ser **acompanhado e atualizado semanalmente**.
- Reservar **pelo menos 1 hora por semana** para o desenvolvimento.
- O PDI deve ser **elaborado pelo colaborador com apoio do líder direto**. O líder também pode montá-lo, "se for da preferência".
- PDI serve para "desenvolver uma única pessoa em determinado conteúdo ou habilidade". Para grupos, usar Trilha.
- Onboarding: estruturar **antes** da entrada do colaborador e revisar a cada nova contratação. Gestor faz o técnico, RH faz o cultural. A central cita a Harvard Business Review: cerca de 22% das empresas não têm onboarding estruturado.
- Exemplos de títulos de bloco: "Onboarding Cultural", "Onboarding Técnico", "Comunicação", "Plataformas", "Conhecendo o time".
- **Só planos ativos podem ser editados.**
- Na Gestão, ninguém vê os próprios planos.
- Tarefas vindas de LMS: nome, tipo e descrição travados. Plano finalizado não sincroniza mais o progresso.
- IA: sempre revisar o conteúdo sugerido. O prazo informado define a quantidade de tarefas geradas.
- Migração do módulo antigo: sem perda de dados. É preciso atualizar a página depois.
- Integração Afferolab: usar duas abas, uma por plataforma. Só o Administrador gera o token da API.

## A.11 Lacunas (ver dentro do sistema logado)

1. Regra exata entre **Atrasado** e **Expirado**, e se há tolerância para editar depois do prazo.
2. Se a finalização é automática a 100% ou só pelo botão "Finalizar". Quem pode finalizar (o colaborador pode?). Se dá para reabrir.
3. Fórmula oficial do progresso: média simples das tarefas ou média dos blocos? Atingido = 0/100? As faixas de cor.
4. Histórico de atualizações de progresso e aprendizados: se fica guardado e quem vê.
5. Colunas exatas das planilhas exportadas (Individuais, Trilhas, Onboarding e relatório de modelos).
6. Tela de **tipos de PDI** (campos) e de **Permissionamento de Planos** (granularidade: ver, criar, editar, exportar?).
7. Exclusão de plano: quem pode, se é exclusão definitiva e se há confirmação.
8. Se o gestor consegue atualizar o progresso da tarefa do liderado.
9. Importador em massa de PDI e Trilha (formato da planilha).
10. Trilha: se dá para vincular várias pessoas de uma vez. Como se comporta "todos os modelos de trilha" ao vincular.
11. Conteúdo dos vídeos não transcritos: visão geral (youtube 1GFFhCzztdw), criar PDI para mim (Pi97R8m07so), IA (B3ZzXjLuQCc), gerenciar onboardings (6sUdVZISEWY), gerenciar trilhas (spR1xaGuAzw).
12. Notificações de prazo e atraso e lembretes de atualização semanal.
13. Regra das moedas "PDI Vigente" e "PDI Vigente Concluído": por plano, por ciclo ou uma vez só?
14. O que o painel antigo "Painel de Plano de Desenvolvimento (PDI)" mostrava.
15. Etiqueta de modalidade de Trilha e Onboarding no card (só "Individual" foi visto).

**Já respondido no levantamento logado (`telas-logado.md`, outra fonte):**
- Configuração em `/empresa/planos-de-desenvolvimento`:
  - "ADs usadas pelo Aconselhador": só ciclos dos últimos 12 meses, uma AD só;
  - **"Dias para edição do PDI após a expiração"**: valor 999 na conta. Isso responde em parte o item 1;
  - tipos padrão fixos (Habilidades Técnicas, Liderança, Comunicação, Gestão); tipos da empresa com título e descrição.
- Filtro de status com as opções Todos / Em dia / Atrasados. O card mostra "Faltam N dias".
- Cálculo conferido via API: % do grupo = média das tarefas; % do plano = média de todas as tarefas, truncada. Isso confirma o item 3.
- Tarefa guarda `status` (0–100) e `finish_date` ao chegar a 100.
- Existem importadores `importador/trails/trail-association` e `importador/trails/targets` (responde em parte o item 9).
- Notificação no sino "Você tem ações ativas atrasadas. Vamos revisar?".
- A Bismarchi | Pires usa **só o PDI individual**. Trilhas e Onboardings estão sem nenhum plano ativo.

---

# PARTE B. REUNIÕES 1:1

## B.1 Propósito e localização no menu

**Propósito** (artigo "Visão geral"): 1:1 (One on One, one-to-one, 1 on 1, one2one) é "uma conversa entre líder e liderado", "uma das ferramentas mais poderosas para aumentar o engajamento e alinhar expectativas". O subtítulo da tela em captura antiga diz "Realize e gerencie reuniões diretas entre líderes, liderados e pares", ou seja, também vale **entre pares**. Na captura mais nova: "Realize e gerencie reuniões 1:1 com as pessoas da sua empresa".

| Quem / para quê | Caminho | Tela |
|---|---|---|
| Qualquer pessoa: suas reuniões | **Desenvolvimento > Reuniões 1:1** (URL `app.feedz.com.br/1on1` na captura) | "Reuniões 1:1" (lista por pessoa + "Em Breve") |
| Tela de uma dupla | Clicar na pessoa na lista | "Reuniões 1:1 - <Pessoa A> e <Pessoa B>" |
| Gestão/RH: histórico e exportação | **Gestão > Histórico de 1:1** | "Reuniões 1:1 — Acompanhe os 1:1 de todos seus colaboradores." |
| Eficiência dos gestores | Gestão > Histórico de 1:1 > botão **"Acompanhar Gestores"** | "Resumo de Atividades dos Gestores" |
| Admin: lembrete | **Configurações** (menu lateral) > seção **"Configurações do 1on1"** | Campo "Lembrete de reunião" |
| Agenda | Reuniões 1:1 > botão **"Integrar Agenda"** (canto superior direito) | Google Calendar / Microsoft Calendar |
| Slack | Configurações > Integrações > "Integração Slack" | — |

A tela de Visão geral cita três grupos de conteúdo: "Criação e configuração da 1:1", "Acompanhamento e relatório" e "Materiais de apoio". Não há artigo de "Materiais de apoio" na coleção.

## B.2 Perfis e permissões

| Ação | Quem pode (documentado) |
|---|---|
| Criar uma 1:1 | Quem acessa Desenvolvimento > Reuniões 1:1. Escolhe "a pessoa com quem deseja realizar a reunião". "**Não é necessário apontar qual seu relacionamento com a pessoa ao criar uma 1:1**": o sistema deduz o papel (Líder / Liderado / Par). As restrições sobre com quem se pode marcar não estão documentadas. |
| **Finalizar** a reunião | **Só o líder da reunião.** "Caso você seja liderado, solicite que o seu gestor realize o passo a passo". Se o botão não aparece, "você não está como líder dessa reunião". |
| Adicionar tópicos na pauta compartilhada | Participantes *(inferido: a pauta é "Compartilhada" e mostra o avatar de quem adicionou)* |
| Anotações privadas | Cada participante. Visíveis só para o autor ("Essas anotações não são visíveis para os outros participantes dessa reunião") |
| Ações: criar | Só quem participa da 1:1. O líder pode criar ação **para o liderado**. |
| Ações: editar e concluir | **Só quem criou** |
| Ações: excluir | O líder pode excluir ação do liderado. O liderado pode criar, editar, concluir, desfazer e excluir **a sua** ação. |
| Excluir reunião | Não documentado quem. O passo a passo é feito pelo próprio usuário na tela. |
| Recorrências: criar e remover | Não documentado quem. Feito na tela da dupla. |
| Histórico de 1:1 e exportação (Gestão) | "Precisa ter a permissão necessária" (RH). Desde jun/25 há uma **flag para liberar o histórico de 1:1 por colaborador**, "permitindo maior flexibilidade para perfis como BPs" *(release notes jun/25)*. |
| Acompanhar Gestores | Quem acessa o Histórico de 1:1 (não especificado) |
| Lembrete de reunião (config) | Quem acessa Configurações (admin, *inferido*) |
| Integração Slack | Só perfil Admin vê. O app só pode ser instalado pelo dono do workspace no Slack. |
| Integração de agenda | Cada usuário, para a própria agenda |
| Alerta de 1:1 não finalizada na página inicial | "Gestores e líderes" *(release notes mar/25)* |

## B.3 Modelo de dados inferido

### B.3.1 Relação de 1:1 (dupla) (`one_on_one_relacao`)

É a "tela interna exclusiva para cada pessoa com relacionamento de reuniões".

| Campo / bloco | Tipo | Observações |
|---|---|---|
| Participantes | 2 × FK pessoa | Exibidos com foto, nome, cargo ou departamento e etiqueta **"Líder"** / **"Liderado"** *(captura)* |
| Relação | enum | **Liderado**, **Par** e (*inferido*) Líder, como etiqueta na lista principal *(captura)* |
| Resumo do liderado | calculado | Só "no caso de pessoa liderada". Cards **Humor** (ex.: "Feliz"), **Feedbacks** (ex.: "19 dias que você enviou"), **1:1**, **Objetivos**, **PDI**. Sem dado aparece "Sem dados" ou "Não possui". Ícone "i" com explicação (não documentada). Botão **"Jornada Completa"** (abre a Jornada). |
| Reuniões | 1:N | Abas "Próxima Reunião e anteriores — Linha do Tempo das Reuniões" e "Reuniões Agendadas — Reuniões que estão programadas para acontecer". Botão "Filtros" (conteúdo não documentado), "Carregar mais". |
| Recorrências | 1:N | Quadro "Recorrências — Mantenha suas 1:1 agendadas com as recorrências." com botão "+". Vazio: "Sem recorrências configuradas". |
| Ações | 1:N | Quadro "Ações — Registrem as tarefas discutidas na 1:1 para vocês realizarem" com "+". Abas "Em andamento" / "Concluídas". Vazio: "Sem ações em andamento". |

### B.3.2 Reunião (`one_on_one_reuniao`)

Modal "Criar Reunião", com a legenda "*Campos Obrigatórios" *(captura)*.

| Campo | Tipo | Obrigatório | Valores / observações |
|---|---|---|---|
| Colaborador | FK pessoa | **sim** | Select. Mostra "Nome (Cargo)", ex.: "Alexandre Cardoso (Vendedor)". Na tela da dupla, a pessoa já vem definida *(inferido)*. |
| Data | data | **sim** | dd/mm/aaaa |
| Início | hora (select) | **sim** | Ex.: 15:00, 14:15, 11:30. O intervalo entre opções não está documentado. |
| Fim | hora (select) | **sim** | Ex.: 15:30, 14:45, 12:15 |
| Categoria | FK categoria | **opcional** ("(opcional)") | Valores vistos: **Alinhamento, Desenvolvimento, Acompanhamento**. Sem categoria aparece a etiqueta "Sem Categoria". Onde se cadastram as categorias não está documentado. |
| Pauta da Reunião | lista de tópicos | **sim, ao menos 1** | Mensagem: "sem tópicos adicionados, adicione pelo menos um para criar a reunião". Dois campos: "Adicione um tópico sugerido na pauta" (lista de pautas "padrão e já estão criadas na plataforma" / "pré-cadastradas na sua base") e "Adicione um novo tópico na pauta" (texto livre + botão de adicionar). |
| Recorrência | enum | não ("Sem Recorrência" é o padrão) | "Adicione uma recorrência para fazer com que essa reunião se repita no intervalo definido. **A categoria e tópicos serão repetidos em todas as reuniões.**" Opções vistas: "Sem Recorrência", "Semanalmente (todo(a) quinta-feira)" (o dia sai da data), "Todo mês, 1ª QUA" (ordinal + dia da semana). A lista completa não está documentada. |
| Término da Recorrência | escolha | **sim, quando há recorrência** | **"No Dia"** + data, ou **"Após"** + N "ocorrências" |
| Status | enum | sistema | **Agendada**, **Atrasada**, **Finalizada** (ver B.5) |
| Líder da reunião | FK pessoa | sistema | Só ele finaliza. Como é definido não está documentado (provavelmente a hierarquia, *inferido*). |
| Evento de agenda externo | id externo | sistema | *(inferido)* Criado quando o usuário integrou Google ou Microsoft antes de marcar |

Card da reunião na linha do tempo *(captura)*:
- data por extenso ("17 de Setembro") e horário ("11:30 até 12:15");
- **lápis de edição**;
- etiquetas de status e categoria;
- botão **"Finalizar"** (só para o líder e só se não finalizada);
- **lixeira** e seta para expandir.

Expandido, mostra **"Pauta Compartilhada da Reunião"** ("Adicione tópicos para serem discutidos na reunião") e **"Anotações Privadas"**.

### B.3.3 Tópico de pauta (`one_on_one_topico`)

| Campo | Tipo | Observações |
|---|---|---|
| Texto | texto | Ex. visto: "Você acredita que meu trabalho está abaixo ou acima da média?" |
| Autor | FK pessoa | Avatar exibido ao lado do tópico *(captura)* |
| Origem | sugerido / novo | *(inferido)* pelo campo usado |
| Gravação | — | "será salvo automaticamente" |

**Biblioteca de tópicos sugeridos** (`one_on_one_topico_sugerido`): existe ("pautas pré-cadastradas na sua base"). Não está documentado onde se mantém nem quem mantém.

### B.3.4 Anotação privada (`one_on_one_anotacao_privada`)

Texto rico. O editor TinyMCE tem parágrafo, negrito, itálico, sublinhado, alinhamentos, listas, recuo, cor e realce. Campos: autor e reunião. Subtítulo: "Espaço para anotar pontos importantes sobre o que foi discutido na reunião". Botões "Cancelar" / **"Salvar"** (aqui o salvamento é manual).

### B.3.5 Recorrência (`one_on_one_recorrencia`)

Card *(captura)*: frequência ("Toda semana", "Todo mês"), dia ("Segunda", "Terça", "1ª QUA"), horário ("10:00 até 10:30") e **"Termina em dd/mm/aaaa"**. Excluir recorrência apaga **todas as reuniões futuras** dela. As passadas ficam.

### B.3.6 Ação (`one_on_one_acao`)

Modal "Criar ação" *(captura)*.

| Campo | Tipo | Obrigatório | Observações |
|---|---|---|---|
| Descrição da Ação | texto | **sim** | **Limite de 255 caracteres** ("Limite máximo de 255 caracteres") |
| Responsável | FK pessoa (participantes) | **sim** | Vem preenchido com o usuário logado *(captura)* |
| Reunião Relacionada | FK reunião ou "Nenhuma" | **sim** (asterisco) | Padrão "Nenhuma". É possível "cadastrar ações sem uma reunião vinculada". |
| Status | Em andamento / Concluída | sistema | Concluída aparece riscada, com fundo verde |
| Criador | FK pessoa | sistema | Define quem edita e conclui |
| Última atualização | datetime | sistema | Base do lembrete de 14 dias *(inferido)* |

### B.3.7 Configuração e indicadores

- **Configuração** (`one_on_one_config`, por empresa): **Lembrete de reunião**: "Adicione o dia limite para realizar outro 1:1", em N **Dias** (captura: 24). Título da seção: "Configurações do 1on1 — Configurações gerais de personalização das reuniões de 1on1".
- **Indicador de frequência ("saúde")**: Boa / Ruim / Sem dados + "N dia(s) desde a última reunião", calculado "conforme o tempo definido pela empresa". *(Inferido)* Usa o mesmo campo de dias do lembrete.
- **Integração de agenda** (por usuário): provedor Google Calendar ou Microsoft Calendar, via OAuth. Na captura o app do Google se chama "Feedz-Calendar".

## B.4 Fluxos passo a passo

### B.4.1 Criar reunião

1. Desenvolvimento > Reuniões 1:1 > **"Criar Reunião"**. Também dá para criar:
   - pela tela da dupla ("+ Criar Reunião");
   - pelo botão "Criar reunião" na linha de quem está com "Sem reunião agendada";
   - pelo "+" de Recorrências.
2. Escolher Colaborador, Data, Início e Fim, Categoria (opcional) e Pauta (ao menos 1 tópico, sugerido ou novo).
3. Recorrência (opcional) e, se houver, Término (No Dia / Após N ocorrências).
4. **"Criar Reunião"**.

Destaques da Feedz para a 1:1:
- "Salvamento automático das informações registradas".
- "Links rápidos para finalizar reuniões e agendar a próxima".
- "Indicador de saúde da frequência das 1:1s".

### B.4.2 Adicionar tópicos numa reunião já marcada

1. Reuniões 1:1 > clicar na pessoa > Reuniões > **"Reuniões Agendadas"** > seta "v" para expandir.
2. Primeiro campo: pauta pré-cadastrada. Segundo campo: tópico novo + "+".
3. Salva sozinho.

### B.4.3 Anotações privadas

1. Clicar na pessoa > "Próxima reunião e anteriores" > expandir a reunião.
2. Seção **"Anotações Privadas"** → escrever → **"Salvar"**.

### B.4.4 Editar ou reagendar

Há um lápis ao lado da data no card *(captura)*. **Não há artigo** sobre editar data, hora, categoria ou pauta, nem sobre o efeito na agenda integrada.

### B.4.5 Finalizar

1. Desenvolvimento > Reuniões 1:1 > selecionar a reunião > **"Finalizar"**.
2. O botão aparece no card da reunião e, na lista principal, na coluna "Última Reunião" quando ela não foi finalizada *(captura de 2025)*.
3. Só o líder vê o botão.

Desde mar/25 o gestor recebe **alerta na página inicial** para finalizar 1:1s "realizadas, mas não concluídas". O alerta some quando as pendências acabam.

**Não documentado:** se a finalização abre algum formulário (resumo, avaliação, nota) e se dá para desfazer.

### B.4.6 Excluir reunião

Duas formas:
1. Painel lateral **"Em Breve"** > clicar na reunião > menu **"Detalhes" / "Excluir"** > Excluir.
2. Tela da dupla > Reuniões > **lixeira** no card.

Confirmação: "**Excluir reunião** — Deseja realmente excluir esta reunião?" [Voltar] [Confirmar]. "**Não é possível desfazer ou recuperar a 1:1 deletada.**"

Não existe status "Cancelada". Cancelar = excluir.

### B.4.7 Recorrências

- **Adicionar:** clicar na pessoa > lateral direita "Recorrências" > **"+"** > modal Criar Reunião com recorrência > "Criar Reunião".
- **Remover:** abrir a dupla > passar o mouse no card da recorrência > **lixeira** > "**Excluir recorrência** — Deseja realmente excluir essa recorrência? As reuniões futuras relacionadas a essa recorrência também serão excluídas." [Voltar] [**Confirmar**]. As reuniões passadas não mudam.
- Editar uma recorrência existente: não documentado.

### B.4.8 Ver reuniões que já aconteceram

Clicar na pessoa > **"Próxima Reunião e anteriores"** (linha do tempo) > as passadas têm a etiqueta **"Finalizada"** > seta "v" para ver o conteúdo. A lista pagina com "Carregar mais".

### B.4.9 Ações combinadas

| Ação | Como |
|---|---|
| Criar | Abrir uma 1:1 > seção **Ações** (lado direito) > **"+"** > preencher > **Salvar** |
| Editar | Passar o mouse > **"Editar ação"** (lápis) > Salvar |
| Excluir | Ver a coluna (Em andamento / Concluídas) > passar o mouse > **"Excluir ação"** (lixeira) > modal "**Deletar ação** — Deseja realmente excluir esta ação?" [Cancelar] [**Excluir**] |
| Concluir | Passar o mouse > **"Marcar como concluída"** (check) > vai para "Concluídas". Toast "**Sucesso!** A ação foi concluída com sucesso". |
| Desfazer conclusão | Em Concluídas > passar o mouse > **"Desfazer conclusão"** (X) > volta para "Em andamento" |

Cards de ação mostram a descrição e o responsável (foto + nome) *(captura)*. A ação é feita para ser "executada e revisada nas próximas 1:1".

### B.4.10 Integrar agenda

1. Reuniões 1:1 > **"Integrar Agenda"** > **Google Calendar** ou **Microsoft Calendar**.
2. Login e consentimento OAuth.
3. Só as reuniões **criadas depois** da integração vão para a agenda. As já marcadas não vão.

### B.4.11 Configurar o lembrete automático

Configurações > seção **"Configurações do 1on1"** > campo **"Lembrete de reunião"** (N dias) > **Salvar**.

### B.4.12 Exportar e acompanhar gestores

Ver B.8.

## B.5 Estados e transições

**Reunião**

| Status | Significado | Fonte |
|---|---|---|
| **Agendada** | Marcada, ainda vai acontecer | Etiqueta amarela *(captura)* |
| **Atrasada** | A data passou e a reunião não foi finalizada | Etiqueta *(captura)*. Na Jornada aparece como "Atrasado". O nome "Atrasada" não está explicado no texto (*inferido*). |
| **Finalizada** | O líder clicou em "Finalizar" | Texto + captura |
| (excluída) | Exclusão definitiva | Artigo de exclusão |

Transições *(inferido)*:
- Agendada → Atrasada: quando passa do horário.
- Agendada ou Atrasada → Finalizada: pelo líder.
- Qualquer → excluída: pela lixeira.
- A exclusão da recorrência apaga as futuras.

**Ação:** Em andamento ⇄ Concluída (marcar ou desfazer). Exclusão definitiva com confirmação.

**Indicador de frequência por pessoa** *(captura)*:
- **Boa** (verde): ex. "7 dia(s) desde a última reunião";
- **Ruim** (vermelho): ex. "49 dia(s) desde a última reunião";
- **Sem dados**: nunca houve reunião.

A regra é "conforme o tempo definido pela empresa". O corte exato não está documentado.

Não há cálculo de % de progresso na 1:1.

## B.6 Configurações do módulo

| Configuração | Onde | Efeito |
|---|---|---|
| Lembrete de reunião (N dias) | Configurações > Configurações do 1on1 | Limite de dias para enviar novo lembrete de agendamento. Provavelmente também é a base do indicador de frequência (*inferido*). |
| Liberar histórico de 1:1 por colaborador (flag) | Não documentado | Dá acesso ao Histórico de 1:1 a perfis como BPs *(release notes jun/25)* |
| Moedas por "Finalizar 1on1" | Configurações > Gamificação | Moedas configuráveis (captura: 20). Tem ícone "i" com regra não visível. |
| Integração Slack | Configurações > Integrações | Notificações individuais de agendamento de 1:1 |
| Integração de agenda | Por usuário, na própria tela de 1:1 | Cria eventos das 1:1 futuras |
| Categorias e tópicos sugeridos | **Não documentado** onde se configuram | — |

## B.7 Notificações e lembretes

| Gatilho | Canal | Para quem | Fonte |
|---|---|---|---|
| Passaram N dias sem nova 1:1 (config "Lembrete de reunião") | Não especificado ("lembrete automático para marcar") | Não especificado (*inferido*: o líder) | Artigo de lembrete |
| Ação sem atualização há **14 dias** | **Notificação na Feedz** | Não especificado (*inferido*: o responsável) | Artigo de Ações |
| 1:1 realizada e não finalizada | **Alerta na página inicial** (some quando resolve) | Gestores e líderes | Release notes mar/25 |
| Agendamento de reunião 1:1 | **Slack**, individual para os envolvidos, mesmo sem canal público | Participantes | Artigo do Slack |
| Reunião criada depois de integrar a agenda | Evento no **Google ou Microsoft Calendar** | O usuário que integrou | Artigo de agenda |
| Reunião criada, alterada ou excluída por e-mail | **Não documentado** | — | — |
| Desligamento via ERP (Senior, Protheus, RM, Datasul) | Efeito colateral: "Exclusão de agendas futuras de 1:1", "Remoção de agendas 1:1 e da agenda integrada", "Quebra do vínculo de liderança" (irreversíveis) | — | Artigos de integração ERP |

Preferências pessoais em Meu perfil > Notificações e push, igual à Parte A. Os tipos de 1:1 nessa lista não estão documentados.

## B.8 Relatórios, painéis, filtros e exportações

**Tela principal "Reuniões 1:1"** (Desenvolvimento)
- Filtros:
  - versão 2023: **Colaborador** ("Busque um Colaborador"), **Categoria** (Todas), **Frequência** (Todas);
  - versão 2025: **Colaborador** (Todos) e **Status do Colaborador** (Ativos).
- Colunas ordenáveis:
  - **Nome do Colaborador**: foto, nome, cargo e etiqueta Liderado/Par;
  - **Última Reunião**: status, data, horário e categoria, ou botão "Finalizar";
  - **Próxima Reunião**: status, data, horário e categoria, ou "Sem reunião agendada" + botão "Criar reunião";
  - **Frequência**: Boa, Ruim ou Sem dados, com dias desde a última.
- Painel **"Em Breve"**: reuniões futuras agrupadas por data, com "Hoje", "Em 35 dias" ou "Há 9 horas". Cada item mostra pessoa, horário e categoria, com o menu Detalhes / Excluir.

**Gestão > Histórico de 1:1** ("Acompanhe os 1:1 de todos seus colaboradores.")
- Filtros *(captura)*:
  - **Unidade** (Todas as filiais) e **Departamento** (Todos os departamentos);
  - **Data inicial** e **Data final** (captura mostra janela de cerca de 90 dias);
  - **Relação entre os participantes** (Todas as relações) e **Categoria** (Todas);
  - **Colaborador** e **Status**;
  - botões "Limpar filtros" e "Filtrar".
- Tabela paginada ("Exibindo 10 resultados por página") com busca "Pesquisar". As colunas não aparecem nas capturas.
- **Exportar** (planilha). As colunas não estão documentadas.

**Acompanhar Gestores → "Resumo de Atividades dos Gestores"** ("Acompanhe os seus gestores com uma visão geral ou individual em tempo real")
- Filtros: Departamento, Data inicial, Data final, com Limpar e Filtrar.
- "Clique no botão ao lado para exportar o resumo de 1:1 de todos os liderados" → **Exportar**.
- Tabela com botões **.xls** e **PDF**, busca e colunas **Foto, Departamento, Tamanho da equipe, Membros que receberam, Eficiência, Satisfação, Detalhes** *(captura)*.
- O texto fala em "eficiência dos gestores e satisfação dos liderados". **De onde vem a "Satisfação" não está documentado.**

**Outros painéis**
- **Painel de Engajamento**: card "Eficiência > 1:1" com tooltip "i" (o texto do cálculo não aparece) e linha "Reuniões 1:1" em "Engajamento por módulo".
- **Resumo de Atividades**: colunas **"1:1 como gestor"** (reuniões feitas no papel de gestor da reunião no período) e **"1:1 como liderado"**.
- **Jornada do Colaborador**: tabela "Reuniões de 1:1 que <pessoa> participa" com Líder, Liderado, Data, Status e Ações (**"Visualizar"**, abre a 1:1).
- **Página inicial**: widget "Como está sua gestão?" com "1:1 — Eficiência: x%" e alerta de 1:1 não finalizadas.

## B.9 Ligações com outros módulos

| Módulo | Ligação |
|---|---|
| **PDI** | Card "PDI" no Resumo do liderado dentro da tela da dupla |
| **Humor, Feedbacks, Objetivos** | Cards no Resumo do liderado ("Feliz", "19 dias que você enviou", "Não possui") |
| **Jornada do Colaborador** | Botão "Jornada Completa". A Jornada lista as 1:1 da pessoa. |
| **Hierarquia (gestor direto / departamentos gerenciados)** | Define Líder, Liderado e Par sem o usuário informar. Desligar alguém via ERP quebra o vínculo e apaga 1:1 futuras. |
| **Gamificação** | Moedas por "Finalizar 1on1" |
| **Painel de Engajamento / Resumo de Atividades / Início** | Eficiência e contagens de 1:1 |
| **Slack** | Notificação individual de agendamento |
| **Google e Microsoft Calendar** | Eventos das 1:1 futuras |
| **Avaliação de desempenho, competências** | Não documentado. Não há vínculo descrito. |

## B.10 Regras, limites e boas práticas

- Só o **líder** finaliza a reunião.
- Pauta com **pelo menos 1 tópico** para criar a reunião.
- Categoria e tópicos se **repetem em todas as reuniões** da recorrência.
- Excluir recorrência apaga as **futuras**. As passadas ficam.
- Reunião excluída **não pode ser recuperada**.
- Integração de agenda vale só para reuniões **marcadas depois** da integração.
- Ações:
  - descrição com no máximo **255 caracteres**;
  - lembrete depois de **14 dias** sem atualização;
  - só o criador edita e conclui;
  - só participantes criam;
  - existem ações sem reunião vinculada, "úteis para acordos feitos fora de uma reunião".
- Não é preciso informar a relação com a pessoa ao criar a 1:1.
- Integração Slack: depois de cada admissão, clicar em "Atualizar usuários" para sincronizar. O canal público precisa ter o mesmo nome de um canal existente.
- A central não traz recomendação de frequência ou duração da 1:1, além do indicador de saúde e do lembrete configurável.

## B.11 Lacunas (ver dentro do sistema logado)

1. Como o sistema decide quem é o **líder** da reunião entre pares, e com quem se pode marcar 1:1 (qualquer pessoa? só da linha hierárquica?).
2. O que acontece ao **finalizar**: se abre resumo, avaliação ou nota; se notifica; se dá para desfazer.
3. **Satisfação** no Acompanhar Gestores: de onde vem (alguma avaliação do liderado?).
4. Fórmulas da **Eficiência de 1:1** (Painel de Engajamento e Acompanhar Gestores) e do corte **Boa/Ruim**.
5. Onde se cadastram **categorias** e **tópicos sugeridos**, e se existem tópicos padrão da Feedz.
6. Edição de reunião e de recorrência (o lápis): campos, efeito nas recorrências e na agenda externa.
7. Lista completa de opções de recorrência (quinzenal? diária?).
8. Destinatário e canal do "lembrete de reunião" e da notificação de 14 dias.
9. Colunas das exportações (Histórico de 1:1 e Resumo de Atividades dos Gestores).
10. Filtros da seção "Reuniões" na tela da dupla.
11. Se as anotações privadas aparecem para o RH/admin ou na exportação.
12. Se a "Pauta Compartilhada" permite editar, apagar ou reordenar tópicos, e marcar tópico como discutido.
13. Se reuniões finalizadas ainda aceitam tópicos e anotações.

**Já respondido em parte no levantamento logado (`telas-logado.md`, outra fonte):**
- Menu atual: Desempenho & Desenvolvimento > Reuniões 1:1 (`/1on1`) e Histórico de 1:1 (`/gestao/1on1`).
- A API interna tem:
  - `1on1/{id}/finish`, `/finish-details`, `/validate-finish`: há detalhes e validação na finalização (ver lacuna 2);
  - **`score-evaluated` ("nota dada ao liderado")**: provável origem da "Satisfação" (lacuna 3);
  - **`ai-suggestions/apply`, `/accept-topic`, `/reject-topic`**: sugestão de pauta por IA, que a central não documenta;
  - `meeting-topics`, `private-notes`, `actions/{id}/finish`, `recurrences/{id}`.

---

# Artigos lidos

**Planos de Desenvolvimento (22)**
- https://ajuda.feedz.com.br/pt-BR/articles/6465181-visao-geral-do-modulo-de-planos-de-desenvolvimento
- https://ajuda.feedz.com.br/pt-BR/articles/6561722-qual-a-diferenca-entre-pdi-trilha-de-desenvolvimento-e-onboarding
- https://ajuda.feedz.com.br/pt-BR/articles/6561742-como-encontrar-e-acompanhar-os-meus-planos-de-desenvolvimento
- https://ajuda.feedz.com.br/pt-BR/articles/6562079-como-criar-um-pdi-para-mim
- https://ajuda.feedz.com.br/pt-BR/articles/6632748-como-atualizar-o-progresso-do-meu-plano-de-desenvolvimento
- https://ajuda.feedz.com.br/pt-BR/articles/6561805-como-criar-um-pdi-para-o-colaborador
- https://ajuda.feedz.com.br/pt-BR/articles/6465157-como-gerenciar-os-pdis
- https://ajuda.feedz.com.br/pt-BR/articles/6465162-como-migrar-dados-do-modulo-antigo-de-pdi
- https://ajuda.feedz.com.br/pt-BR/articles/6616581-como-exportar-os-dados-do-pdi
- https://ajuda.feedz.com.br/pt-BR/articles/9112882-como-editar-o-meu-pdi
- https://ajuda.feedz.com.br/pt-BR/articles/9112909-como-o-gestor-pode-editar-um-pdi
- https://ajuda.feedz.com.br/pt-BR/articles/12958117-o-que-e-e-como-criar-um-pdi-utilizando-o-aconselhador-i-a
- https://ajuda.feedz.com.br/pt-BR/articles/13982933-como-adicionar-cursos-da-afferolab-nos-pdis-da-feedz
- https://ajuda.feedz.com.br/pt-BR/articles/14036771-como-integrar-a-feedz-com-a-afferolab
- https://ajuda.feedz.com.br/pt-BR/articles/6558696-como-criar-e-editar-o-modelo-de-plano-de-onboarding
- https://ajuda.feedz.com.br/pt-BR/articles/6558450-como-criar-e-vincular-um-onboarding-para-um-novo-colaborador
- https://ajuda.feedz.com.br/pt-BR/articles/6558660-como-posso-gerenciar-os-onboardings-da-minha-empresa
- https://ajuda.feedz.com.br/pt-BR/articles/6558021-como-exportar-os-dados-do-onboarding
- https://ajuda.feedz.com.br/pt-BR/articles/6465151-como-vincular-uma-nova-trilha-de-desenvolvimento-a-uma-pessoa
- https://ajuda.feedz.com.br/pt-BR/articles/6560802-como-criar-e-editar-o-modelo-de-trilha-de-desenvolvimento-da-empresa
- https://ajuda.feedz.com.br/pt-BR/articles/6560859-como-gerenciar-as-trilhas-de-desenvolvimento
- https://ajuda.feedz.com.br/pt-BR/articles/6557994-como-exportar-os-dados-da-trilha-de-desenvolvimento

**Reuniões 1:1 (14)**
- https://ajuda.feedz.com.br/pt-BR/articles/8084789-visao-geral-da-tela-de-reunioes-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/6485830-como-configurar-o-lembrete-automatico-para-marcar-a-reuniao-de-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/8007662-como-criar-uma-reuniao-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/8010909-como-vincular-a-reuniao-de-1-1-a-agenda
- https://ajuda.feedz.com.br/pt-BR/articles/8011145-como-remover-recorrencias-na-reuniao-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/8017392-como-adicionar-recorrencias-na-reuniao-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/8017287-como-adicionar-topicos-na-reuniao-de-1-1-marcada
- https://ajuda.feedz.com.br/pt-BR/articles/8017311-como-adicionar-anotacoes-privadas-na-reuniao-de-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/9376383-como-finalizar-uma-reuniao-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/8017329-como-deletar-uma-reuniao-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/8017306-como-visualizar-as-reunioes-1-1-que-ja-aconteceram
- https://ajuda.feedz.com.br/pt-BR/articles/11384846-acoes-na-1-1-como-registrar-as-tarefas
- https://ajuda.feedz.com.br/pt-BR/articles/8010992-como-exportar-os-dados-da-reuniao-1-1
- https://ajuda.feedz.com.br/pt-BR/articles/9616499-como-acompanhar-a-eficiencia-dos-gestores-na-1-1

**Atualizações do Produto: release notes com itens de PDI ou 1:1 (os outros 25 foram varridos por palavra-chave, sem itens desses módulos)**
- https://ajuda.feedz.com.br/pt-BR/articles/9345905-release-notes-fevereiro-24 (tipos de PDI padrão)
- https://ajuda.feedz.com.br/pt-BR/articles/10262708-release-notes-novembro-24 (permissionamento de planos)
- https://ajuda.feedz.com.br/pt-BR/articles/11145051-release-notes-marco-25 (alerta de finalização de 1:1)
- https://ajuda.feedz.com.br/pt-BR/articles/11781643-release-notes-junho-25 (permissionamento do histórico de 1:1)
- https://ajuda.feedz.com.br/pt-BR/articles/14744507-release-notes-marco-26 (relatório de modelos de planos)
- https://ajuda.feedz.com.br/pt-BR/articles/16862785-release-notes-julho-26 (CPF no relatório de PDI)

**Configurações: artigos com menção a PDI ou 1:1 ou que definem notificações e permissões (os outros foram varridos por palavra-chave)**
- https://ajuda.feedz.com.br/pt-BR/articles/6616717-como-integrar-o-slack-com-a-feedz
- https://ajuda.feedz.com.br/pt-BR/articles/6465020-como-configurar-as-notificacoes-que-recebo
- https://ajuda.feedz.com.br/pt-BR/articles/7910810-como-desativar-as-notificacoes-por-e-mail-da-feedz
- https://ajuda.feedz.com.br/pt-BR/articles/9944018-como-ativar-as-notificacoes-push-da-feedz
- https://ajuda.feedz.com.br/pt-BR/articles/6561807-o-que-sao-os-departamentos-gerenciados
- https://ajuda.feedz.com.br/pt-BR/articles/6728919-como-integrar-a-senior-com-a-feedz
- https://ajuda.feedz.com.br/pt-BR/articles/8206093-como-realizar-a-integracao-da-feedz-com-o-protheus
- https://ajuda.feedz.com.br/pt-BR/articles/9210130-como-realizar-a-integracao-da-feedz-com-o-rm
- https://ajuda.feedz.com.br/pt-BR/articles/9210346-como-realizar-a-integracao-da-feedz-com-o-datasul

**Outras coleções, só para as ligações entre módulos**
- https://ajuda.feedz.com.br/pt-BR/articles/6487057-como-ver-o-engajamento-do-gestor-e-da-empresa-por-modulo
- https://ajuda.feedz.com.br/pt-BR/articles/6486843-como-exportar-o-relatorio-do-resumo-de-atividades
- https://ajuda.feedz.com.br/pt-BR/articles/8239755-o-que-e-e-como-chegar-a-tela-de-jornada-do-colaborador
- https://ajuda.feedz.com.br/pt-BR/articles/9376412-como-ganhar-moedas-na-gamificacao
- https://ajuda.feedz.com.br/pt-BR/articles/6484214-como-configurar-os-valores-das-moedas
- https://ajuda.feedz.com.br/pt-BR/articles/6487120-como-exportar-os-dados-de-engajamento-da-lideranca (sem conteúdo de PDI ou 1:1)
- https://ajuda.feedz.com.br/pt-BR/articles/6465084-como-visualizar-o-painel-de-lideranca (sem conteúdo de PDI ou 1:1)
