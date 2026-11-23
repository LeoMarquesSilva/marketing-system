# Feedz (TOTVS RH): Avaliações de Desempenho, Avaliações de Experiência e Mapeamento Comportamental

Engenharia reversa a partir da central de ajuda pública (ajuda.feedz.com.br), coleções "Avaliação de Desempenho" (78 artigos), "Avaliação de Experiência" (30) e "Mapeamento Comportamental" (12). Todos os 120 artigos foram lidos. Regra deste documento: o que a central não diz está marcado como **"não documentado"**. Trechos marcados *(inferido)* são deduções de modelagem, não texto da central.

Convenções usadas no texto:
- AD = Avaliação de Desempenho; AE = Avaliação de Experiência; MC = Mapeamento Comportamental.
- "Tela antiga" x "nova tela de critérios": a Feedz tem dois modelos de configuração de critérios (ver seção 3.6). A central documenta os dois.
- A central repete em quase todo artigo "verifique com o RH se você tem permissão". Existe um perfil **Administrador** (único que altera cadastros) e permissões granulares por usuário (ver seção 2).

---

# PARTE A. AVALIAÇÃO DE DESEMPENHO (AD)

## 1. Propósito e localização no menu

**Propósito** (artigo "Visão geral"): projeto executado quando a empresa precisa analisar comportamentos ou entregas dos colaboradores. Dois objetivos: desenvolver pessoas e ranquear colaboradores pelo desempenho. Os artigos de apoio posicionam a AD como avaliação periódica (sugerida a cada 3 meses, mas a frequência é livre) de quem já passou do período de adaptação, avaliando comportamentos e entregas, com avaliadores: liderança, o próprio colaborador, pares, liderados e clientes internos. Também serve de base para promoções e PDI.

**Caminhos exatos no menu lateral esquerdo:**

| Quem | Caminho |
|---|---|
| Admin (criar/editar/acompanhar) | Desempenho > Administrar avaliações. Quadros: "Avaliações de Desempenho" e "Avaliações de Experiência". Botão azul "Criar avaliação" (canto superior direito); por linha, menu de três pontinhos: Editar, Ver detalhes/Detalhes |
| Admin (comitês) | Desempenho > Administrar comitês (para participante de comitê) ou aba "Comitê" dentro de Ver detalhes |
| Participante / gestor / avaliador | Desempenho > Minhas avaliações. Abas: "Autoavaliações" (o que a pessoa responde/recebe), "Gerenciar avaliações" (avaliações dos liderados do gestor), "Históricos de avaliações" (avaliações passadas de liderados), "Comitês de calibragem" (facilitador) |
| Sucessão | Administrar sucessões > Sucessão |
| Cadastro de colaborador (permissões) | Pessoas > Colaboradores > três pontinhos > Editar > aba Permissões |
| Jornada do colaborador | foto de perfil (canto superior direito) > Colaboradores > três pontinhos > "Jornada do Colaborador (Resumo)" |
| Objetivos (para vincular) | Configurações > "Gerenciar Objetivos" (períodos) |

Telas dentro de "Ver detalhes" (admin): abas **Detalhes** (informações gerais, avaliadores e pesos, escalas e critérios, configurações básicas e avançadas, participantes e prazos), **Status**, **Relatórios**, **Calibragem**, **Comitê**.

## 2. Perfis e permissões

| Perfil | O que faz (documentado) |
|---|---|
| **Administrador** | Único perfil que altera cadastros. Cria/edita avaliação, define critérios, pesos, participantes, gestores; dispara; envia lembrete; envia/remove entrega de resultado; calibra; vê relatórios; gerencia indicações de pares; cria comitês e curva ideal. |
| **Admin com permissão restrita a "administrar apenas as próprias avaliações"** | Administra as que criou; se ligar "Permite visualizar avaliações", vê todas as criadas na empresa (ver item abaixo). |
| **Usuário com "Permite visualizar avaliações"** (Pessoas > Colaboradores > Editar > Permissões > aba "Avaliação de Desempenho") | Acessa a página Detalhes (Detalhes, Status, Relatórios) sem editar/configurar. Alcance: "Todas avaliações" ou "Somente informações de departamentos e unidades gerenciadas" (exige departamentos gerenciados configurados em Permissões). Quem já administra todas as avaliações não precisa disso (opção não pode ser ativada). |
| **Participante / colaborador avaliado** | Autoavaliação; indica pares (se habilitado); vê o resultado quando entregue ("Resultado recebido"); marca "Marcar como recebido" a devolutiva; edita a autoavaliação se permitido. |
| **Gestor do ciclo** (máximo 2 por participante) | Avalia liderado; valida/indica avaliadores; recebe o resultado (manual pelo RH ou automático); entrega o resultado ao liderado (se permitido); entrega a devolutiva; calibra (se permitido); vê 9box dos avaliados (se permitido); adiciona anotações; imprime resultado. |
| **Gestor com liderados diretos e indiretos** | Opções avançadas 3.3 e 4.1 ampliam o que vê (liderados fora do ciclo e liderados dos liderados). Só em empresas cujo modelo de gestão segue o **gestor direto** e não o departamento gerenciado. |
| **Avaliador "Outros avaliadores"** (Par, Liderado, Cliente interno) | Responde a avaliação do indicado; edita resposta quando permitido. |
| **Facilitador do comitê de calibração** | Acessa comitês onde atua; vê resultados (conforme configuração de gestor), vê gráficos, respostas e anotações e pode editar anotações; botões "Agendar 1:1", "Criar PDI", "Entregar resultado" e "Calibrar" ficam ocultos (opção avançada 6.1). Edita o comitê (menu Minhas Avaliações > aba Comitês de calibragem). |
| **Participantes do comitê** | Acessam curva ideal via Desempenho > Administrar comitês. |
| **Administrador da plataforma / analista Feedz** | Liberar "histórico de avaliações passadas para gestores" exige ativação pelo analista/suporte, solicitada pelo administrador da empresa. |
| **Permissão "Sucessão"** | Pessoas > Colaboradores > Permissões > ativa "Sucessão" (módulo faz parte de Avaliações). |

Visibilidade ao participante é configurável (ver seção 7): quadrante, comentários, identificação de avaliadores, notas por avaliador etc.

## 3. Modelo de dados inferido

Tudo abaixo é inferência a partir das telas e opções. Campos listados são os que aparecem na central.

### 3.1 Avaliação (ciclo) `evaluation`
| Campo | Tipo provável | Obrigatório | Observações |
|---|---|---|---|
| tipo | enum {desempenho, experiencia} | sim | escolhido ao "Criar avaliação" |
| nome | texto | sim | ex.: "Avaliação de Desempenho 2023.1"; editável em Rascunho e Em andamento |
| periodo_analisado | intervalo de datas (início/fim do ciclo) | sim | formato "não documentado"; editável em Rascunho/Em andamento. Usado para casar com período de objetivos |
| descricao | texto rico | não | formatação, imagem (.JPG/.PNG, máx. 1920x1080), vídeo (links YouTube, Instagram, Google Drive com compartilhamento liberado) |
| status | enum | sim | valores citados: **Rascunho**, **Indicação**, **Em andamento**, **Finalizado** (ver seção 5) |
| tipos_de_avaliacao | flags {gestores, autoavaliacao, outros_avaliadores} | sim | AD: 3; AE: só gestores e autoavaliação |
| prazo_por_tipo | data (ou data inicio/fim) por tipo | sim p/ tipos marcados | "prazo máximo para envio das respostas" por tipo; a visão geral cita data de início e fim por tipo de respondente |
| peso_por_tipo | percentual (slider) | sim | soma = 100% (AD e AE; na criação de AE a central diz "no máximo 100%") |
| customizar_pesos_outros_avaliadores | bool + pesos {pares, clientes_internos, liderados} | não | soma = 100% |
| indicacao_de_pares | bool + {limite_indicacoes, prazo_indicacao, prazo_validacao} | não | só com "Outros avaliadores" ativo |
| escala/conceito (modelo de resposta) | ver 3.4 | sim | travado após disparo |
| conjuntos de critérios | ver 3.5 | sim | |
| configuracoes_basicas / avancadas | ver seção 7 | | |
| participantes | lista | sim | ver 3.8 |
| comites | lista | não | ver 3.10 |
| curva_ideal | conjuntos {quadrantes, percentual} | não | ver 3.11 |

