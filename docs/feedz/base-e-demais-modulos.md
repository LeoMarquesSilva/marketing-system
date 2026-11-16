# Feedz (TOTVS RH) - Base da plataforma e demais módulos

Engenharia reversa a partir da central de ajuda pública (https://ajuda.feedz.com.br). Fonte única: os artigos listados no fim. O que não aparece neles está marcado como "não documentado". Itens marcados "(inferido)" foram deduzidos de caminhos de menu citados em vários artigos, não de uma lista oficial.

Observação sobre datas: os Release Notes não trazem dia, só mês/ano no título. Alguns artigos têm data de publicação própria, e algumas aparecem em set/2026 (Nova Home, Copiloto IA, People Analytics), coerentes com a data atual do projeto.

---

## 1. Estrutura da plataforma

### 1.1 Menu principal (reconstruído)

Não há um artigo único com o menu completo. A "Nova Home" (set/2026) diz que o menu lateral foi reagrupado em 4 temas:

- Desempenho & Desenvolvimento
- Clima & Engajamento
- Pessoas
- Departamento Pessoal

Itens citados em caminhos de outros artigos (agrupamento exato dentro dos temas não documentado):

| Área | Itens citados |
|---|---|
| Início (home) | Minhas Pendências, atalhos Solicitar Feedback / Enviar Feedback / Realizar Celebração, painel "Minha Gestão" (gestor), "Acompanhe seu time", quadro de atividades, termômetro de humor, pesquisas a responder, Perfil Campeão, links públicos fixados |
| Copiloto IA | Chat com IA (só perfil Gestor, por enquanto) |
| Pessoas | Colaboradores, Admissão Digital, Desligamentos, Cargos e Salários, Assinatura digital, Relatórios (com DP), Desengajados, Férias & Recesso - RH |
| Gestão | Dashboard, Painel de engajamento, Resumo de atividades, Histórico de feedback, Diversidade, Turnover |
| Pesquisas | Engajamento, Satisfação (e-NPS), Super Pesquisa, Rápida, Desligamento, MRP (riscos psicossociais), Plano de Ação |
| Configurações | abas "Configurações", "Empresa", "Integrações" e abas por módulo (PDI, Celebrações, Modelos de Feedback, Pesquisas, Objetivos) |
| Menu do usuário (nome/foto, canto superior direito) | Meu perfil, Organograma, Minha carreira, Calendário de Férias e Recesso, Atualização de cadastro, Liberar suporte (admin) |
| Atalho | ATS (Recrutamento & Seleção) no menu lateral, para quem tem permissão (abr/25) |

Módulos cobertos por outros agentes (aparecem aqui só como menção): PDI/Trilhas/Onboarding, 1:1, Avaliação de Desempenho e de Experiência (AD/AE), Feedback, Celebrações, Comunicados, Gamificação, Humor, Ouvidoria, Pesquisas, Objetivos e Metas, Incentivos (PLR/PPR), Persona/Mapeamento Comportamental (DISC), Sucessões.

### 1.2 Perfis de acesso (papéis)

Fonte: "O que é e como alterar o papel de um perfil?". Alterar em Pessoas > Colaboradores > Editar > aba Contratação > seção Papel.

| Papel | O que faz |
|---|---|
| Administrador | Acesso total às configurações |
| Gestor | Responde pesquisas; vê dados próprios e dos liderados diretos (em alguns casos, indiretos) |
| Colaborador | Responde pesquisas; vê só os próprios dados |
| Visitante | Responde apenas à avaliação de desempenho |

Permissões granulares ficam na aba "Permissões" do cadastro da pessoa (Pessoas > Colaboradores > Editar > Permissões). Artigos mostram permissões individuais para:

- Abas Colaboradores e Cargos; Cargos e Salários ("Permite administrar política de cargos e salários"); histórico de cargos e salários (atualizar e exportar são permissões separadas desde out/24); exclusão de histórico de remuneração
- Celebrações (excluir, exportar); Gamificação (recompensas, relatório)
- Comunicados (administrar)
- Pesquisas: Engajamento, Super Pesquisa (incluindo responder comentários), Satisfação, Rápida
- Avaliação de desempenho (administrar; ou ver só as que criou)
- Admissão Digital; documentos dos colaboradores; holerites; ASO; Férias como RH; Assinatura digital (aba Geral)
- Histórico de feedbacks, histórico de 1:1 por colaborador (flags)
- Jornada do Colaborador, Dashboard, Painel de engajamento, Resumo de atividades, Turnover, Diversidade, Desengajados (a pessoa precisa ter a permissão, confirmada "com o RH")
- Flag para BPs: administrador sem acesso à aba "Permissões" (abr/24)
- Relatório de papéis e permissões (nov/24): cada permissão em uma coluna habilitada/desabilitada

Escopo de visibilidade do gestor (três modelos):

1. Gestor direto (padrão): cada pessoa tem exatamente 1 gestor direto; o modelo não permite dois gestores diretos. Há visão em cascata (liderados diretos e indiretos).
2. Departamentos gerenciados: o gestor (ou outro perfil) gerencia departamentos inteiros. Uma pessoa pode gerenciar vários departamentos e um departamento pode ter vários gestores. Precisa ser ativado pela Feedz (pedir ao CS/Suporte). Quando configurado, substitui a gestão por gestor direto.
3. Unidades gerenciadas: por padrão o gestor vê só a unidade em que está; "Unidades gerenciadas" acrescenta outras (usadas em Painel de Humor e Pesquisas).

Exceção para avaliação de desempenho: permite segundo gestor (mai/24) com peso padrão de 50% cada, e permissões por unidade além de departamento (mar/24).

### 1.3 Hierarquia organizacional

- Empresa (uma por base; chave de acesso, idioma, logo, etc.).
- Unidades: cadastro só com nome (Configurações > Configurações > "+ Adicionar novo"). Cada pessoa tem um campo Unidade. R&S tem cadastro próprio de unidades (com código e CPF, jul/26).
- Departamentos: cadastro só com nome (Configurações > Configurações > "Configurações de departamentos" > "+ Adicionar novos"); cada pessoa é alocada em um departamento. Hierarquia entre departamentos (sub-departamentos): não documentada; o artigo diz explicitamente que não menciona. Os artigos de integração ERP afirmam que "não há hierarquia de cargos por unidade".
- Grupos: etiquetas livres no cadastro (campo Grupos, aba Contratação). Máximo de 20 por pessoa, subiu para 40 em abr/25 (nota de DP). Criados na hora ao digitar. Usados como filtro de destinatários.
- Cargos: ver seção 2. Existe "Cargo" (restrito/administrativo) e "Cargo visível" (exibido publicamente).
- Gestor direto: 1 por pessoa. Vazio para cargos como CEO.
- Gestores múltiplos: não no modelo de gestor direto. Existem alternativas: departamentos gerenciados (vários gestores por departamento) e segundo gestor na avaliação de desempenho.
- Organograma: Menu do usuário > Organograma. Admin vê gestor direto, departamento, cargo e cargo visível; gestor e colaborador veem gestor direto, departamento e cargo visível.

Regra de intersecção nos filtros (Comunicados, Pesquisa de Satisfação, de Engajamento e Super Pesquisa): o público é a interseção de todos os filtros preenchidos (departamentos AND unidades AND grupos).

### 1.4 Cadastro do colaborador (campos)

Fonte: "Como adicionar uma nova pessoa manualmente?", importação, atualização em massa e integrações. O artigo de edição de identificação não lista campos. Os campos de DP só aparecem com o módulo Departamento Pessoal contratado.

Cadastro manual (Pessoas > Colaboradores > Adicionar), abas:

- Identificação (dados pessoais). Obrigatórios: Nome e UF. Opcionais: contatos particulares, documentos, endereço residencial, escolaridade, orientação sexual, dependentes, tamanho de camiseta, preferência alimentar.
- Contratação (dados profissionais). Obrigatórios: e-mail corporativo, Cargo, Departamento, Papel. Opcionais: data de admissão, matrícula, descrição do cargo, tipo de vínculo, CBO, unidade, gestor direto, observações da contratação, descrição da jornada, grupos.
- Permissões (ver 1.2).
- Participações (topo do perfil): participa ou não da gamificação.
- Documentos: tipos Contrato, CPF, RG, Carteira de Trabalho, Exame Admissional, Título de Eleitor, Comprovante de Residência; só PDF. Limite de tamanho: não documentado. Visibilidade depende da permissão "gerenciar documentos".

Lista consolidada de campos que aparecem na importação/atualização em massa:

- Básicos: Nome (visível), E-mail, Departamento, Cargo, Cargo visível, Papel (Administrador, Gestor, Colaborador, Visitante), Status na base (Ativo, Desativado, Desligado, Importado), E-mail do gestor direto, Matrícula, CPF (11 dígitos), Data de aniversário, Data de admissão, Unidade, Grupos, Gênero (Masculino, Feminino, Não definido, Sem dados), Etnia (Branca, Preta, Parda, Amarela, Indígena), Biografia, Idioma (Português, Inglês, Espanhol).
- Só no atualizador: Identificador (e-mail ou CPF), ranking de engajamento (participação na gamificação), envio de celebração de boas-vindas (uma vez por pessoa), adicionar/remover grupos.
- Extras com DP: nome completo (usado em holerites), celular, nome da mãe, grau de instrução, estado civil, sexualidade, PIS/PASEP, RG, CTPS; endereço residencial; alimentação e tamanho de camiseta; tipo de vínculo, CBO, jornada de trabalho, observações; dados bancários (Pix, banco, tipo, número, dígito, agência); dados da PJ (razão social, CNPJ, nome fantasia, inscrição municipal, endereço); contato de emergência; dependentes.
- Perfil do próprio usuário: foto, nome, e-mail, idioma, contatos (WhatsApp, LinkedIn, Facebook), biografia, habilidades, links, educação (lista de formações com adicionar/editar/excluir), imagem e cor de fundo, notificações, senha e segurança.
- Tipos de vínculo citados: CLT, PJ, Estágio, Sócio, Jovem Aprendiz, Cooperado (mar/24), Freelancer (mai/26).
- Novidades de campos nos Release Notes: etnia obrigatória na admissão (mai/24, Lei 14.553/2023), identidade de gênero (jul/25), graus de instrução técnicos e pós (mai/26), unidade na admissão (mai/26).
- Tela Colaboradores: ações por pessoa (menu "três pontinhos"): Editar, mudar papel, mudar cargo, descrição do cargo, vínculo, gestor direto, unidade, departamento, grupos, resetar senha, resetar 2FA, reenviar e-mail de boas-vindas, inativar, reativar, desligar, excluir campos em massa, acessar dados de inativos/desligados/importados, exportar lista, log de alterações de cadastro. Busca por nome, e-mail, CPF e matrícula (mar/24). Clique na linha abre a edição (jun/26).
- Log de alterações de cadastro (Pessoas > Colaboradores > "..." > Log de alterações de cadastro): ações atualização, exclusão, criação; campos auditados: cargo, salário (só indica mudança, sem valor), departamento, status, e-mail, gestor, data de aniversário, permissões; mostra quem alterou, data/hora, origem (manual ou importação), antes/depois.
- Permissões de autoedição (Configurações > Configurações > "Configurações sobre os Colaboradores"): colaborador pode atualizar dados do cadastro (não rastreado), alterar nome, alterar cargo visível, alterar e-mail. Valem para toda a empresa.

### 1.5 Importação em massa

- Importar novos: Pessoas > Colaboradores > Importar > Importar novos colaboradores. Planilha modelo .XLS/.XLSX. Obrigatórios: Nome, E-mail, Departamento, Cargo, Papel, Status. Limite 1.000 linhas (era 500 até mai/24), processamento assíncrono, notificação ao final. Nome de arquivo até 50 caracteres sem especiais; proibidos os caracteres ' " = < > - nos campos. Não alterar colunas. Histórico de importações com status "Importado" (permite Reverter) e "Não importado" (baixar planilha de erros e reenviar só as linhas que falharam). Desbloqueio automático após 10 min de inatividade (jun/26). Cada importação guarda cópia dos dados originais (fev/24).
- Atualizar dados cadastrais: mesmo caminho, "Atualizar dados cadastrais", identificador e-mail ou CPF.
- Férias: importar solicitações em massa, importar dados de saldo, importador de histórico de férias (1.000 linhas, reversível). Saldos reversíveis em 72 h.
- Holerites: PDF único com reconhecimento por IA (ver seção 5).
- Importadores específicos de outros módulos (objetivos, KRs, check-ins, avaliações) são mencionados nos Release Notes, mas pertencem a outros agentes.
- Política de CS: importações entregues em até 15 dias corridos pelo time (SLA de CS), para lotes grandes feitos pelo CSM.

### 1.6 Integrações

Visão geral (artigo): login (Google, Microsoft, SSO personalizado), cadastro (Manual, Importadores via CSM, API aberta, Plug-and-Play Senior e Convenia, ATS, Protheus, RM, ETLs), colaboração (Slack), API e webhook (documentação técnica em docs.feedz.com.br; webhooks citados no título mas não descritos). Direção dos dados não informada na visão geral. A Feedz só dá suporte à própria plataforma; problemas de terceiros ficam com o fornecedor.

| Integração | O que faz | Detalhes documentados |
|---|---|---|
| Token de integração (API 2.0) | Chave pessoal do administrador (Configurações > Integrações > "Chave de Integração (API 2.0)" > Gerar Token) | Invalida se a pessoa for desligada/inativada (volta ao reativar); some de vez se deixar de ser admin; gerar outro substitui o anterior |
| TOTVS Protheus | ERP > Feedz: unidades (Filial), departamentos, cargos, colaboradores (incl. CPF e matrícula), liderança, desligamentos | Protheus 12.1.33 ou 12.1.2210+; token no parâmetro MV_APIFEE2; carga completa por execução; máx. 2 execuções/dia |
| TOTVS RM | idem (Empresa=Coligada, Unidade=Filial, Departamento=Seção, Matrícula=Chapa) | RM 12.1.2310+ |
| TOTVS Datasul | idem (Unidade=Estabelecimento, Departamento=Unidade de Lotação) | Datasul 12.1.2307.13, 12.1.2311.7 ou 12.1.2403.2; via serviço ETL |
| Senior | Lê a Senior e cria/atualiza/desliga colaboradores; diária, de madrugada | Mapeamento de campos (nomFun, numCpf, emaCom, datAdm, titCar, datNas, datAfa, numCad etc.); gestor direto via hierarquia de postos; filiais (R030FIL); tipos de colaborador CLT/Terceiro/Parceiro; todos entram como Colaborador, quem lidera vira Gestor |
| Convenia | Somente leitura Convenia > Feedz; webhook quase em tempo real (admissão, desligamento, edição) + importação inicial | Requer CPF; e-mails de erro configuráveis |
| Ahgora | Unidirecional Ahgora > Feedz, sincronização diária às 5h; implantação pela Ahgora em até 5 dias úteis | CPF obrigatório; usa token API 2.0 |
| Slack | Só Feedz > Slack (notificações); ações no Slack não voltam | Notificações de Comunicados, Celebrações, Feedback, 1:1, Pesquisas; canal público opcional; sincroniza usuários pelo e-mail; só o proprietário do workspace instala; sem comandos de barra |
| SSO (login) | SAML2, apenas autenticação (sem sincronizar cadastro) | Configurações > Integrações > Login SSO; modos "usuário/senha + SSO" ou "somente SSO"; troca de XMLs SP/IdP; admin configura sozinho desde dez/24 |
| Login Google/Microsoft | Citados na visão geral; não há artigo de configuração | Detalhes não documentados |
| ATS (R&S) | Cargos, departamentos e unidades Feedz > R&S por botão; admissão digital integrada ao ATS; TOTVS RM/Protheus/Datasul criam vagas em rascunho a partir de requisições | Ver seção 6 |
| TAE (TOTVS Assinatura Eletrônica) | Assinatura digital | Ver seção 7 |
| Afferolab | Citado como artigo relacionado; sem conteúdo | Não documentado |
| Google Agenda / G-Suite | Só no R&S (eventos com candidatos) | Ver seção 6 |

Regras comuns de ERP: nomes de unidade/departamento/cargo não podem repetir; e-mail obrigatório (pode gerar e-mail fictício a partir do CPF com um domínio configurável); busca de colaborador por e-mail e depois CPF; uma pessoa só pode ter 1 contrato; desligamentos retroativos podem causar perda irreversível (token admin, agendas 1:1, liderança, avaliações, objetivos); se "Domínios de e-mail permitidos" estiver ativo, todos os domínios devem estar cadastrados; "Cargo visível" é exclusivo da Feedz (opção de replicar o nome do cargo).

### 1.7 Aplicativo mobile

Existe app Feedz para iOS (App Store) e Android (Google Play), uso no celular ou tablet, complementar ao computador. Funcionalidades específicas, versões mínimas, modo offline: não documentados. Notificações push também funcionam no navegador (sininho azul no canto inferior esquerdo > "Se inscrever").

### 1.8 Notificações

- Por usuário: Meu perfil > Notificações, marcar tipos que quer receber por e-mail. A lista de tipos não é documentada. Algumas notificações não podem ser desativadas (ações obrigatórias); admin/RH controla envio de módulos como celebrações, comunicados, avaliações e pesquisas.
- Push: pelo navegador; instruções para liberar bloqueio e conflito com adblock.
- Sininho dentro da plataforma.
- Slack (acima). Opção global para desativar o e-mail automático de boas-vindas (jun/26). E-mails reformulados ao longo de 2024-2025 (avaliações, comunicados, admissão, holerite, 2FA, etc.).
- Lembretes específicos documentados: férias 7 dias antes da saída (jul/24), 1:1 pendente de finalização na home (abr/25), teste Persona expirando em 10 dias.

### 1.9 Idioma e LGPD

- Idiomas: Português (BR), Inglês, Espanhol. Define-se por empresa (Configurações > Empresa > Idioma, afeta também o e-mail de boas-vindas) e por conta (Meu perfil, prevalece sobre o da empresa). A central de ajuda também tem os 3 idiomas. R&S tem preferência de idioma própria.
- LGPD: não há artigo dedicado. Elementos relacionados citados: coleta de dados de diversidade opcional no R&S, com exclusão definitiva às 21h do dia seguinte à desativação; log de alterações; salário no log só indica mudança; relatórios com CPF restritos a pessoas autorizadas (PDI, jul/26); anonimato de pesquisas e Ouvidoria. Política/termos/DPO/exportação de dados do titular: não documentados.

### 1.10 Segurança e acesso

- Login: e-mail/CPF + senha; também matrícula + "chave de acesso da empresa" (Configurações > Empresa; chave livre definida pelo admin); SSO SAML2; senha padrão de reset (Configurações > Configurações > Outras Configurações > Senha Padrão); domínios de e-mail permitidos (até 20, separados por vírgula, Outras Configurações).
- 2FA: admin habilita em Configurações > Configurações > Segurança e escolhe quais perfis são obrigados; usuário usa app autenticador (QR code) ou código por e-mail. Admin pode resetar o 2FA de um colaborador.
- Liberar suporte: admin (Menu do usuário > Liberar suporte > Sim) dá acesso ao time de suporte ao ambiente.
- Suporte: chat na plataforma (seg-sex, horário citado 9h-17h30 em um artigo e 9h-18h em outro); Portal do Cliente TOTVS (financeiro, licenças, boletos); Customer Success (resposta de e-mail em até 48 h úteis, importações em até 15 dias corridos). Sugestões de melhoria: artigo próprio (conteúdo não lido em detalhe).

### 1.11 Primeiros passos, home e perfil campeão

- "Primeiros passos" recomenda o Manual do Usuário v5.0 (PDF) e lista artigos por perfil (todos, gestores, admins). Configurações iniciais sugeridas (7): capa/cor/propósito/logo, aniversário da empresa, recompensas da gamificação, celebrações automáticas, itens de avaliação do Feedback, modelos de Feedback, lembrete automático de 1:1.
- Quadro de atividades da home: Celebrações recebidas (só marcações com o @ da pessoa), Feedbacks recebidos (anônimos contam), Objetivos ativos (responsável, ativo, término >= hoje; KRs não contam), Pesquisas respondidas (e-NPS, Rápida, Super; Engajamento não conta).
- Nova Home (16/09/2026): Minhas Pendências (pesquisas, avaliações, objetivos, gamificação, feedbacks); botões Solicitar Feedback, Enviar Feedback, Realizar Celebração; painel "Minha Gestão" (cobertura de feedback, progresso de PDIs, frequência de 1:1, atingimento de metas, com atalhos); menu lateral reagrupado.
- Perfil Campeão: regras fixas, reiniciam a cada 15 dias. Admin e colaborador: enviar 1 feedback, solicitar 1, fazer 1 celebração. Gestor: acessar a Feedz 4 vezes, 2 celebrações, feedbacks para liderados diferentes (meta = liderados x 40 / 100, teto 8). Empresa pode desativar via suporte.
- Painel de liderança: Home > "Acompanhe seu time" > "Mostra mais detalhes"; foto do liderado abre a jornada; vê liderados diretos e indiretos. Indicadores e filtros: não detalhados nesse artigo.
- Copiloto IA (15/09/2026): chat para gestores consultarem avaliação de desempenho, PDI, feedback, 1:1 e perfil DISC; pode lançar feedback; histórico "Conversas recentes" (renomear/excluir); responde só com dados que o usuário pode ver.
- Pesquisas aparecem na home acima do termômetro de humor; resposta não pode ser editada nem excluída depois de enviada.

---

## 2. Configurações (tela a tela)

Caminho geral: menu lateral Configurações, depois abas no topo.

| Tela / seção | Controla | Fonte |
|---|---|---|
| Configurações > Empresa | Nome, chave de acesso (login por matrícula), descrição, propósito, data de aniversário, idioma, capa (400x100 a 1536x350 px), logo (~80x35, fundo branco, horizontal), cor de fundo, "Configurações de Links" (até 40 links públicos na home, título + URL). Prévia de imagem antes de salvar (jun/26) | personalizar capa/cor/logo, links, idioma, aniversário |
| Configurações > Configurações (geral): Configurações sobre os Colaboradores | 4 flags de autoedição do colaborador (dados, nome, cargo visível, e-mail) | permitir que colaboradores alterem |
| idem: Outras Configurações | Senha Padrão de reset, Domínios de e-mail permitidos (até 20) | senha padrão, domínios |
| idem: Segurança | 2FA e perfis obrigados | 2FA |
| idem: Configurações de departamentos | Criar departamentos (nome) | novo departamento |
| idem: Unidades | Criar unidades (nome) | cadastrar unidades |
| idem: Configuração do Feedback 360 | Itens/valores da empresa para avaliar no feedback | itens de avaliação no Feedback |
| idem: Pesquisas | Permissão para gestores verem resultado da Pesquisa de Engajamento (Dashboard, Comentários, Mapa de Calor, Benchmark, ou só Dashboard) | guia de permissões de pesquisas |
| Configurações > Integrações | Token API 2.0, ERPs, Senior, Convenia, Slack, SSO, Assinatura Digital (TAE), ativação de integração | seção 1.6 |
| Abas por módulo (PDI, Celebrações, Modelos de Feedback, Objetivos) | PDI: habilitar/desabilitar tipos padrão. Feedback: habilitar/desabilitar modelos padrão. Celebrações: disparo de boas-vindas por data de admissão, celebrações automáticas. Objetivos: etiquetas, privado por padrão, e-mails | release notes (detalhes pertencem a outros agentes) |
| Cargos e Salários (Pessoas) | Cadastro de cargos (ver abaixo); ativação por permissão | seção abaixo |
| Configuração de Férias (Pessoas > Férias & Recesso - RH > engrenagem) | Regras por tipo de vínculo (vender férias, antecipar 13o), dias da semana de início, feriados, antecedência mínima, orientações e link da política, tamanho do período aquisitivo e saldo acumulado, notificações | seção 5 |
| Grupos de cargos (company settings, set/24) | Para elegibilidade e múltiplo salarial de Incentivos | release set/24 |
| Admin > Empresas (interno) | Ligar/desligar nova versão de Cargos e Salários e "Minha Carreira" | release mai/25 |

Itens que o enunciado pede e a documentação não traz como tela de configuração: "valores da empresa" (só como itens do Feedback 360), "competências" (existem em Avaliações, vinculador de competências, fora do escopo; em Cargos, competências não são citadas no artigo de campos do cargo), "níveis" (existem como níveis hierárquicos do cargo), "campos personalizados" (não documentado; só há campos fixos e o relatório personalizado), "módulos ativos" (sem tela de autoativação; módulos são contratados e ativados pela Feedz/CS, e permissões por pessoa).

### Cargos e Salários (módulo reformulado em 2025, v1.0 em fev/25)

- Pessoas > Cargos e Salários. Permissão: "Permite administrar política de cargos e salários" (aba Permissões > Cargos e Salários).
- Cadastro em 3 abas: Informações gerais (Nome obrigatório; título, grupo de cargos, descrição opcionais; campo de experiência a partir de jun/26), Modelo e Níveis (com ou sem níveis hierárquicos; salário do cargo obrigatório, visível só a quem pode ver remuneração; faixas salariais por nível, ex. Júnior I/II/III, com "Considerar níveis salariais"), Revisão.
- Ações: editar, ver colaboradores associados, excluir (bloqueado se houver pessoas vinculadas; antes é preciso transferi-las).
- Campos de contratação novos: CBO e sindicatos (fev/25). "Book de Carreira" e página "Minha carreira" (mostra responsabilidades e competências do cargo; mai/25).
- Histórico por pessoa: Jornada do Colaborador (Resumo) > Histórico de cargos e salários; atualização em massa por planilha (mai/24); novos motivos de alteração (dez/25); permissões de atualizar e exportar separadas.

---

## 3. Gestão e Relatórios

### 3.1 Painéis e telas (menu Gestão)

| Tela | Conteúdo | Quem acessa |
|---|---|---|
| Dashboard | Humor geral da empresa, resultado da última e-NPS, volume de feedbacks, volume de celebrações; filtro de período | permissão (confirmar com RH) |
| Painel de engajamento | Eficiência da empresa, engajamento por módulo, por período, histórico por gestor (exportável em Excel), "Engajamento por líder" (exportar); ícone "i" explica o cálculo | permissão |
| Resumo de atividades | Tabela por colaborador: Nome, Departamento, Papel, Humor (média), Média Feedback, Feedbacks Enviados/Recebidos, Qualidade Feedbacks, Celebrações, Planos de Desenvolvimento, 1:1 como gestor, 1:1 como liderado. Filtros: período, ativos/inativos. Exporta Excel | permissão |
| Histórico de feedback | Filtrar e exportar planilha de conteúdos | permissão |
| Diversidade | Gráficos por seção com menu de 3 linhas para relatórios; histórico exportável | só Administrador |
| Turnover | Gráficos e "Histórico de desligamentos" (exportável); edição do "Último dia trabalhado" | só Administrador |
| Desengajados (Pessoas > Desengajados) | Lista de desengajados, exportável; indicador de quem não acessa há mais de 30 dias (jul/26); bloqueio de 48 h entre e-mails a desengajados (set/25) | só Administrador |
| Jornada do Colaborador | Perfil consolidado (ver abaixo) | permissão |
| Relatórios (Pessoas > Relatórios, com DP) | Colaboradores (exportar) e aba "Personalizados" (+ Novo relatório, salvar modelo, exportar) | DP |
| People Analytics (18/09/2026) | 3 painéis: Reuniões 1:1, PDI, Avaliação de Desempenho | Administrador (1a fase) |
| Painel do gestor ("Minha Gestão" e "Acompanhe seu time") | Métricas consolidadas do time com atalhos | Gestor |

Jornada do Colaborador: papel e permissões, currículo/educação/habilidades/biografia, liderança; filtro por período; humor (média, gráfico, histórico com comentários); resumo de atividades; feedbacks (gráfico em prisma comparado à média da empresa, recebidos restritos a admin, enviados); objetivos; PDIs/trilhas/onboarding; 1:1s; anotações (CRUD); gráfico de avaliação de desempenho (colaborador x time x departamento); aba "Férias & Recesso" (mar/24); histórico de cargos e salários.

People Analytics: PDI (ativos, taxa de conclusão, atrasados, críticos; evolução mensal, top 10, sem PDI); 1:1 (programados no mês, taxa de conclusão, satisfação 0-5, vencidos; ações criadas x encerradas, status, top 10); Avaliação (média geral, quadrante alto, calibrações; distribuição de notas, evolução, 9-box). Filtros: período (mês), e-mail do gestor, unidade, departamento. Mês corrente em tempo real; meses anteriores fecham no último dia; colaboradores desligados saem do mês atual; 1:1 só conta se marcada como concluída.

### 3.2 Exportações

O artigo índice lista: engajamento da liderança, Super Pesquisa, Satisfação (eNPS), Engajamento, Pesquisa Rápida, Humor, desengajados, Celebrações, médias dos feedbacks, histórico de conteúdos dos feedbacks, ranking de gamificação (por mês), lista de colaboradores, turnover, histórico da análise de diversidade, Onboarding, Trilha de Desenvolvimento, PDI, 1:1, Objetivos e Metas, avaliações de desempenho por colaborador, resumo de atividades. Formato predominante: planilha Excel; lista de colaboradores sem DP é enviada por e-mail; relatórios pesados (>350/400 registros em AD) vão por e-mail. Colunas e filtros só estão documentados para o Resumo de atividades. Alguns exigem papel Administrador ou permissão.

### 3.3 Turnover

- Acesso: Gestão > Turnover (admin). Exige data de admissão de todos (ativos, inativos, desligados); sem ela os gráficos "Taxa de turnover do período" e "por mês" não aparecem.
- Taxa sem admitidos = soma de desligados no período / média de ativos (média de (ativos no dia 1 do mês inicial + ativos no fim do mês final) / 2).
- Taxa com admitidos (se habilitado) = soma de (desligados + admitidos)/2 por mês / média de ativos.
- Indicadores: total de desligados, total de admitidos, taxa do período, turnover por mês, taxa por mês (não acumulada), colaboradores ativos (inclui desativados).
- Pesquisa de Desligamento (set/25), novo motivo "Falecimento" (abr/25).

---

## 4. Linha do tempo das Atualizações do Produto

Apenas Release Notes mensais (31 artigos, jan/24 a jul/26). Resumo dos itens por mês, com foco no que importa à base e aos módulos DP, R&S e Assinatura; itens de módulos de outros agentes aparecem como menção.

2024
- Jan: 9Box mostrar/ocultar notas; Pesquisa de Engajamento acessível a leitores de tela; Holerites com filtros de descrição e datas.
- Fev: Assinatura Digital via TAE; IA de análise de sentimento na Pesquisa de Satisfação; PDI e Feedback com opção de ocultar tipos/modelos padrão; backup dos dados originais em cada importação.
- Mar: busca por CPF/matrícula; vínculos Jovem Aprendiz e Cooperado; permissões da AD por unidade; NPS na PE; aba "Férias & Recesso" na Jornada.
- Abr: R&S com testes de personalidade (3 gratuitos por vaga/mês); fluxo de humor novo; flag de BP sem acesso a Permissões; Objetivos com mais colunas; atualizador refatorado e "Histórico de Importações".
- Mai: limite de importação 500 > 1.000 linhas; testes Persona em massa; PE com múltipla escolha e unidade gerenciada; férias em dias úteis; anexos na Ouvidoria; segundo gestor na AD; etnia obrigatória na admissão digital; atualizador em massa de cargos e salários.
- Jun: reenvio do convite de admissão; "Nome" vira "Nome visível"; Incentivos "Gatilhos" > "Grupos de Metas"; integração cargos/departamentos Feedz > ATS; R&S funil na gestão de vagas, ordenação por IA, permissões na triagem; DISC visível ao colaborador.
- Jul: ASO (admissional, demissional, periódico, retorno, mudança de função); lembrete de férias 7 dias antes; remoção do limite de 11 feriados; "Comitê" vira "Calibragem"; R&S pesos de critérios da IA, permissões de páginas de carreiras, impressão de currículo.
- Ago: R&S JobBoard CareerJet; Admissão Digital com e-mail da pessoa candidata alterável, e-mail de boas-vindas com logo; PE com reordenar perguntas e link compartilhável; Ouvidoria anonimato desativado por padrão; Objetivos meta por data, fluxo de aprovação obrigatório.
- Set: arquivar comunicados; comitês de calibragem; DP Offboarding (gestão de desligamentos); Férias com bloqueio de pedido 2 dias antes de DSR/feriado; grupos de cargos para Incentivos; duplicar pesquisas; R&S NetVagas.
- Out: Persona Excel; celebrações de boas-vindas pela data de admissão; DP: anexos em solicitações de férias, abas de férias vencidas, reverter importação de saldo em 72 h; Incentivos com várias fórmulas; R&S: fluxo de aprovação de requisições (até 5 aprovadores), permissões do banco de talentos, vagas em lista.
- Nov: Comitê de Avaliação padrão; DP relatório de papéis e permissões, holerite validado por CPF, importador de histórico de férias com reversão; PDI com permissionamento de planos; R&S permissões de templates de perguntas e roteiros.
- Dez: SSO configurável pelo admin; Senior com gestor direto; Objetivos com importação de intervalos de KRs; Incentivos duplicar programa e autosave; R&S múltiplos templates de perguntas, novo papel "Suporte".

2025
- Jan: Senior com filiais e centro de custo; AD com abas na indicação e visibilidade do 9Box; Incentivos memória de cálculo; R&S filtro por código da vaga.
- Fev: DP Cargos e Salários v1.0 (CBO e sindicatos); Persona resultados inconclusivos; PE primeira versão do Plano de Ação; Objetivos etiquetas e check-in em massa; R&S agendamento via G-Suite.
- Mar: e-mails reformulados; Incentivos salário na fórmula; DP: atualizador com progresso, busca na Admissão Digital, filtro por gestor em férias; 1:1 com alerta de reunião não concluída; R&S unidades integradas no ATS.
- Abr: DP grupos de cargos 20 > 40, motivo "Falecimento"; PE novo tipo de resposta (100 pontos), líder vigente; R&S atalho do ATS no menu, importação em lote de cargos, "Recrutador responsável".
- Mai: Cargos e Salários nova versão (rollout até 27/06) e "Minha Carreira"; R&S jornada do candidato nova, permissão por unidade.
- Jun: Persona gráfico DISC geral; DP logs de nome e remuneração, exportar ficha em PDF; 1:1 flag de histórico; R&S job board "Novo Trampo", e-mail validado no cadastro.
- Jul: Objetivos gestor direto como aprovador; DP identidade de gênero e alerta de férias no desligamento; R&S perguntas eliminatórias, trampos.co.
- Ago: PE filtro por unidade; R&S SimplyHired, testes SkillCert.
- Set: Pesquisa de Desligamento; bloqueio de 48 h em e-mails de desengajados; Persona logs; R&S coleta de diversidade opcional, integração Protheus/Datasul criando vagas, Mercer.
- Out: AD relatório 9Box >400 participantes; R&S novos filtros, página de carreiras com 10 links, job boards gratuitos automáticos, Be Bee, API de e-mail.
- Nov: IA classifica comentários de pesquisa; Gamificação com desempate; R&S permissões do ATS gerenciadas na Feedz, Vagas.SC, currículos com idiomas, API de anexos.
- Dez: AD/AE novo cálculo definitivo; PE favorabilidade e adesão; Comunicados com log e filtros; DP novos motivos de cargo/salário; Persona em ES/EN; R&S candidatura simplificada, menu Indicadores.

2026
- Jan: busca avançada em Persona; Celebrações aviso de imagem >10 MB; Gestão desativar e-mail de boas-vindas; Objetivos campos Indicador e Memória de Cálculo; Férias relatório consolidado de saldos; R&S análise de currículos por IA, vagas em destaque, nova interface.
- Fev: Cargos e Salários campo de experiência; Admissão Digital prazo de documentos 1-30 dias via ATS; Desengajados mais rápida; importador desbloqueia após 10 min; R&S e-mail de reprovação no fluxo, lista como padrão, candidatura simplificada cancelável.
- Mar: "Teste" vira "Mapeamento" (Persona); Comunicados relatório consolidado; PDI relatório de trilhas/onboarding; PE escala numérica 1-5; R&S campos obrigatórios na candidatura simplificada, integração de admissão com ERPs TOTVS, "Minhas Vagas".
- Abr: Sucessões (gestores indicam sucessores); MRP (Mapeamento de Riscos Psicossociais); R&S QR code de vagas, transferência de talentos sem novo aceite, filtro de colaboradores e ex-colaboradores.
- Mai: DP planejamento de férias coletivas, contratação freelancer, unidade e dados de pagamento ocultáveis na admissão; Avaliações escala binária em massa; Planos de Ação com evidências; R&S RioVagas, convidar talento.
- Jun: MRP lembretes; Planos de Ação com anexos (5); clique na linha abre edição de colaborador; R&S histórico de edições da vaga, status "Desistente", troca de aprovador.
- Jul: AD trava de calibração; PMRP mínimo de 3 respostas; indicador de desengajados >30 dias; PDI restringe coluna CPF; Férias campos ocultáveis e cancelamento individual de férias coletivas; R&S RH restringe movimentação de candidatos, CPF em unidades, pausa de prazos, DOC/DOCX.
- Out/set 2026 (artigos soltos): Nova Home e Copiloto IA (15-16/09/2026), People Analytics (18/09/2026).

Tendência: forte investimento em R&S, Avaliações/Incentivos/Objetivos, e em 2026 IA (Copiloto, análise de currículo, classificação de comentários).

---

## 5. Departamento Pessoal (DP)

Módulo contratado à parte; muitos campos e telas só aparecem com ele. Coleção organizada em: ASO, Férias, Admissão digital, Holerites, Cargos e salários, Configurações de Colaboradores, Permissões de Colaboradores.

### 5.1 Admissão Digital
- Pessoas > Admissão Digital > "Nova Admissão" > preencher campos obrigatórios > Enviar; status inicial "Convite enviado". Os campos exatos do convite e a lista de documentos pedidos não estão documentados nos artigos lidos.
- Fluxo: RH cria a admissão, a pessoa candidata recebe o e-mail e preenche dados e documentos digitalmente, RH confere, pede alterações, define e-mail corporativo e libera o acesso à Feedz.
- Recursos: documento personalizado, novos tipos de documento, editar e-mail do convite (templates; cinco modelos atualizados set/24), reenviar convite, alterar e-mail da pessoa candidata, busca por nome e filtros de status/departamento, integração com o ATS (prazo de documentos 1-30 dias), etnia obrigatória, campos de pagamento/CTPS/PIS ocultáveis.
- Permissão específica "gerenciar admissão digital". Relatório personalizado exportável.

### 5.2 Documentos
Aba Documentos na ficha, PDF, 7 tipos fixos (ver 1.4); permissão "gerenciar documentos". Ficha exportável em PDF (jun/25).

### 5.3 Férias (Férias & Recesso)
- Ativação: "Como ativar a funcionalidade de Férias?" + permissão "Gerenciar Férias - RH".
- Fluxo: colaborador solicita (calendário de seleção), gestor aprova, RH acompanha e aprova; RH também pode criar solicitação em nome do colaborador e importar em massa; cancelamento. Status detalhados: não documentados.
- Configuração (RH): por tipo de vínculo (CLT, PJ, Estágio, Sócio): vender férias, antecipar 1a parcela do 13o; dias da semana de início; bloqueio dos 2 dias antes de feriado/DSR; antecedência mínima; orientações e link da política; período aquisitivo (ex.: 365 dias) e saldo (ex.: 30); notificações; contagem em dias úteis opcional.
- Saldos: início do período aquisitivo por colaborador, importação de dados de saldo, relatório consolidado, abas de férias vencidas ou próximas de vencer, gestor vê saldos dos liderados.
- Calendário de Férias e Recesso: linha do tempo para todos, filtros por status, departamento, papel.
- 2026: planejamento de férias coletivas por departamento, cancelamento individual.

### 5.4 Ponto
Não documentado como módulo Feedz. Só há a integração Ahgora (que sincroniza cadastro, não marcações).

### 5.5 Holerites
- Habilitar (permissão "gerenciar holerites"); importar individual ou vários (um PDF de até 15 MB com todos os holerites, reconhecimento por IA usando nome completo, data de admissão e CPF idênticos ao cadastro; uma importação por período); status "Pronto para envio" > "Enviar Holerites"; colaborador vê os próprios em "Meus holerites"; filtros por descrição e datas; validação por CPF; e-mails de disponível/envio.

### 5.6 ASO (Saúde Ocupacional)
Registros de exames admissional, periódico, demissional, mudança de função e retorno ao trabalho; permissão própria; notificações de prazo; busca e filtro de status (pendente, agendado, finalizado, cancelado).

### 5.7 Desligamento (offboarding)
Pessoas > Desligamentos > "Criar desligamento": colaborador, motivo, último dia trabalhado, documento (opcional), transferência de liderados diretos (para gestores); concluir com "Concluir desligamento" > "Concluir solicitação". Tipos: voluntário e involuntário. Alerta de férias em andamento. Alternativa legada: "Como desligar uma pessoa?" e "Inativar/Reativar". Lista de motivos: não documentada (só "Falecimento" citado).

### 5.8 Cargos e salários e histórico
Ver seção 2. Histórico por pessoa com permissões de atualizar/exportar/excluir.

### 5.9 Outros
Atualização cadastral pelo colaborador ("Atualização de cadastro": foto, dados pessoais, contratação CLT/estágio/PJ, residência, informações adicionais, dependentes; precisa ser liberada pelo RH); gestão de papéis; resets de senha e 2FA; exclusão de campos em massa; acesso a dados de inativos/desligados/importados; unidades e departamentos gerenciados por pessoa.

---

## 6. Recrutamento & Seleção (ATS, hoje "TOTVS RH Atração de Talentos")

Plataforma separada acessada via Feedz (atalho no menu), com login/senha próprios (alterar senha, credenciais inválidas) e idioma próprio. Três perfis de uso: Central do Recrutador, Central do Candidato, e página pública de carreiras.

### 6.1 Configurações
Áreas: Gestão de Áreas, de Cargos, de Usuários (campo "Papéis de Acesso" obrigatório; papéis incluem Administrador, Gestor, Recrutador e "Suporte" somente leitura), Parametrização e Permissionamento (só papéis Gestor e Recrutador parametrizáveis, por rotina e ação), Página de Carreiras. Também: unidades (com código, CPF), templates de vaga, perguntas adicionais, roteiros de entrevista, templates de e-mail, marketplace de integrações, coleta de dados de diversidade e inclusão (opcional; para desligar, digitar "Diversidade"; dados apagados às 21h do dia seguinte), sugestões de melhoria.

### 6.2 Vagas
- Criação por IA ou manual; 4 etapas: Dados da vaga (título/cargo, tipo, nº de posições, data limite, faixa salarial, modelo de trabalho, regime, benefícios, requisitos, qualificações, responsabilidades; habilidades por nível; unidade/departamento, estado/cidade; código interno, motivo e justificativa da requisição; envolvidos; recrutador responsável), Etapas do processo, Critérios de avaliação (escala 1-5), Página de carreiras.
- Fases padrão: Candidaturas, Análise de Currículo, Avaliações, Entrevistas, Ofertas, Pré-requisitos para Contratação, Contratações; etapas editáveis; salvar como template.
- Status: Rascunho, Publicada, Congelada, Cancelada, Finalizada.
- Fluxo de aprovação de requisição (até 5 aprovadores; aprovador pode pedir ajustes; troca de aprovador).
- Modelos de candidatura: Simplificada (sem login prévio) ou Tradicional; perguntas eliminatórias; perguntas adicionais.
- Divulgação: página de carreiras (subdomínio único, logo, capa, redes, descrição, até 10 links, SEO), vaga "não listada", QR code, job boards: LinkedIn, Google Empregos, Careerjet, Netvagas, Indeed/Glassdoor, Trampos.co/Novo Trampo, SimplyHired, Be Bee, Vagas.SC, RioVagas.
- Central da Vaga: informações, dados, local, dados internos, pessoas envolvidas, fases, histórico.
- Filtros favoritos, "Minhas Vagas", vista em lista ou cards.

### 6.3 Candidatos e triagem
- Tela de Candidaturas: gráfico de etapas, busca, mover (em lote), reprovar com justificativa, reativar, favoritar, filtro avançado (fase, etapa, status, avaliação, adicionais, data, idade, pretensão, estado, cidade, curso, perguntas adicionais). Coluna "Posição" com ordenação por IA (aderência: experiência, qualificação, sobre você, habilidades; pesos por senioridade; ativada pela Feedz). Análise de currículo por IA (jan/26).
- Currículo: anotações, tags, histórico, e-mails ao candidato, eventos online (integração Google Agenda), impressão, status "Desistente".
- Banco de Talentos: candidatos de qualquer vaga ou inclusão manual; convidar para vagas; tags; favoritos; permissões de acesso.
- Testes: Feedz Persona DISC (cobrado por resposta; saldo mensal global), SkillCert, Mercer. Adicionar como etapa "Avaliações" da vaga.
- Entrevistas: roteiros de entrevista com perguntas e anotações; critérios de avaliação.
- Dashboard (Indicadores): gráficos de vagas (posições x publicadas, candidaturas x contratações, duração média de fechamento, expiração, status, SLA), candidatos (estados, cidades, fonte, reincidência, internos) e diversidade (sexo, gênero, orientação, PCD, faixa etária, cor/raça).
- Integrações: ERPs TOTVS (vagas em rascunho a partir de requisições; cargos, áreas, unidades; admissão), Feedz Admissão Digital, Google Agenda, Marketplace, APIs (candidaturas, e-mail, anexos).
- Central do Candidato: cadastro, currículo (com idiomas), candidatura, página inicial, configurações da conta.

---

## 7. Assinatura Digital

- Módulo sobre o TAE (TOTVS Assinatura Eletrônica); exige módulo Departamento Pessoal. Teste gratuito de 30 dias criando conta TAE; contratação na TOTVS Store por pacote mensal de envelopes (mínimo 20; cupons TAEFEEDZBASIC 50% 20-190, TAEFEEDZPRO 37% 200-480, TAEFEEDZCORP 9% >500, por 12 meses; no máximo R$ 1,97 por envelope; só CNPJ; boleto ou cartão). Os próprios artigos têm inconsistências no mínimo (20 vs. 2 pacotes de 10) e no desconto mostrado.
- Integração: Configurações > Integrações > seção "Assinatura Digital" (e-mail e senha da conta TOTVS) > Salvar. Permissão por pessoa: aba Permissões > Geral > "Assinatura digital".
- Envio: Pessoas > Assinatura digital > "Documento": 1) nome + PDF; 2) destinatários (pessoas ativas da Feedz ou externos com nome e e-mail), ação por destinatário (Assinar, Validar, Testemunhar) e, para internos, exibir ou não o documento no cadastro; 3) data limite, periodicidade de lembretes por e-mail, permitir rejeição; e-mail personalizável; Enviar. Busca por nome, status e destinatários. Lista de status: não documentada.
- Assinatura pelo destinatário: e-mail do TAE, código de verificação por e-mail, leitura, assinatura eletrônica com CPF/CNPJ e aceite, recebimento da cópia assinada.
- Consumo: no TAE, Análises > "Meus indicadores de consumo" (envelopes, documentos por status, consumo mensal, média); histórico de pacotes.
- Assinatura ICP-Brasil/certificado digital, múltiplas ordens de assinatura, modelos: não documentados.