Etapas de criação (abas numeradas): **1 | Informações iniciais**, **2 | Avaliações e prazos**, **3 | Critérios e respostas** (a visão geral e artigos novos citam "Escala e critérios"), **4 | Configurações**, **5 | Participantes**. Há uma divergência: o artigo de reordenar critérios cita "5 | Critérios e respostas"; os demais (e a visão geral) dizem 3.

### 3.2 Critério `criterion` (competência/pergunta)
| Campo | Tipo provável | Obrigatório | Observações |
|---|---|---|---|
| nome | texto | sim | |
| descricao | texto | recomendado | contextualiza o avaliador; subtítulo exibido ao respondente |
| informacao_adicional | texto | não | tooltip; não editável em critérios padrão da Feedz |
| classe | referência a "classe do critério" | não | agrupamentos para análise (relatório "por classes de critérios"); lista de valores não documentada |
| eixo_9box | enum {X (resultado), Y (comportamento), *indefinido*} | não | opções exatas não documentadas; recomendação: Y = comportamental/fit cultural, X = entregas/resultados |
| origem | enum {padrão Feedz, criado pelo cliente, importado} | | padrão Feedz não é editável; só criados ou importados são editáveis, e só com avaliação em Rascunho |

Editar o critério globalmente "afeta todas as avaliações e relatórios aos quais o critério está vinculado" (tela antiga). Após confirmar a edição não há desfazer.

### 3.3 Configuração específica do critério na avaliação (nova tela) `criterion_config`
| Campo | Tipo | Obrigatório | Observações |
|---|---|---|---|
| nome_da_configuracao | texto | sim | identificação interna para o admin (ex.: qual grupo a versão impacta) |
| descricao_do_criterio | texto | | subtítulo mostrado ao respondente |
| informacao_adicional | texto | | tooltip |
| exibir_para | multi {gestor, avaliado, outras pessoas} | sim | "para quem será exibido" |
| peso | número | sim (padrão por critério) | |
| resposta_obrigatoria | bool | | se sim o respondente não avança |
| nao_sei_responder_nao_se_aplica | bool | | adiciona botão/opção |
| comentario_obrigatorio | bool | | |
| minimo_caracteres | inteiro | | para comentário (ou resposta qualitativa) |
| tipo_resposta | enum {qualitativa, quantitativa} | sim | qualitativa = texto; quantitativa = escala ou conceito |
| formato_quantitativo | enum {escala, conceito} | | |
| nota_esperada | número | não | base para relatórios/gráficos; ajustável por critério |
| conjuntos_de_pessoas | lista | sim, mínimo 1 | critério sem conjunto não entra na avaliação |
| oculto_para_participante | bool | | ícone de configuração na tela inicial, após salvar |
| ordem | inteiro | | a ordem de definição = ordem das perguntas; há "Reordenar critérios" (arrastar) |

Na tela antiga, "Configurações do critério" listava: Tipo de Resposta, Para que será exibido, Peso do critério, Resposta obrigatória, Comentário obrigatório ("Feedback obrigatório"), "etc." Também havia "Personalizar critério" (modelo de resposta) e "Editar descrição".

Regra de precedência (nova tela): as opções das configurações básicas "Exigir comentários dos avaliadores/participantes nos critérios obrigatórios" **sobrepõem** a configuração individual de comentário.

### 3.4 Escala / Conceito (modelo de resposta)
| Campo | Valores |
|---|---|
| modelo | **Escala** ou **Conceito** (trocar exige confirmação "Continuar") |
| figura_da_escala (só Escala) | estrela, coração, foguete |
| descricao_inicio_da_escala / descricao_final_da_escala (só Escala) | texto livre (ex.: "Muito insatisfeito" / "Muito satisfeito") |
| quantidade_de_opcoes | inteiro 3 a 10 (na configuração em massa, é a **única** configuração que não pode variar por critério) |
| opcoes_de_resposta | texto explicativo por opção (aparece ao passar o mouse); Conceito aceita descrições complementares opcionais, sem emoji |
| valor_numerico | cada opção tem valor; maior valor = maior desempenho; usado no cálculo da nota |
| nota_esperada | média esperada, acompanha o nº de opções |

"Configurações em massa" (etapa Escala e critérios): define tipo (qualitativa/quantitativa), formato e padrões para todos os critérios; por critério ainda se pode personalizar via configurações específicas.

### 3.5 Conjunto de critérios (conjunto de pessoas) `criterion_set`
Segmenta critérios por público dentro da mesma avaliação.
| Tipo | Quem recebe |
|---|---|
| **Geral / Todos** | Padrão, todos os participantes (pode ficar vazio) |
| **Liderança** | gestores do ciclo que também são participantes; estendido a quem tem papel de gestão na Feedz pela opção básica "Aplicar Critérios de Liderança aos usuários que possuem papel de gestão" (público: só gestores, só administradores ou ambos) |
| **Departamentos** | participantes **exatamente** do departamento selecionado (lista de departamentos cadastrados) |
| **Cargos** | participantes **exatamente** do cargo selecionado |
Regras: um conjunto por departamento/cargo; excluir pelo "X"; adicionar por "Adicionar Conjunto" / "Adicionar conjunto de pessoas".

### 3.6 Tela antiga x nova tela de critérios
- **Nova tela** (artigos "Nova tela de critérios ..."): usada em avaliações criadas do zero; avaliações antigas duplicadas mantêm o modelo original; não há importador em lote (tudo em tela); critérios têm "configuração específica" por conjunto de pessoas; aba "3) Escala e critérios".
- **Tela antiga**: modelo de resposta global da avaliação (seção "Modelo de resposta" + "Respostas"), critérios em "Conjuntos de critérios" com seletor "Selecione um critério", "Adicionar novo critério" (tela "Informações globais do critério"), aba "3 | Critérios e respostas".
- Os cálculos documentados pela central se referem à **tela antiga**.

### 3.7 Gestores e avaliadores do ciclo
| Entidade | Campos |
|---|---|
| gestor_do_ciclo | participante, gestor (até 2); coluna "Gestores do ciclo"; carregados automaticamente ("Carregar gestores automaticamente") ou manualmente |
| avaliador (outros) | participante avaliado, pessoa avaliadora, relação {Liderado, Par, Cliente interno}, origem (etiqueta, ex.: "Indicação do gestor"), status {Aprovado, Reprovado, pendente *(inferido)*} |

### 3.8 Participante `evaluation_participant`
Campos/estado: pessoa, gestores do ciclo (≤2), outros avaliadores, status de resposta de cada avaliador, resultado parcial, entregas (ao gestor, ao colaborador), devolutiva entregue (gestor), devolutiva recebida (colaborador), calibragem por critério, anotações. Filtros de inclusão (adicionar participantes): todos os colaboradores, departamento, cargo, tempo mínimo de casa de 3, 6, 9 ou 12 meses (exige data de admissão correta). Carregamento automático: "Carregar gestores automaticamente" e "Carregar outros avaliadores automaticamente".

### 3.9 Resposta `answer`
Por avaliador x avaliado x critério: nota (valor da escala/conceito) ou texto (qualitativa), comentário, flag "não sei responder", **nota de calibragem** (separada), estado rascunho/enviada. Rascunho pode ser salvo dentro do prazo; "Enviar avaliação" finaliza.

### 3.10 Comitê de calibração `calibration_committee`
Criado na aba **Comitê > Novo comitê**; várias abas de preenchimento com "Próximo" e "Iniciar comitê". Todas as informações são obrigatórias **exceto "Avaliadores"**. Nomes das abas e campos: **não documentado** (só em imagens). Papéis citados: administrador, **facilitador**, avaliadores (membros). Status: **Rascunho**, **Em andamento**, **Finalizado** (finalizado não edita nem calibra). Documentado também: "Comitês e seus participantes" (relatório de gestão detalha comitês e papéis); anotações com campos "Feedback geral" e "Registro geral do comitê" (visíveis ao participante).

### 3.11 Curva ideal `ideal_curve`
Metas de percentual de avaliados por quadrante da 9box, definidas por avaliação (só em AD e comitês). Estrutura: conjuntos; cada conjunto = um ou mais quadrantes + percentual (0% a 100% por quadrante); soma não pode passar de 100%; a ordem e os percentuais influenciam o resultado; sem regra fixa. Pré-requisito: avaliação em Rascunho ou Em andamento. Exclusão é definitiva (excluir um conjunto: Excluir > Salvar; curva inteira: "Excluir curva ideal" > Excluir). Edição: alterar percentuais, adicionar e excluir conjuntos. Visualização: botão "Curva ideal" mostra gráfico de média ideal x realizada, alternando "Matriz Calibrada" e "Matriz inicial".

### 3.12 Nine Box `ninebox_config`
Configuração acessada em Ver detalhes > Relatórios > 9box > Acessar > "Configurações avançadas" (canto superior direito): por **eixo**: nome, limite de corte de nota baixa e limite de corte de nota alta; por **quadrante**: nome. A nota de corte define o quadrante. Valores padrão e quantidade/nomes dos quadrantes: não documentado (a matriz é 3x3 por definição).

### 3.13 Anotações `evaluation_note`
Por participante, seção "Anotações" no resultado; salvar como rascunho; campos citados "Feedback geral" e "Registro geral do comitê" (visíveis ao participante). A introdução cita anotações **públicas e privadas**, mas o artigo não explica na prática a diferença nem quem vê os outros campos (não documentado).

### 3.14 Ciclo de sucessão (módulo "AD - Sucessão")
`succession_cycle`: nome, descrição, período, status (aguardando; vira "Finalizado" automaticamente ao fim do período). `position` (cargo no ciclo): ocupante atual (exibido), risco de perda e impacto de perda do ocupante, nível de criticidade da posição. `successor`: colaborador (obrigatório), tipo (obrigatório: **Sucessor** = preparo planejado/em desenvolvimento, **Contingência** = assume emergencialmente), opcionais: potencial, nível de prontidão, risco de perda, impacto de perda (valores possíveis não documentados). Ativação: Configurações > Configurações > "Funcionalidades" > Sucessão > Salvar; permissão por usuário "Sucessão".

## 4. Tipos de avaliação e definição dos avaliadores

**Tipos de avaliador (aba 2 | Avaliações e prazos > "Tipos de avaliação")**: Gestores, Autoavaliação, Outros avaliadores (Pares, Clientes internos, Liderados). Marcar/desmarcar cada um; o desmarcado não avalia. Combinações geram os modelos clássicos: só gestor (180°), gestor+auto, 360° (auto + gestor + outros). Os rótulos 90/180/270/360 não aparecem como opção na central, só "360º" no exemplo de cálculo; não há seletor por rótulo (não documentado).

**Como os avaliadores são definidos:**
1. **Gestores**: carregados automaticamente (do cadastro) ou vinculados em 5 | Participantes (botão "Adicionar gestor"/ícone de edição). Até **2 gestores por participante**; com dois, a nota por critério é a **média simples** das duas notas. Troca de gestor: lixeira na coluna "Gestores do ciclo" + "Adicionar gestor" + Salvar; remoção em massa de todos os gestores via Participante > Remover > Gestor(es). Pode ser feita em avaliação em andamento (aba 5 | Participantes via Editar).
2. **Autoavaliação**: o próprio participante.
3. **Outros avaliadores**: (a) carregados automaticamente ("Carregar outros avaliadores automaticamente", critério de carga: não documentado) ou vinculados manualmente em 5 | Participantes > "Adicionar avaliadores" (janela: selecionar pessoas, definir relação, lixeira para remover); (b) **indicação de pares** pelos participantes, validada pelo gestor (seção 5.2).
4. **Por cargo/time**: não há "avaliação por time" como tipo; a segmentação é por **conjuntos de critérios** (por cargo, departamento, liderança) e por filtro de participantes (todos, departamento, cargo, tempo de casa).

## 5. Fluxo do ciclo (passo a passo e estados)

### 5.1 Criação e configuração (admin)
1. Desempenho > Administrar avaliações > "Criar avaliação" > escolher "Avaliação de desempenho". Abre em **1 | Informações iniciais** (nome, período, descrição) > Próximo.
2. **2 | Avaliações e prazos**: tipos de avaliação (Gestores, Autoavaliação, Outros avaliadores), prazo máximo de resposta por tipo, indicação de pares (opcional), "Peso das Avaliações" (soma 100%), "Customizar pesos de outros avaliadores".
3. **3 | Critérios e respostas** (ou "Escala e critérios"): modelo de resposta, quantidade de opções, critérios e conjuntos.
4. **4 | Configurações**: básicas e avançadas (seção 7).
5. **5 | Participantes**: Adicionar participantes (filtros), vincular gestores e outros avaliadores, Salvar.
6. Botões de rodapé: **Salvar rascunho** (guarda e volta; avaliação fica em Rascunho) e **Próximo/Finalizar** (Finalizar conclui as edições e dispara *(inferido; a central não descreve explicitamente o botão "disparar" da AD, só que ao ser "disparada" entra em andamento)*).
7. Antes de disparar: aba Detalhes > "Escalas e Critérios" > "Baixar relatório de critérios" (xlsx) para conferir a ordem.

### 5.2 Fase de indicação (se habilitada)
Status **Indicação** (aparece na lista do gestor). Responsáveis:
1. Admin configura (em Rascunho): limite de indicações, prazo de indicação, prazo de validação.
2. **Participante** indica avaliadores (Desempenho > Minhas avaliações > aba Autoavaliações > Ações > "Indicar pares"; coluna Ações com botão "Indicar"/"Indicado"; coluna "Feedbacks trocados" ranqueada por quem mais enviou/recebeu feedbacks no período da avaliação; botão "Finalizar Indicação" duas vezes + OK). Envio definitivo; correção só via gestor/RH.
3. **Gestor do ciclo** valida (Minhas avaliações > aba Gerenciar avaliações > avaliação com status Indicação > Ações > Detalhes > liderado > Ações > "Validar pares"): para cada indicado define relação (Liderado, Par, Cliente interno) e clica Aprovar ou Reprovar; pode "Adicionar avaliador" (busca > "Indicar"; entra como "Aprovado" com etiqueta "Indicação do gestor"); "Enviar" duas vezes. Envio definitivo; alterações só pelo RH.
4. **Admin** acompanha/ajusta na aba 5 | Participantes (status Rascunho ou Indicação): "Adicionar avaliadores" para quem não indicou ninguém no prazo, mesmo após o prazo.
- Relatórios: "Participantes e suas indicações", "Participantes que não realizaram indicações".
- Nomes dos status de cada indicação e detalhes de "validação": não documentado.

### 5.3 Disparo e respostas
- Avaliação entra em **Em andamento**; escalas e critérios ficam bloqueados. Nome/período/descrição ainda editáveis; participantes, gestores e avaliadores podem ser editados via Editar > 5 | Participantes.
- Notificação na tela inicial até enviar. Autoavaliação: janela "Propósito dessa avaliação" > Fechar; cabeçalho mostra dias restantes, período avaliado e histórico do colaborador na Feedz naquele período; cada critério é quantitativo (escala + justificativa opcional) ou qualitativo (texto); "Salvar rascunho" (dentro do prazo) e "Enviar avaliação". Avaliador responde a avaliação do outro, não a sua própria.
- Admin envia lembrete: Ver detalhes > "Enviar lembrete" (cabeçalho) > Enviar (somente status Em andamento).
- Acompanhamento: Ver detalhes > aba **Status**: quantidade de respostas (autoavaliações e avaliações de gestores/avaliadores), resultados parciais, Timeline (ações com data e hora), seção **Participantes**.

### 5.4 Edição de respostas
Condições cumulativas: status Em andamento; resultado ainda não entregue ao participante/gestor; dentro do prazo; opção "Permitir a edição das respostas nas avaliações realizadas" ativa (aba 4 | Configurações, seção "Edição de respostas"). Participante: Minhas avaliações > Autoavaliações > Ações > "Editar autoavaliação". Gestor: Gerenciar avaliações > Ações > Detalhes > colaborador > Ações > "Editar avaliação". Avaliador (Par, Cliente interno, Liderado): Gerenciar avaliações > Detalhes > colaborador > "Editar avaliação" (opções de salvar/enviar não documentadas). Botões: "Salvar como rascunho" e "Continuar" (envia). Se o resultado já foi entregue, remover as entregas antes.