---

## 8. Lacunas (o que a central de ajuda não documenta ou não deixou claro)

- Menu completo com hierarquia exata; lista de tipos de notificação; tela de preferências de LGPD, termos, DPO.
- Campos personalizados no cadastro; competências no cadastro de cargo; sub-departamentos; limite de tamanho de documentos; visibilidade de documentos por papel.
- Campos exatos do convite de Admissão Digital, documentos exigidos do candidato, lista de status de admissão, férias e assinatura; lista de motivos de desligamento; checklist formal de offboarding.
- Ponto eletrônico, folha de pagamento propriamente dita (só importação de holerite em PDF), eSocial.
- Funcionalidades do app mobile e requisitos.
- Login por Google/Microsoft (citado como integração, sem tutorial); API aberta e webhooks (apenas remetem a docs.feedz.com.br, não lido); integração Afferolab.
- Colunas dos relatórios (exceto Resumo de atividades), formatos de arquivo (só Excel citado).
- Datas exatas das novidades (só mês); as 4 datas de artigo em set/2026 chamam atenção por estarem "no futuro" em relação aos release notes que terminam em jul/26 (estão coerentes com a data atual do projeto).
- Artigos não lidos integralmente (só títulos listados): trocar foto/senha, "Não localizo uma pesquisa", "Como sugiro melhorias", reenviar boas-vindas, resetar senha/2FA, alterar vínculo/descrição do cargo/unidade/departamento, inativar/reativar/desligar (versão legada), excluir campos em massa, acessar dados de inativos, e-mail do convite de admissão, documento personalizado, tipos de documento, conferir admissão, editar contratação, reenviar convite, relatório personalizado, ATS > Feedz, importar holerite individual, ver meus holerites, ativar holerites, ASO (permissão, gestão, criar), férias (ativar, solicitar, acompanhar, aprovar, cancelar, importar, calendário em branco, período aquisitivo, saldos RH/gestor), todas as permissões de colaboradores individuais (18), R&S configurações individuais (cadastro de usuário/área/cargo/template etc.), trilha de R&S de candidato, DISC (3 artigos), páginas de compartilhamento em portais, e a maioria dos artigos de "Gestão" já cobertos por índice.