### 5.5 Calibração (quatro formas)
Objetivo: alinhar/ajustar notas para reduzir distorções. Todas escrevem em uma coluna **"Nota calibragem"** (nota original preservada; relatórios mostram nota antes e depois).
1. **Comitê de calibração** (grupo; avaliador + facilitador; às vezes especialistas).
2. **Tela Calibragem** (admin): Ver detalhes > aba **Calibragem**: lista de todos os participantes e notas, busca, visão geral, seta para expandir critérios e calibrar.
3. **Pela tela de Resultado Final** (gestor ou admin): admin: Status > Participantes > Ações > Resultado > "Calibrar"/"Recalibrar" > coluna "Nota calibragem" > Salvar; só para quem **ainda não teve resultado entregue**. Gestor: Gerenciar avaliações > Detalhes > seção "Avaliações como gestor" > liderado > Ações > "Calibrar". Requisitos do gestor: avaliação Em andamento; apenas o gestor recebeu o resultado; flag "Gestores: Permitir que façam calibragem dos critérios do participante" ativa.
4. **Pela 9box**: Relatórios > 9box > Acessar > lista no fim da página > Ações > Calibrar > Salvar. Cada critério é calibrado separadamente e muda a média final.
(Na AE a tela Calibragem exibe: nº de participantes, média geral do ciclo, melhor e pior critério (média), por colaborador: nota autoavaliação, nota gestor, média dos avaliadores, média geral, campo de calibração, resultado após calibragem; e permite enviar resultados. Presume-se igual na AD, mas a central da AD não lista essas colunas.)

### 5.6 Entrega do resultado, devolutiva e encerramento
Sequência recomendada pela central: todos respondem → calibração → RH envia ao gestor (ou automático) → gestor entrega ao liderado → reunião de devolutiva → gestor "Entregar devolutiva" → colaborador "Marcar como recebido".

- **Envio do resultado pelo RH**: Ver detalhes > aba Status > Participantes > Ações: "Enviar resultado para o colaborador" ou "Enviar resultado para o gestor" (confirmar Enviar duas vezes). **Em massa**: botão "Enviar resultado" > "Enviar para todos os colaboradores" ou "Enviar para todos os gestores".
- **Automático ao gestor**: opção básica "Enviar automaticamente aos gestores o resultado" (após todos os avaliadores responderem).
- **Entrega pelo gestor ao liderado** (exige opção avançada 3.1 e resultado já enviado ao gestor): Minhas avaliações > Gerenciar avaliações > Ações > Detalhes > participante > Ações > "Ver resultado" > "Entregar Resultado" (canto superior direito) > confirmar.
- **Colaborador vê**: Minhas avaliações > Autoavaliações > Ações > "Resultado recebido" (desabilitado se não entregue). Mostra notas, quadrante da 9box, gráficos, comentários. Aviso por e-mail e na plataforma quando liberado.
- **Devolutiva**: reunião 1:1 / feedback do gestor com o colaborador, ideal após todos responderem; momento de criar o PDI. Gestor tem campo para registrar feedbacks (Feedback geral) antes da reunião. Requisito: opção "Permitir que o status da devolutiva seja informado" (participantes, gestores ou ambos). Gestor: Ações > "Entregar devolutiva" > ler alerta > Entregar > OK. Colaborador: Autoavaliações > Ações > "Marcar como recebido" > ler alerta > "Recebido".
- **Remover entregas**: individual (Status > Participantes > Ações > "Remover Entregas" > Enviar > OK) ou em massa (botão "Enviar resultado" abaixo da lista > opção de remover entrega de todos > "Remover entregas"). Só enquanto Em andamento. Remove também a devolutiva do gestor já enviada. Após novo envio, o gestor refaz as etapas.
- **Encerramento**: a empresa "finaliza" a avaliação; após isso não há edição de respostas (status **Finalizado**). Botão/ação exata de encerrar e o comportamento de **reabrir**: **não documentados**. Só se sabe que 9box e histórico exigem avaliação em andamento ou finalizada, e que o export "última avaliação" considera as com status Finalizado e entregues.
- **Imprimir resultado**: Status > Participantes > Ações > Resultado > "Imprimir" (Ctrl+P) (gestor do ciclo também imprime, na tela do liderado).

### 5.7 Estados e transições (consolidado)
```
Rascunho --(Finalizar/disparar)--> [Indicação]* --(prazo de validação)--> Em andamento --(empresa finaliza)--> Finalizado
```
\* só quando "Indicação de pares" está ativa. A central cita explicitamente os estados Rascunho, Indicação, Em andamento e Finalizado. Transições automáticas por data (ex.: Indicação para Em andamento), cancelamento e reabertura: não documentados. Regras por estado:
| Ação | Estados permitidos |
|---|---|
| Editar nome/período/descrição | Rascunho, Em andamento |
| Editar escala/critérios | somente Rascunho (bloqueado em Em andamento) |
| Editar indicações | Rascunho, Indicação |
| Comentário obrigatório por critério (tela antiga) | Rascunho |
| Enviar lembrete | Em andamento |
| Remover entregas | Em andamento |
| Editar respostas | Em andamento + resultado não entregue + no prazo |
| Baixar relatório de critérios | Rascunho, Em andamento, Indicação (com critérios cadastrados) |
| Curva ideal | Rascunho, Em andamento |
| 9box (acesso/config/calibrar) | Em andamento ou Finalizado |

## 6. Cálculos

### 6.1 Fórmula geral (tela antiga)
1. **Nota por critério** = Σ (nota do avaliador x peso do tipo de avaliador).
2. **Nota ponderada do critério** = nota do critério x peso do critério.
3. **Nota final** = Σ (nota do critério x peso do critério) / Σ (pesos dos critérios).

Exemplo 1 (só gestor 100%, escala 1-6; Responsabilidade peso 1 = 6; Proatividade peso 1 = 5): (6+5)/2 = 5,5.
Exemplo 2 (gestor 80%, participante 20%; Responsabilidade peso 1: gestor 5, part. 6; Proatividade peso 3: gestor 4, part. 6): Resp. = 5x0,8+6x0,2 = 5,2; Proat. = 4x0,8+6x0,2 = 4,4; (5,2x1 + 4,4x3)/4 = 18,4/4 = **4,6**.
Exemplo 360 (Alice; auto 30%, gestor 50%, outros 20%; pesos de critério 1,1,1,6): média por critério = (nota auto x 0,3 + nota gestor x 0,5 + nota outros x 0,2); final = Σ(média x peso)/Σpesos = **4,94**. A central contém inconsistência numérica na conta da média por tipo de avaliador (a divisão da autoavaliação só fecha ponderando por peso); registrar como "ambíguo".

### 6.2 Pesos
- Peso por tipo de avaliador: sliders, soma = 100%.
- Pesos de "Outros avaliadores": customizável entre Pares, Clientes internos e Liderados (soma 100%).
- Dois gestores: média simples das notas dos dois por critério, ex.: (8+7)/2 = 7,5.
- **Redistribuição automática (avançada 5.2)**: se um tipo de avaliador não respondeu, seu peso é redistribuído (ex.: gestor 50% + auto 50%, sem auto → gestor 100%). Na AE: "quando todas as avaliações forem concluídas, os pesos voltam aos valores originais".
- **Redistribuição entre outros avaliadores (5.3)**: peso do ausente é dividido igualmente entre os demais (ex.: Liderado 30, Par 30, Cliente 40; sem Liderado → Par 45, Cliente 55).
- Peso do critério: define influência do critério na média final.
- Nota esperada: só base de relatórios/gráficos, não entra na nota.

### 6.3 Calibração
A "Nota calibragem" substitui a nota do critério nos relatórios "após calibração". Relatório "Análise completa por critério": coluna F = nota final antes da calibração (com pesos dos avaliadores); coluna G = após calibração; colunas G a R = nota final por critério. Rankings por departamento e cargo usam notas **antes** da calibração; ranking global usa média auto/gestor/demais e nota final (com pesos e calibração); "Ranking por critérios" ignora pesos e calibração (para a nota final, filtrar "Todas as respostas" pela competência e tirar a média da coluna Q). Como a calibração interage com a regra de dois gestores ou com a redistribuição de pesos: não documentado.