---

## URLs dos artigos lidos

Primeiros passos: /articles/6457205, 9558241, 6464996, 16544420, 10513856, 6465122, 6465084, 16920625, 6657199, 6561989, 6633689, 6457735, 8986684, 9437873, 10249316, 6465022, 11515499, 6458224, 9917638
Configurações: 6465020, 6458286, 7938135, 7130150, 6464958, 6458462, 6458349, 6457852, 6458372, 6458448, 6458353, 8986205, 6561807, 6672608, 7135344, 6465024, 7910810, 9944018, 10226712; Cargos: 11327339, 6465108, 11388002, 11388041, 11388070, 11388062; Integrações: 8325219, 9500526, 9210346, 9210130, 8206093, 6728919, 6694687, 6616717, 9904133, 10249232, 6662681, 9210594
Gestão e Relatórios: 6487143, 6487131, 6486872, 6487057, 6487120, 6486843, 6487125, 6487141, 8239755, 6458478, 10216456, 17005471, 6486910, 6848761, 6879005
Release notes: 9345802, 9345905, 9345982, 9395641, 9440572, 9624036, 9714625, 9827348, 9979803, 10185543, 10262708, 10534751, 10536155, 10774768, 11145051, 11185944, 11781257, 11781643, 12011244, 12141495, 12499086, 12838973, 12973839, 13389326, 13913916, 13914159, 14744507, 15459596, 15949230, 15949417, 16862785
DP: 6584837, 6610811, 6654276, 6727118, 7984696, 6657112, 9921556, 9921611, 6878971, 7208215, 8618522, 7943583, 7873580, 6653721, 6653891, 9577694, 6610857, 6580032, 6610057, 7905236, 6590531, 6581099, 6581076
R&S: 11899073, 9390098, 6964222, 6963582, 9386697, 6953275, 6959867, 6964864, 6964206, 8677241, 9175710, 6953246, 6963547
Assinatura Digital: 8977524, 8975721, 8975887, 8975921, 8980174, 8981179, 9117154
ATS: 12233046

Todas sob https://ajuda.feedz.com.br/pt-BR/articles/<id>. Coleções varridas: 3586761, 3583053, 3587531, 3597226, 3977649, 3639299, 3931065, 3931068, 3834533, 8452188, 14522762.