### 6.4 Nine Box
- Dois eixos: **X = Resultado** (entregas), **Y = Comportamento** (fit cultural). Cada critério tem um "Eixo da 9 box" (campo do critério); a nota de cada eixo = agregação dos critérios do eixo *(inferido; fórmula não documentada)*. Pontuações classificadas em baixa, média e alta usando **nota de corte baixa e alta por eixo** configuráveis. Nomes de eixos e quadrantes são editáveis.
- **Metas no resultado**: opção avançada 5.1 "Substituir os Critérios de Resultado pelos resultados obtidos nos objetivos/metas definidos na Feedz": o eixo X passa a refletir a **média dos resultados dos objetivos** do colaborador (percentual de atingimento). Regras: objetivos públicos, privados ou ambos; colaborador deve ser **dono, responsável ou contribuinte** (ser só responsável por resultado-chave não basta); o objetivo deve estar **totalmente dentro do período da avaliação** (ex.: avaliação 01/01-31/01/2025: válidos 05/01-20/01 e 01/01-31/01; inválidos 28/12/2024 ou até 05/02/2025). Uma versão do artigo diz que o período deve ser "exatamente igual". A vinculação não cria nota nem critério, só mostra o atingimento no eixo X. Fórmula por objetivo e pesos: não documentado. Habilita o relatório "Análise por comportamento e resultados de objetivos".
- Quadrante é mostrado ao participante se "Exibir quadrante do participante" ativo; para o gestor sempre ativo.

### 6.5 Outros
- Resultado pode ser exibido como **conceito** em vez de nota ("Exibir resultados em forma de conceito"); regra de mapeamento nota-conceito: não documentado.
- Gráfico da jornada do colaborador: três ponteiros (colaborador azul = média final; time vermelho = média de todos os participantes da avaliação; departamento amarelo = média do departamento do colaborador), um ponto por avaliação finalizada.

## 7. Configurações do módulo (aba 4 | Configurações)

### 7.1 Básicas
1. Enviar automaticamente notificações por e-mail (nova avaliação, lembretes, resultado disponível).
2. Exigir comentários dos avaliadores nos critérios obrigatórios.
3. Exigir comentários dos participantes na autoavaliação nos critérios obrigatórios.
4. Permitir a edição das respostas nas avaliações realizadas (seção "Edição de respostas").
5. Permitir que o status da devolutiva seja informado (participantes / gestores / ambos).
6. Enviar automaticamente aos gestores o resultado da avaliação.
7. Aplicar critérios de Liderança aos usuários com papel de gestão na Feedz (só gestores / só administradores / ambos).
8. Exibir prévia do resultado dos participantes aos gestores (nota da autoavaliação e notas dos pares durante o ciclo; na AE: notas da autoavaliação e as dadas pelo próprio gestor).
9. Exibir resultados em forma de conceito.
Valores padrão: não documentados.

### 7.2 Avançadas
1. **Resultado final**: 1.1 exibir quadrante do participante (para gestor sempre ativo; único padrão documentado); 1.2 exibir comentários e feedbacks por critério (para colaboradores/gestores/outros avaliadores); 1.3 exibir identificação dos avaliadores para administradores; (nova tela) gráficos de apresentação por classe, critério e departamento, para gestores e participantes.
2. **Participantes**: 2.1 limitar acesso apenas à nota final (sem notas por avaliador; na AE desativa o gráfico teia); 2.2 ocultar critérios no resultado final (eixos X e/ou Y; só notas); 2.3 exibir nomes dos outros avaliadores na página de autoavaliação.
3. **Gestores nesta avaliação**: 3.1 entregar resultado final; 3.2 calibragem dos critérios do participante; 3.3 exibir liderados diretos e indiretos além dos da avaliação; 3.4 exibir os outros avaliadores dos participantes; 3.5 acesso ao relatório 9box (só dos avaliados por ele).
4. **Gestores indiretos**: 4.1 acesso aos dados de liderados indiretos (Paulo > Maria > Pedro); só no modelo de gestão pelo gestor direto.
5. **Pesos e critérios**: 5.1 substituir critérios de resultado por objetivos/metas; 5.2 redistribuir pesos entre tipos; 5.3 redistribuir pesos entre outros avaliadores.
6. **Comitê de calibragem**: 6.1 permitir que o facilitador acesse a tela de resultados dos avaliados dos comitês dele.
Configuração por empresa (não por avaliação): "histórico de avaliações passadas para gestores" (via analista/suporte; só no modelo gestor direto).

## 8. Notificações e lembretes
- E-mails automáticos (se ativo): nova avaliação, lembrete de resposta, resultado disponível.
- Lembrete manual: botão "Enviar lembrete" (Ver detalhes), status Em andamento; destina-se a avaliadores que ainda não responderam.
- Notificação na tela inicial para responder/indicar/validar, que permanece até o envio.
- Aviso por e-mail e na plataforma quando o resultado é liberado.
- Relatórios de pendência: "Participantes e suas ações" (quem já fez autoavaliação e avaliou os outros).
- Cadência de lembretes automáticos (dias antes do prazo), texto dos e-mails e canais além de e-mail/in-app: **não documentado** na AD.

## 9. Relatórios, painéis, filtros e exportações
Visíveis só a Administradores (aba Relatórios em Ver detalhes). Gestão: botão "Baixar" direto; Desempenho: "Acessar" e baixar dentro. Formatos e filtros gerais: não documentados (artigos citam Excel/PDF em pontos específicos).

**Relatórios de Gestão**: Participantes e seus avaliadores (sem notas); Todas as respostas da avaliação (nota de cada avaliador por critério); Participantes e suas ações; Participantes e entregas (entregas, feedback, recebimento); Participantes e suas indicações; Participantes que não realizaram indicações; Comitês e seus participantes.

**Relatórios de Desempenho**: Análise completa por critério; Análise completa por classes de critérios; Ranking global; Ranking por departamento; Ranking por cargos; Ranking por critérios; Avaliação outliers (pontos fora da curva, positivos/negativos); 9 Box; Mapa de calor (escolhe informação; cores acima/abaixo/na média da empresa); Análise por comportamento e resultados de objetivos (só com a opção 5.1).

**Outros**:
- Relatório de critérios (xlsx): ordem, nome, classe, eixo 9box, tipo de resposta (qualitativa/quantitativa), formato (escala/conceito), modelo de resposta, obrigatoriedade de resposta, obrigatoriedade de comentário, peso, destinatários. Até 349 registros gera na tela; a partir de 350 é enviado por e-mail.
- Botão "Exportar" em Administrar avaliações: planilha com a última AD finalizada de cada colaborador (só com avaliações entregues e Finalizado).
- 9box do gestor: filtros + "Aplicar"; clique no colaborador mostra mudanças de quadrante; lista com ícones PDF e Excel; "Ver resultado" por participante.
- Gráfico de AD na Jornada do Colaborador (seção 6.5).
- Impressão do resultado individual (Ctrl+P).
- Painel de curva ideal x realizada (comitê).

## 10. Ligações com outros módulos
- **Objetivos/Metas (OKR)**: períodos em "Gerenciar Objetivos"; objetivos alimentam o eixo X da 9box (seção 6.4).
- **PDI**: a devolutiva é o momento de criar o plano de desenvolvimento individual; botão "Criar PDI" existe no resultado (oculto ao facilitador). Detalhes do PDI: não documentado aqui.
- **1:1**: botão "Agendar 1:1" no resultado (oculto ao facilitador).
- **Feedback**: coluna "Feedbacks trocados" na indicação de pares usa o histórico de feedbacks do período.
- **Cargos/Departamentos/Colaboradores**: conjuntos por cargo e departamento; filtros de participantes; hierarquia de gestores (gestor direto x departamento gerenciado); data de admissão para tempo de casa.
- **Jornada do Colaborador**: gráfico de avaliações finalizadas.
- **Sucessão**: módulo do pacote Avaliações, ciclo sucessório por cargo (3.14); relação direta com notas/9box não documentada.
- **Recrutamento & Seleção**: usa o teste de personalidade do MC (seção 12).

---

# PARTE B. AVALIAÇÃO DE EXPERIÊNCIA (AE)

## 11. Avaliação de Experiência

**Propósito**: processo de teste no início da jornada de recém-contratados; decidir se o colaborador continua. Base legal citada: parágrafo único do art. 445 da CLT (máx. 90 dias). Momento ideal 45 a 60 dias. Avalia comprometimento com onboarding, integração com a equipe e alinhamento aos valores. Avaliadores: liderança e, às vezes, o próprio colaborador (que pode avaliar condições de trabalho). Decisão: manter ou não. Frequência: uma vez.

**Caminho**: Desempenho > Administrar avaliações > seção "Avaliações de Experiência" > "Criar avaliação" > "Avaliação de experiência". Etapas (abas numeradas): **1 Informações iniciais** (nome, descrição), **2 Avaliadores** (Tipos de Avaliação: Gestores e/ou Autoavaliação; Peso das Avaliações, soma 100%), **3 Critérios e respostas**, **4 Configurações** (básicas e avançadas), **5 Participantes e prazos**. Mesmo editor de critérios, conjuntos, escala/conceito, relatório de critérios (xlsx) e calibragem da AD.

**Diferenças em relação à AD**:
| Aspecto | AE | AD |
|---|---|---|
| Avaliadores | Gestores e Autoavaliação apenas (sem pares/liderados/clientes) | + Outros avaliadores |
| Participantes | **automáticos** por tempo de experiência (data de admissão) | selecionados manualmente/por filtro |
| Indicação de pares | não | sim |
| Comitê / curva ideal | não documentado para AE | sim |
| Prazos | em dias a partir da entrada do participante | datas fixas por tipo |

**Gatilhos automáticos pela data de admissão**:
- Participantes definidos pelo **tempo de experiência**: dias desde a admissão (barra azul ou caixa numérica) em 5 - Participantes e prazos.
- Pré-requisitos do colaborador: data de admissão preenchida (dentro do prazo definido na avaliação) e status **ativo**; cadastrado na Feedz nos últimos **89 dias**.
- Limite legal 90 dias: tempo de experiência + prazo de resposta não pode ultrapassar **45 ou 90 dias** (quanto mais perto do limite o tempo de experiência, menor o prazo de resposta). Prazo de resposta é sugerido automaticamente e editável.
- Automação roda **todo dia às 7h**: quem fica elegível entra no dia seguinte às 7h.
- Exemplos oficiais: (1) inclusão aos 30 dias de admissão, limite 89 dias, 59 dias para responder; (2) disparo no 60º dia com 5 dias de resposta; RH tem informações no 65º dia.
- **Inclusão manual**: Ver detalhes > aba Status > seção Participantes > "Adicionar participantes" > selecionar > Adicionar (duas vezes). Elegível se: cadastrado nos últimos 89 dias, data de admissão dentro do prazo, status ativo.
- **Exclusão** de participante: Status > Participantes > Ações (três pontinhos) > "Excluir participante" > Remover. **Irreversível e apaga os resultados feitos e recebidos por essa pessoa.**
- **Editar prazo de resposta** de um participante em andamento: Detalhes > Status > Participante > três pontinhos > "Editar prazos de resposta" > Salvar > Alterar (pode ultrapassar o limite de 90 dias).
- **Trocar gestor avaliador**: Editar > aba Status > Participantes > três pontinhos > "Alterar gestor avaliador" > escolher > Salvar > Alterar. Se o gestor antigo já avaliou, **a avaliação dele é excluída, de forma definitiva**.

**Configurações básicas da AE**: e-mails automáticos; exigir comentários dos gestores e dos participantes (autoavaliação) nos critérios obrigatórios (sem comentário não avança); permitir edição das respostas (até o limite do prazo e se resultado não entregue); permitir que o status da devolutiva seja informado; enviar automaticamente ao gestor o resultado; aplicar critérios de Liderança a quem tem papel de gestão; exibir prévia do resultado aos gestores.
**Avançadas da AE**: exibir comentários e feedbacks por critério (gestores e/ou participantes); gráficos de apresentação dos resultados (gestores e/ou participantes); limitar visualização do participante à nota final (desativa gráfico teia); ocultar critérios no resultado individual (eixos X/Y); gestor entrega resultado; gestor calibra critérios; ver liderados diretos e indiretos; acesso ao relatório 9box; acesso a liderados indiretos; redistribuição automática de pesos.

**Acompanhamento** (Ver detalhes): páginas "Informações gerais", "Avaliadores e pesos", "Escalas e critérios", "Configurações básicas e avançadas", "Participantes e prazos"; seção **Status** (percentual de autoavaliação, andamento dos gestores); ações por participante: alterar gestor avaliador, editar prazos, ver resultado, enviar resultado ao gestor, enviar resultado ao colaborador, excluir participante; Timeline; Calibragem; Relatórios.

**Resultado, devolutiva e entrega**:
- RH: Status > Participantes > Ações > "Enviar resultado para o colaborador" / "Enviar resultado para o gestor" > Enviar. Depois do envio, quem ainda não avaliou perde a possibilidade de avaliar/editar.
- Gestor entrega: Minhas avaliações > Gerenciar avaliações > Ações > Detalhes > colaborador > Ações > "Ver resultado" > "Entregar resultado" (exige ação habilitada e resultado enviado ao gestor).
- Devolutiva: reunião 1:1/feedback; campo "Feedback Geral" no resultado; gestor "Entregar devolutiva" exige: config ativa, resultado enviado ao gestor, resultado já entregue ao colaborador. Colaborador: Autoavaliações > Ações > "Marcar como recebido" > Recebido.
- Colaborador vê: Autoavaliações > Ações > "Resultado recebido" (notas e comentários).
- Remover entregas: Status > Participantes > três pontinhos > "Remover entregas" > Remover (só Em andamento; gestor e participante deixam de ver o resultado; remove devolutiva do gestor; "a remoção só é possível quando todas as entregas dos envolvidos forem removidas").
- Edição de respostas: mesmas condições e caminhos da AD (seção "Edição de respostas" em 4 - Configurações; só visões participante e gestor documentadas).
- Calibração: aba Calibragem (preencher e Salvar) ou Status > Participantes > Ações > Resultado > Calibrar/Recalibrar > "Nota calibragem" > Salvar; só se resultados ainda não entregues.
- Relatórios: 13 (iguais aos de desempenho/gestão da AD, exceto indicações, comitês e análise de objetivos): Participantes e seus avaliadores; Todas as respostas; Participantes e suas ações; Participantes e entregas; Análise completa por critério; por classes; Ranking global/departamento/cargos/critérios; Avaliação outliers; 9 box; Mapa de calor. 9box da AE: eixos resultado e comportamento; disponível com avaliação em andamento ou finalizada.

**Decisões (efetivar/desligar)**: a central **não documenta** nenhum campo ou fluxo de decisão (efetivar/prorrogar/desligar), nem integração com contrato ou admissão. A "decisão" é conceitual (blog/artigo comparativo). Deve ser tratada como lacuna a preencher no ORQESTRAI.

**Boas práticas citadas**: Playbook de AE (PDF), blog "Avaliação de experiência: 45 e 90 dias", nine box, 50 feedbacks prontos.

---

# PARTE C. MAPEAMENTO COMPORTAMENTAL

## 12. Mapeamento Comportamental (DISC)

**O que é**: teste de perfil comportamental baseado na metodologia **DISC**: Dominância (D), Influência (I), Estabilidade (S) e Conformidade (C). Usos sugeridos: recrutamento, desenvolvimento de equipes, liderança/coaching, resolução de conflitos. Também usado em Recrutamento & Seleção (teste de personalidade de candidatos; "Feedz Persona" é o nome citado do teste).

**Onde fica**: Pessoas > Mapeamento Comportamental (tela do RH/gestor); Pessoas > Colaboradores (envio e export); "Minha Área" > "Meu mapeamento comportamental" (colaborador); Jornada do Colaborador (resumo).

**Perfis e permissões** (Pessoas > Colaboradores > Editar > Permissões > aba "Mapeamento Comportamental"):
- "Permite enviar Mapeamentos comportamentais": acesso à tela de Colaboradores só para enviar.
- "Permite visualizar a tela de Testes de personalidade": gerenciar o MC (ver dados, enviar lembretes, acessar logs, exportar relatórios).
- "Permite envio de Testes de personalidade": acesso à tela do MC e aos mapeamentos já realizados.
- "Permite visualizar a tela de Mapeamento Comportamental" (gestor): ver resultados dos liderados, inclusive anteriores à gestão atual.
- Desde 15/07/2026, a tela nova de visualização exige permissão; a Jornada do Colaborador continua visível. Exportar relatório: apenas perfil administrador.

**Envio**: individual (Pessoas > Colaboradores > três pontinhos do colaborador > "Enviar mapeamento comportamental" > Enviar) ou em massa (três pontinhos no canto superior direito > "Enviar mapeamento comportamental em massa" > Enviar). Colaborador recebe e-mail e o item aparece na tela inicial. **28 perguntas padronizadas, não personalizáveis. Prazo para responder: até 30 dias.** Filtros do envio em massa e o que ocorre ao expirar: não documentado.

**Resposta**: e-mail ou tela inicial > "Iniciar mapeamento"; 28 telas em ordem aleatória, cada uma com conjunto de palavras; escolher a que **mais** e a que **menos** se identifica (devem ser diferentes); botões Próximo/Anterior; "Acessar resultado" ao fim. Se não concluir: tela "Resultado Inconclusivo" e o RH precisa reenviar o link.

**Cálculo do resultado**: considera a intensidade em cada dimensão (régua de **1 a 7** no gráfico) e pontuação total. Dimensão principal = maior intensidade. Resultado exibido como código, ex.: "D1 - I6 - S7 - C4". **Conclusivo** exige pontuar **acima de 4** em ao menos uma dimensão; senão é inconclusivo (oferece refazer). **15 padrões** de perfil: Especialista, Convincente, Perfeccionista, Inspirador, Criador, Praticante, Representante, Orientador, Investigador, Orientado para resultados, Promotor, Desbravador, Avaliador, Pensador objetivo e Realizador. **Desvios** (quatro pontos na mesma zona, sem padrão): desvio central (zona central, ≤1 segmento de diferença), para baixo e para cima. A tabela de pontuação por palavra e o mapeamento código-padrão: não documentados.

**Resultado**: RH: Pessoas > Mapeamento Comportamental > buscar colaborador > "Ver resultado" (abre nova guia); ou Jornada do Colaborador (Resumo): data de realização, tipo de perfil e gráfico com percentual de cada característica DISC, mais "Acessar resultado completo". Colaborador: "Minha Área" > "Meu mapeamento comportamental"; PDF via Ctrl+P > Salvar como PDF (retrato, todas as páginas).

**Acompanhamento e lembretes**: no terceiro bloco da tela, lista de testes sem resposta dentro dos 30 dias, botão "Enviar Lembrete" > Enviar; habilitado só se houver pendentes; e-mail com link do teste; pode enviar mais de uma vez por dia. **Aviso automático 10 dias antes da expiração**, único e agregado, só para quem administra a tela.

**Relatório/export**: Pessoas > Colaboradores > três pontos (canto superior esquerdo) > "Baixar relatório mapeamento comportamental": gerado de forma assíncrona; enviado por e-mail e notificação na Feedz. Formato: não documentado.

**Dashboard DISC**: Pessoas > Mapeamento Comportamental > seção "Análise dos resultados". Só dados de mapeamentos feitos a partir de **04/06/2025**, de colaboradores com resultado válido e sem desvios. Cálculo: cada dimensão em que a pessoa se destaca conta uma **presença** (uma pessoa pode contar em várias); total de presenças = D+I+S+C; % da dimensão = presenças da dimensão / total de presenças x 100 (soma 100%). Exemplo: D=1, I=2, S=2, C=1 (total 6) = 16,7% / 33,3% / 33,3% / 16,7%. Critério para "destacar-se" numa dimensão no dashboard: não documentado explicitamente.

---

# 13. Lacunas (o que a documentação não deixa claro)

AD / geral:
- Formato do campo "período a ser analisado" e relação exata com datas de prazo por tipo.
- Botão/ação exata de **disparar** e de **finalizar/encerrar** a avaliação; **reabrir** avaliação; cancelamento; transições automáticas por data; lista completa de status (só citados Rascunho, Indicação, Em andamento, Finalizado).
- Critério de carga automática de "outros avaliadores"; valores de "classe do critério" e opções de "Eixo da 9 box"; padrão de cada configuração; quantidade/nomes padrão dos quadrantes da 9box; como a nota de cada eixo é agregada.
- Rótulos 90/180/270/360 não existem como seletor.
- Conta do cálculo da média por tipo de avaliador tem inconsistência no artigo; interação entre calibração, dois gestores e redistribuição de pesos.
- Mapeamento nota-conceito ("exibir resultados em forma de conceito").
- Cadência dos lembretes automáticos, prazos e conteúdo dos e-mails; efeito de resposta fora do prazo.
- Campos e abas do comitê de calibração (só imagens), papéis além de facilitador/admin, quem é "avaliador" do comitê, fluxo de decisão e quórum.
- Diferença prática entre anotações públicas e privadas; quem vê cada campo.
- Estados detalhados da indicação de pares e do envio de resultado/devolutiva.
- Exportação: formatos e filtros dos relatórios (somente xlsx do relatório de critérios, PDF/Excel na 9box do gestor).
- Valores dos campos opcionais da Sucessão (potencial, prontidão, risco, impacto, criticidade) e integração com 9box.
- Fórmula do eixo X com objetivos (média de quê e com quais pesos); divergência "dentro do período" x "exatamente igual".
- AE: nenhum fluxo de decisão (efetivar/prorrogar/desligar), integração com admissão/contrato; relatório "Participantes e suas ações" semelhante; critério de elegibilidade além de admissão e 89 dias; o que ocorre ao vencer o prazo de 90 dias; calibragem tem colunas descritas só na AE.
- MC: tabela de pontuação das 28 questões, algoritmo que gera código D/I/S/C e escolhe um dos 15 padrões, formato do relatório exportado, o que ocorre ao expirar os 30 dias.
- Vídeos e imagens/GIFs dos artigos não são lidos (vários passos de comitê, indicação e criação dependem deles).

---

# 14. URLs dos artigos lidos

Base: https://ajuda.feedz.com.br/pt-BR/articles/

**Coleções**: collections/3587513-avaliacao-de-desempenho; collections/3805161-avaliacao-de-experiencia; collections/8591587-mapeamento-comportamental; collections/11992581-comite-de-calibracao

**Avaliação de Desempenho (78)**
- 8400164-visao-geral-do-modulo-de-avaliacao-de-desempenho
- 10305436-como-funcionam-os-calculos-da-avaliacao-de-desempenho
- 10342879-como-o-peso-do-criterio-interferem-no-calculo-final-da-avaliacao-de-desempenho
- 6479844-como-colocar-um-nome-da-avaliacao-de-desempenho
- 6531535-como-definir-o-periodo-a-ser-analisado-na-avaliacao-de-desempenho
- 6531623-como-adicionar-uma-descricao-na-avaliacao-de-desempenho
- 6531889-como-configurar-os-prazos-de-cada-tipo-de-avaliador-na-avaliacao-de-desempenho
- 9298894-como-adicionar-dois-gestores-avaliadores-no-ciclo-da-avaliacao-de-desempenho
- 6532028-como-configurar-a-indicacao-de-pares-na-avaliacao-de-desempenho
- 6531989-como-definir-os-pesos-das-avaliacoes-na-avaliacao-de-desempenho
- 6653500-como-vincular-os-resultados-dos-objetivos-e-metas-a-avaliacao-de-desempenho
- 6897659-o-que-sao-os-conjuntos-nas-avaliacoes-da-feedz
- 6534753-como-configurar-a-escala-de-respostas-na-avaliacao-de-desempenho
- 6535381-como-configurar-os-conceitos-de-respostas-na-avaliacao-de-desempenho
- 10203329-como-criar-os-criterios-das-avaliacoes
- 6535424-como-configurar-os-criterios-nas-avaliacao
- 6526760-como-tornar-obrigatorio-o-comentario-de-um-criterio
- 6476528-como-usar-as-configuracoes-basicas-na-avaliacao-de-desempenho
- 6478704-como-usar-as-configuracoes-avancadas-da-avaliacao-de-desempenho
- 6476646-como-adicionar-ou-remover-participantes-na-avaliacao-de-desempenho
- 6476499-como-configurar-a-matriz-9box
- 8625405-como-permitir-que-uma-pessoa-visualize-detalhes-de-avaliacoes
- 10135444-como-trocar-os-gestores-do-colaborador-na-avaliacao-de-desempenho
- 8457611-quais-sao-as-fases-de-indicacao-na-avaliacao-de-desempenho
- 8443948-como-gerenciar-as-indicacoes-de-avaliadores-na-avaliacao-de-desempenho
- 10084463-como-posso-indicar-avaliadores-para-os-meus-liderados-na-avaliacao-de-desempenho
- 6479831-como-posso-aprovar-as-indicacoes-de-avaliadores-feitas-pelos-meus-liderados-na-avaliacao-de-desempenho
- 8440948-como-faco-a-indicacao-de-pares-na-avaliacao-de-desempenho
- 6476465-como-responder-a-avaliacao-de-desempenho
- 6479980-como-enviar-um-lembrete-na-avaliacao-de-desempenho
- 6480001-como-o-rh-pode-enviar-os-resultados-da-avaliacao-de-desempenho
- 12974449-como-o-rh-pode-remover-a-entrega-de-resultados-da-avaliacao-de-desempenho
- 8983260-como-remover-as-entregas-da-avaliacao-de-desempenho
- 6482832-como-entrego-o-resultado-ao-meu-liderado-na-avaliacao-de-desempenho
- 8983230-como-habilitar-a-edicao-das-respostas-na-avaliacao-de-desempenho
- 8927139-como-imprimir-o-resultado-final-de-um-participante-da-avaliacao
- 6479873-como-acompanhar-a-avaliacao-de-desempenho-em-andamento
- 7041219-como-liberar-o-historico-de-avaliacoes-passadas-para-gestores
- 6482301-como-vejo-meu-resultado-da-avaliacao-de-desempenho
- 9994424-como-editar-as-respostas-da-avaliacao-de-desempenho
- 7041380-como-visualizar-as-avaliacoes-passadas-dos-meus-liderados
- 6480100-avaliacao-de-desempenho-e-suas-calibracoes
- 9376403-como-faco-a-calibracao-das-notas-dos-meus-liderados-na-avaliacao-de-desempenho
- 9376394-como-calibrar-as-notas-da-avaliacao-de-desempenho-pela-tela-de-resultado-final
- 6482279-como-realizar-a-calibracao-pela-matriz-9box
- 6480215-como-acessar-a-tela-de-calibragem-na-avaliacao-de-desempenho
- 6482308-o-que-e-a-devolutiva-na-avaliacao-de-desempenho
- 6482347-como-faco-a-entrega-da-devolutiva-da-avaliacao-de-desempenho-para-o-meu-colaborador
- 9376194-como-marcar-que-recebi-a-devolutiva-da-avaliacao-de-desempenho
- 10412875-como-adiciono-anotacoes-na-avaliacao-de-desempenho
- 6480165-quais-sao-os-relatorios-da-avaliacao-de-desempenho
- 6623349-como-acessar-e-exportar-os-relatorios-da-avaliacao-de-desempenho
- 6480203-como-acessar-a-matriz-9box-da-avaliacao-de-desempenho
- 6480233-como-saber-qual-a-ultima-avaliacao-realizada-pelos-colaboradores
- 6694552-como-interpretar-o-grafico-de-avaliacao-de-desempenho-na-jornada-do-colaborador
- 10091284-como-validar-a-ordem-dos-criterios-na-avaliacao-de-desempenho
- 10355044-como-baixar-o-relatorio-de-criterios-da-avaliacao-de-desempenho
- 10346251-como-acesso-a-matriz-9box-do-meu-liderado-na-avaliacao-de-desempenho
- 8837921-como-gerenciar-o-modulo-de-sucessao
- 8400445-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-criar-e-configurar-criterios
- 8400429-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-configurar-a-escala-de-respostas
- 8400437-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-tornar-um-comentario-de-avaliacao-obrigatorio
- 8400397-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-fazer-configuracoes-avancadas-da-avaliacao-de-desempenho
- 8400383-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-fazer-configuracoes-basicas-da-avaliacao-de-desempenho
- 8400269-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-definir-os-criterios-de-resultado-pelos-objetivos-da-feedz
- 8400419-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-configurar-conceitos-de-respostas
- 8688513-nova-tela-de-criterios-da-avaliacao-como-configurar-criterios-de-respostas-em-massa-na-avaliacao
- 8703893-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-tornar-uma-resposta-na-avaliacao-obrigatoria
- 10202345-nova-tela-de-criterios-da-avaliacao-de-desempenho-como-editar-um-criterio-na-avaliacao-de-desempenho
- 10366444-como-reordenar-os-criterios-na-avaliacao-de-desempenho
- Comitê de calibração (8): 9794079-visao-geral-comite-de-calibracao; 9792996-como-criar-um-comite-de-calibracao; 9793156-como-editar-um-comite-de-calibracao; 10072482-como-criar-a-curva-ideal-no-comite-de-calibragem; 10081031-como-visualizar-a-curva-ideal-no-comite-de-calibragem; 10073160-como-excluir-a-curva-ideal-no-comite-de-calibragem; 10414889-como-adiciono-anotacoes-no-comite; 10079640-como-editar-a-curva-ideal-no-comite-de-calibragem

**Avaliação de Experiência (30)**
- 6887071-qual-a-diferenca-entre-a-avaliacao-de-desempenho-e-avaliacao-de-experiencia
- 7178427-lista-de-materiais-com-boas-praticas
- 10157835-como-criar-uma-avaliacao-de-experiencia-na-feedz-by-totvs
- 6887213-como-usar-as-configuracoes-basicas-na-avaliacao-de-experiencia
- 6887610-como-usar-as-configuracoes-avancadas-na-avaliacao-de-experiencia
- 6896038-como-configurar-os-criterios-na-avaliacao-de-experiencia
- 6890865-como-e-adicionado-participantes-automaticamente-na-avaliacao-de-experiencia
- 6901157-como-incluir-manualmente-uma-pessoa-em-uma-avaliacao-de-experiencia
- 6896499-como-definir-os-pesos-das-avaliacoes-na-avaliacao-de-experiencia
- 6887115-como-e-que-tipos-de-avaliadores-posso-incluir-na-avaliacao-de-experiencia
- 6901441-como-funciona-o-periodo-para-uma-pessoa-ser-inserida-na-avaliacao-de-experiencia
- 9503709-como-editar-o-prazo-de-resposta-de-uma-avaliacao-de-experiencia-em-andamento
- 10159804-como-excluir-uma-pessoa-em-uma-avaliacao-de-experiencia
- 6890950-como-acompanhar-a-avaliacao-de-experiencia-em-andamento
- 10178570-como-calibrar-as-notas-na-avaliacao-de-experiencia
- 10091384-como-validar-a-ordem-dos-criterios-na-avaliacao-de-experiencia
- 10206980-como-trocar-de-gestor-na-avaliacao-de-experiencia-em-andamento
- 10207338-como-editar-as-respostas-da-avaliacao-de-experiencia
- 10207393-como-habilitar-a-edicao-das-respostas-na-avaliacao-de-experiencia
- 6904534-como-o-gestor-na-avaliacao-de-experiencia-faz-a-entrega-do-resultado-ao-participante
- 6890975-como-o-rh-pode-enviar-os-resultados-da-avaliacao-de-experiencia
- 6891383-o-que-e-a-devolutiva-na-avaliacao-de-experiencia
- 6891396-como-faco-a-devolutiva-da-avaliacao-de-experiencia-para-os-meus-liderados
- 6891771-como-vejo-meu-resultado-na-avaliacao-de-experiencia
- 10185373-como-marcar-que-recebi-a-devolutiva-na-avaliacao-de-experiencia
- 10207224-como-remover-as-entregas-da-avaliacao-de-experiencia
- 6891805-quais-sao-os-relatorios-da-avaliacao-de-experiencia
- 6891818-como-acessar-a-matriz-9box-da-avaliacao-de-experiencia
- 8400377-nova-tela-de-criterios-da-avaliacao-de-experiencia-o-que-sao-conjuntos
- 8400349-nova-tela-de-criterios-da-avaliacao-de-experiencia-como-configurar

**Mapeamento Comportamental (12)**
- 9019953-o-que-e-a-metodologia-disc
- 9019971-como-enviar-um-mapeamento-comportamental
- 9019984-como-responder-o-mapeamento-comportamental
- 11388131-como-visualizo-os-mapeamentos-comportamentais-dos-meus-liderados
- 10770249-como-enviar-lembrete-para-mapeamentos-comportamentais-nao-respondidos
- 9876002-como-ativar-desativar-as-permissoes-do-mapeamento-comportamental
- 9472541-como-e-feito-o-calculo-para-gerar-o-resultado-do-mapeamento-comportamental
- 9650417-como-exportar-o-relatorio-de-mapeamento-comportamental
- 9019997-como-o-rh-pode-conferir-os-resultados-do-mapeamento-comportamental
- 11486626-como-funciona-o-calculo-do-dashboard-do-disc-no-mapeamento-comportamental
- 11516345-como-visualizar-o-dashboard-do-disc-no-mapeamento-comportamental
- 12641031-como-visualizar-e-exportar-o-resultado-do-mapeamento-comportamental
