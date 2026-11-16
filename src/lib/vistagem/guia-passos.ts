import type { ModuloGuia, PassoGuia } from "./guia";

/** Nome da aba no cartão do guia ("Guia · Conferência"). */
export const TITULO_GUIA: Record<ModuloGuia, string> = {
  "visao-geral": "Visão geral",
  gestao: "Gestão das publicações",
  triagem: "Triagem Manual",
  duplicidades: "Duplicidades",
  vistagem: "Vistagem",
  conferencia: "Conferência",
  check: "Check",
  configuracoes: "Configurações",
};

/**
 * Passos do guia de cada aba, na ordem em que uma pessoa nova usa a tela. O alvo é o data-tour do elemento (marcado
 * nos componentes de components/operacoes-legais/vistagem); o último passo é o resumo, no meio da tela.
 */
export const PASSOS_GUIA: Record<ModuloGuia, PassoGuia[]> = {
  "visao-geral": [
    {
      id: "hoje",
      alvo: "vg-visao-hoje",
      titulo: "Como está o dia",
      texto:
        "Aqui ficam a data de hoje e a situação do arquivo da Kurier: recebido, aguardando ou dia sem arquivo. Se num dia útil ele não chegar até a hora do alerta (8h, ajustável nas Configurações), uma faixa vermelha aparece com o atalho para a Gestão das publicações. Atualizar recarrega todos os números.",
    },
    {
      id: "esteira",
      alvo: "vg-visao-esteira",
      titulo: "Onde estão as publicações agora",
      texto:
        "Cada cartão é uma aba, na ordem do cabeçalho: Gestão das publicações, Triagem Manual, Duplicidades, Vistagem, Conferência e Check. O número mostra quantas estão em cada etapa agora; clique no cartão para abrir a aba.",
    },
    {
      id: "chegada",
      alvo: "vg-visao-chegada",
      titulo: "O que chegou da Kurier",
      texto:
        "Mostra o que veio no arquivo (e nas publicações coladas) e até onde entrou: na vistagem, como duplicidade, descartada ou só no arquivo. No canto, escolha Hoje, 7 ou 30 dias; embaixo, cada área mostra quantas chegaram e quantas já foram checadas no período.",
    },
    {
      id: "para-vistar",
      alvo: "vg-visao-para-vistar",
      titulo: "Quem tem o que vistar",
      texto:
        "Para cada área, quantas publicações estão com o jurídico e a data da mais antiga, além do que já está na conferência e no check. Embaixo, cada vistador nas demandas normais e nas de risco; \"Vistador a definir\" quer dizer que a área ainda não tem vistador nas Configurações.",
    },
    {
      id: "grupos",
      alvo: "vg-visao-grupos",
      titulo: "Por grupo de clientes",
      texto:
        "Os grupos que mais receberam publicações no período, do maior para o menor (os 10 primeiros; o resto soma em \"Outros grupos\"). Cada barra mostra onde elas estão: na triagem, para vistar ou já vistadas.",
    },
    {
      id: "resumo",
      alvo: null,
      titulo: "O começo do dia",
      texto:
        "Comece por aqui: veja se o arquivo chegou, onde as publicações estão paradas e quem tem mais para vistar. Para agir, clique no cartão da etapa. O botão \"Ver guia\", no cabeçalho, mostra este passo a passo de novo.",
    },
  ],

  gestao: [
    {
      id: "hoje",
      alvo: "vg-gestao-hoje",
      titulo: "O arquivo de hoje",
      texto:
        "Primeiro, veja se o arquivo da Kurier de hoje chegou: Chegou, Importando, Com erro, Não chegou ou Aguardando. O ORQESTRAI busca sozinho no SharePoint entre 7h e 8h, tenta de novo entre 9h e 10h nos dias úteis, e já faz a triagem.",
    },
    {
      id: "buscar",
      alvo: "vg-gestao-buscar",
      titulo: "Buscar ou enviar o arquivo",
      texto:
        "Se o arquivo atrasou, \"Buscar no SharePoint\" procura de novo; se você já tem o arquivo, use \"Enviar xlsx\" ao lado (até 20 MB). Enviar o mesmo arquivo de novo não duplica nada, e a triagem roda logo depois.",
    },
    {
      id: "colar",
      alvo: "vg-gestao-colar",
      titulo: "Publicações por e-mail ou Teams",
      texto:
        "Para as que chegam por e-mail ou Teams, cole o texto como veio (Recorte Digital da OAB/SP ou comunicação do DJEN). Antes de importar, você vê o que foi reconhecido; depois, elas seguem a mesma esteira do arquivo da Kurier.",
    },
    {
      id: "arquivos",
      alvo: "vg-gestao-arquivos",
      titulo: "Arquivos recebidos",
      texto:
        "Os 30 arquivos mais recentes, com a origem (SharePoint, envio manual ou colado) e a situação. As contagens mostram linhas, captadas, duplicidades e descartadas. Clique num dia para ver para onde foi cada publicação.",
    },
    {
      id: "filtros",
      alvo: "vg-gestao-filtros",
      alternativa: "vg-gestao-arquivos",
      titulo: "Para onde foi cada publicação",
      texto:
        "Os botões separam as publicações do arquivo pelo destino: jurídico, Triagem Manual, duplicidades e descartadas. A busca, a área e o tribunal filtram a lista, e as contagens já respeitam esses filtros.",
    },
    {
      id: "lista",
      alvo: "vg-gestao-lista",
      alternativa: "vg-gestao-publicacoes",
      titulo: "O detalhe de cada publicação",
      texto:
        "Clique numa publicação para ver para onde ela foi e por quê, com a pasta, as datas e o texto. O detalhe é só consulta: para resolver pendências e duplicidades, use o botão que leva à Triagem Manual ou a Duplicidades.",
    },
    {
      id: "resumo",
      alvo: null,
      titulo: "Rotina da Gestão",
      texto:
        "Todo dia: veja se o arquivo chegou; se não, busque no SharePoint ou envie o xlsx; cole o que veio por e-mail ou Teams. O trabalho segue nas abas Triagem Manual, Duplicidades e Vistagem.",
    },
  ],

  triagem: [
    {
      id: "tipos",
      alvo: "tm-tipos-pendencia",
      titulo: "O que cai aqui",
      texto:
        "Aqui chegam as publicações que a triagem automática não conseguiu mandar para uma área: sem pasta no VIOS, com mais de uma pasta para o processo ou sem área/grupo do cliente. Embaixo fica a data da mais antiga: o prazo corre enquanto a pendência não é resolvida.",
    },
    {
      id: "busca",
      alvo: "tm-busca",
      titulo: "Buscar e filtrar",
      texto:
        "Procure por processo, CI, grupo, parte ou intimado: Enter abre o primeiro resultado e Esc limpa. Ao lado, filtre pela data da publicação ou pela data da importação.",
    },
    {
      id: "rodar",
      alvo: "tm-rodar-triagem",
      titulo: "Rodar a triagem de novo",
      texto:
        "A cada arquivo da Kurier o sistema já tria de novo; este botão faz isso na hora. Ele procura outra vez a pasta de tudo o que está pendente (por exemplo, se a pasta acabou de ser aberta no VIOS) e avisa quantas foram para o jurídico.",
    },
    {
      id: "fila",
      alvo: "tm-fila",
      titulo: "Uma pendência por vez",
      texto:
        "Você trabalha uma pendência por vez, das mais antigas para as mais novas. Use \"Mostrar fila\" para ver a lista ou as setas no topo da publicação para andar entre elas; ao resolver uma, a próxima abre sozinha.",
    },
    {
      id: "publicacao",
      alvo: "tm-publicacao",
      alternativa: "tm-vazio",
      titulo: "A publicação aberta",
      texto:
        "No topo, o processo e o tipo de pendência; logo abaixo, as datas de divulgação, de publicação e de início do prazo. Mais abaixo está o texto completo para leitura.",
    },
    {
      id: "pasta",
      alvo: "tm-escolher-pasta",
      alternativa: "tm-vazio",
      titulo: "Escolher a pasta",
      texto:
        "Com mais de uma pasta, compare os cartões: a sugerida (estrela) é a única ativa ou a do processo principal. Sem pasta, veja o que o sistema já procurou e, se achar, digite a CI e clique em \"Buscar pasta\". Depois, \"Usar e liberar\" manda para o jurídico da área e \"Usar e agendar direto\" abre aqui a tela de tarefas.",
    },
    {
      id: "destino",
      alvo: "tm-para-onde-vai",
      alternativa: "tm-vazio",
      titulo: "Para onde vai",
      texto:
        "Sem pasta, informe o escritório responsável e o grupo do cliente; com o selo \"Pré-preenchido\", confira a sugestão antes de liberar. \"Demanda de risco\" marca a publicação como risco, e \"Liberar para o jurídico\" manda para a fila da área.",
    },
    {
      id: "resumo",
      alvo: null,
      titulo: "Resumo da Triagem Manual",
      texto:
        "Abra a pendência mais antiga, confira o que o sistema já procurou e sugeriu e decida a pasta e a área. No \"Agendar direto\" nada é gravado até você enviar as tarefas: aí a publicação sai da triagem e vai para a Conferência.",
    },
  ],

  duplicidades: [
    {
      id: "situacao",
      alvo: "dp-situacao",
      titulo: "Conferir ou rever",
      texto:
        "Aqui ficam as publicações que o sistema separou como cópia de outra, a principal: o mesmo despacho para várias partes, o mesmo documento do PJe ou uma publicação que já tinha chegado. Em \"A conferir\" estão as que esperam a sua decisão; em \"Conferidas\", as já decididas.",
    },
    {
      id: "filtros",
      alvo: "dp-filtros",
      titulo: "Buscar e filtrar",
      texto:
        "Busque por processo, grupo, parte ou intimado; a busca olha a principal e as cópias. Ao lado, filtre pelo Id do documento (mesmo Id, Ids diferentes ou sem Id) e pelo tribunal.",
    },
    {
      id: "fila",
      alvo: "dp-fila",
      titulo: "A fila de despachos",
      texto:
        "Cada item é um despacho: a publicação principal com as suas cópias, e o selo mostra quantos envios chegaram. Abra a lista com \"Mostrar fila\" ou ande entre os despachos pelas setas no topo.",
    },
    {
      id: "comparacao",
      alvo: "dp-comparacao",
      alternativa: "dp-vazio",
      titulo: "Principal × cópia",
      texto:
        "A tabela compara a principal com a cópia: Id do documento, intimados, órgão, data de divulgação e tamanho do texto; o ✓ verde é igual e o ponto âmbar, diferente. Com várias cópias, escolha qual comparar nos botões \"Cópia 1, Cópia 2…\".",
    },
    {
      id: "textos",
      alvo: "dp-textos",
      alternativa: "dp-vazio",
      titulo: "Os dois textos",
      texto:
        "Os textos ficam lado a lado, e o que está em um e não no outro aparece em âmbar. No mesmo despacho enviado a várias partes, o normal é mudar só o nome de quem foi intimado.",
    },
    {
      id: "decidir",
      alvo: "dp-decidir",
      alternativa: "dp-vazio",
      titulo: "Confirmar ou desfazer",
      texto:
        "Se for cópia, \"Confirmar duplicidade\": ela sai da fila e não vai para a vistagem. Se não for, \"Não é duplicidade\", no topo da comparação, devolve a cópia à triagem e ela segue o fluxo normal.",
    },
    {
      id: "resumo",
      alvo: null,
      titulo: "Resumo das Duplicidades",
      texto:
        "Abra cada despacho, compare a principal com a cópia e decida. Confirmar evita que o mesmo despacho seja vistado duas vezes; o que já foi decidido fica em \"Conferidas\", onde dá para mudar a decisão enquanto a publicação não seguiu no fluxo.",
    },
  ],

  vistagem: [
    {
      id: "fila",
      alvo: "vj-fila",
      alternativa: "vj-vazio",
      titulo: "Sua fila",
      texto:
        "Aqui ficam as publicações da sua área que esperam vistagem, agrupadas pelo grupo do cliente, com as de demanda de risco primeiro. Clique em uma para abrir; os selos avisam se é de risco, se a pasta tem a etiqueta RC-Insolvência, se foi devolvida pela controladoria ou transferida de outra área.",
    },
    {
      id: "filtros",
      alvo: "vj-filtros",
      titulo: "Busca e filtros",
      texto:
        "Busque por processo, cliente ou CI e filtre por área, recebimento, grupo, tribunal, etiqueta da pasta no VIOS e risco. \"Limpar\" volta a mostrar a fila inteira.",
    },
    {
      id: "publicacao",
      alvo: "vj-publicacao",
      alternativa: "vj-vazio",
      titulo: "A publicação aberta",
      texto:
        "No topo, o número do processo (clique para pesquisar no tribunal) e as setas para a anterior e a próxima. Abaixo, grupo, cliente, área, pasta no VIOS, advogado e auxiliar; se não for da sua área, use \"Transferir área\". A régua mostra divulgação, publicação, início do prazo e fatal.",
    },
    {
      id: "leitura",
      alvo: "vj-leitura",
      alternativa: "vj-vazio",
      titulo: "Leia a publicação",
      texto:
        "O texto vem em parágrafos, com prazos, datas e valores marcados; os \"Pontos de atenção\" levam direto ao trecho. Quando o texto cita um prazo, \"Usar N dias\" já põe esses dias na tarefa de Prazo.",
    },
    {
      id: "sugestao-ia",
      alvo: "vj-sugestao-ia",
      alternativa: "vj-vazio",
      titulo: "Sugestão da IA",
      texto:
        "No Trabalhista, a IA lê a publicação e propõe as tarefas, com o porquê e o grau de confiança; sem prazo nem providência, ela sugere CIÊNCIA NF. \"Usar sugestão\" preenche as tarefas (e o eSocial): confira responsável e datas antes de enviar. Dá para Desfazer ou Ignorar.",
    },
    {
      id: "tarefas",
      alvo: "vj-tarefas",
      alternativa: "vj-vazio",
      titulo: "Inclua as tarefas",
      texto:
        "Cada publicação vira uma ou mais tarefas do VIOS (até 10), uma por cartão. Em cada uma, escolha a classe (Prazo, Providência ou Compromisso) e a tarefa da lista. No Trabalhista, escolha também a classificação eSocial; Acordo homologado e Homologação de cálculo acrescentam a tarefa INSERIR E-SOCIAL.",
    },
    {
      id: "tarefa",
      alvo: "vj-tarefa",
      alternativa: "vj-vazio",
      titulo: "Preencha a tarefa",
      texto:
        "No Prazo, clique nos dias (úteis ou corridos) ou digite a fatal; nos recursos, os dias do prazo legal já vêm marcados, e na Insolvência e nas pastas com a etiqueta RC-Insolvência a contagem já vem em Corridos. O VIOS recebe a data do Enviar, antes da fatal, e o revisor é obrigatório. Providência não tem revisor; Compromisso pede data, horário e hora final. A observação vai na descrição da tarefa no VIOS.",
    },
    {
      id: "fluxo",
      alvo: "vj-fluxo",
      alternativa: "vj-tarefa",
      titulo: "O que o VIOS cria junto",
      texto:
        "Ao escolher a tarefa, aparece o fluxo do VIOS: as tarefas que ele cria junto (como Revisar e Protocolar), com a data e quem fica em cada uma. Para priorizar, mude a data de uma delas: o robô grava a nova data no VIOS (\"voltar à do VIOS\" desfaz). Para outra pessoa fazer, clique em quem fica e escolha os responsáveis (\"voltar ao padrão\" desfaz).",
    },
    {
      id: "enviar",
      alvo: "vj-enviar",
      alternativa: "vj-vazio",
      titulo: "Envie para a conferência",
      texto:
        "Com todas as tarefas prontas, clique em \"Enviar para conferência\": a controladoria confere e o robô lança no VIOS (sem pasta no VIOS, depois de conferida vira pedido de abertura de pasta na Central do SharePoint). Se nada criar a Ciência dos Agendamentos, o ORQESTRAI acrescenta sozinho (menos quando a vistagem é só CIÊNCIA NF, VERIFICAR RENÚNCIA ou SESSÃO DE JULGAMENTO), e a próxima publicação abre.",
    },
    {
      id: "vistado",
      alvo: "vj-visao",
      titulo: "Acompanhe o que a área vistou",
      texto:
        "Em \"Vistado\" você vê tudo o que a sua área vistou nos últimos 30 dias, por qualquer pessoa e inclusive as demandas de risco, e onde cada publicação está: na conferência, com o robô, agendada no VIOS, checada ou em revisão. \"A vistar\" volta para a fila.",
    },
    {
      id: "resumo",
      alvo: null,
      titulo: "Pronto para vistar",
      texto:
        "Escolha a publicação na fila, leia, use a sugestão da IA se houver, monte as tarefas, confira o fluxo do VIOS e envie para a conferência. O botão \"Ver guia\", no cabeçalho, mostra este passo a passo de novo.",
    },
  ],

  conferencia: [
    {
      id: "abas",
      alvo: "cf-abas",
      titulo: "Quatro listas",
      texto:
        "\"A conferir\" traz o que o jurídico vistou e espera a sua conferência. \"Enviadas ao robô\" mostra o que você validou, com o andamento de cada tarefa no VIOS. \"Abertura de pasta\" lista o que você validou sem pasta no VIOS e foi para a Central do SharePoint em vez do robô. \"Inconsistências\" reúne as registradas; as contestadas pelo jurídico pedem a sua decisão.",
    },
    {
      id: "busca",
      alvo: "cf-busca",
      titulo: "Achar uma publicação",
      texto:
        "Busque por processo, cliente, parte ou pessoa: Enter abre o primeiro resultado e Esc limpa. Ao lado, filtre por área, tribunal, data da publicação e data da importação.",
    },
    {
      id: "fila",
      alvo: "cf-fila",
      titulo: "Uma publicação por vez",
      texto:
        "A tela abre uma publicação de cada vez. \"Mostrar fila\" abre a lista por área (no Trabalhista, também por tribunal); as setas no topo da publicação passam para a anterior ou a próxima.",
    },
    {
      id: "publicacao",
      alvo: "cf-publicacao",
      alternativa: "cf-vazio",
      titulo: "A publicação como o jurídico viu",
      texto:
        "À esquerda ficam a ficha da pasta e do processo, as datas e o texto. No topo, quem vistou (e, depois de uma devolução, quem vistou de novo).",
    },
    {
      id: "sugestao-ia",
      alvo: "cf-sugestao-ia",
      alternativa: "cf-vazio",
      titulo: "A sugestão da IA",
      texto:
        "Quando a IA sugeriu tarefas, este bloco mostra o que ela propôs na hora da vistagem, com a confiança e o porquê. O selo diz o que o jurídico fez: usou como veio, usou e alterou ou não usou. Compare com as tarefas pedidas, logo abaixo.",
    },
    {
      id: "tarefas",
      alvo: "cf-tarefas",
      alternativa: "cf-vazio",
      titulo: "O que o jurídico pediu",
      texto:
        "Cada tarefa vem num cartão: o tipo, a data, o responsável e o revisor; no Prazo, uma régua mostra as datas até a fatal. Acima ficam, quando houver, a observação do jurídico e as inconsistências já registradas. O lápis (Editar) ajusta a data e os responsáveis da tarefa e do fluxo sem devolver ao jurídico: o ajuste fica registrado no cartão e vai para o robô ao validar.",
    },
    {
      id: "fluxo",
      alvo: "cf-fluxo",
      alternativa: "cf-tarefas",
      titulo: "O fluxo no VIOS",
      texto:
        "Em ordem de data, as tarefas que o VIOS cria junto com a pedida e quem fica em cada uma. A data alterada aparece marcada; depois do robô, a lista mostra o que ele gravou, com o CI de cada tarefa.",
    },
    {
      id: "acoes",
      alvo: "cf-acoes",
      alternativa: "cf-vazio",
      titulo: "Validar ou devolver",
      texto:
        "\"Validar e enviar ao robô\" manda as tarefas para o robô agendar no VIOS, e a publicação vai para \"Enviadas ao robô\". \"Devolver ao jurídico\" pede o tipo da inconsistência e o que está errado, e a publicação volta para quem vistou.",
    },
    {
      id: "resumo",
      alvo: null,
      titulo: "Pronto para conferir",
      texto:
        "Em \"Enviadas ao robô\", acompanhe o andamento; se uma tarefa der erro, \"Rodar novamente\" manda de novo e avisa quando o robô pode já ter gravado, para não duplicar no VIOS. Em \"Inconsistências\", decida as contestadas.",
    },
  ],

  check: [
    {
      id: "listas",
      alvo: "ck-listas",
      titulo: "As listas do Check",
      texto:
        "\"A checar\" traz o que o robô já gravou no VIOS; \"Em revisão\", o que teve erro apontado; \"Checadas\", o que já tem check. \"Pedido × VIOS\" filtra pelo que diverge, pelo que falta conferir e pelo que confere.",
    },
    {
      id: "busca",
      alvo: "ck-busca",
      titulo: "Achar uma publicação",
      texto:
        "Busque por processo, cliente, parte, pessoa ou CI. Nas Checadas, a lista mostra um dia de importação por vez (hoje, ao abrir; troque em \"Data da importação\"), e a busca procura em todas as checadas, de qualquer dia. Ao lado, filtre por área, tribunal, tipo de agendamento (Ciência NF, Prazo, Providência ou Compromisso) e datas.",
    },
    {
      id: "fila",
      alvo: "ck-fila",
      titulo: "Uma por vez",
      texto:
        "Como na Conferência, a tela abre uma publicação de cada vez. \"Mostrar fila\" abre a lista por área, com a situação do check de cada uma; as setas no topo passam para a anterior ou a próxima.",
    },
    {
      id: "publicacao",
      alvo: "ck-publicacao",
      alternativa: "ck-vazio",
      titulo: "A publicação",
      texto: "À esquerda, a publicação com a ficha e o texto. No topo ficam quem vistou e quem conferiu, com data e hora.",
    },
    {
      id: "comparacao",
      alvo: "ck-comparacao",
      alternativa: "ck-vazio",
      titulo: "Pedido × no VIOS",
      texto:
        "Cada tarefa mostra, lado a lado, o que foi pedido e o que o robô gravou no VIOS: data, horário e responsável. O ícone diz se confere ou diverge; o CI abre a tarefa no VIOS.",
    },
    {
      id: "divergencias",
      alvo: "ck-divergencias",
      alternativa: "ck-comparacao",
      titulo: "Quando algo não bate",
      texto:
        "Se o pedido e o VIOS divergem, um aviso lista cada diferença, por tarefa. \"Apontar erro\" abre o registro já preenchido com o tipo e o texto da divergência, para você revisar antes de salvar.",
    },
    {
      id: "acoes",
      alvo: "ck-acoes",
      alternativa: "ck-vazio",
      titulo: "Check OK ou Encontrei erro",
      texto:
        "\"Check OK\" confirma que a esteira e o agendamento no VIOS estão certos; o check fica com o seu nome. \"Encontrei erro\" registra uma inconsistência de agendamento e a publicação vai para \"Em revisão\"; depois de corrigir no VIOS, o botão vira \"Corrigido: dar check\".",
    },
    {
      id: "resumo",
      alvo: null,
      titulo: "Check feito",
      texto:
        "Depois do check, a próxima da fila abre. Com divergência, dê o check só depois de corrigir no VIOS. Os erros apontados aqui também aparecem na Conferência, em \"Inconsistências\".",
    },
  ],

  configuracoes: [
    {
      id: "topo",
      alvo: "cg-topo",
      titulo: "Regras da Vistagem",
      texto:
        "Só administradores veem esta tela, e o que muda aqui vale para todos em até 1 minuto. Os selos mostram como o servidor está: robô gravando no VIOS ou em simulação, agendamento na intimação ou na pasta, e a IA.",
    },
    {
      id: "secoes",
      alvo: "cg-secoes",
      titulo: "As partes da tela",
      texto:
        "\"O que dá para mudar\" reúne as regras editáveis. \"Regras da esteira\" e \"Como a IA funciona\" são só consulta, e \"Histórico\" mostra quem mudou o quê e quando.",
    },
    {
      id: "vistadores",
      alvo: "cg-vistadores",
      titulo: "Vistadores por área",
      texto:
        "Define quem vista as demandas normais e as de risco de cada área (a mesma pessoa pode estar nas duas); o nome aparece na Visão geral. Quem enxerga a fila fica no cartão Quem acessa a Vistagem, nesta mesma tela.",
    },
    {
      id: "risco",
      alvo: "cg-risco",
      titulo: "Etiquetas de risco",
      texto:
        "Pasta com uma destas etiquetas no VIOS vira demanda de risco: destaque vermelho, filtro próprio e só quem vista risco a recebe para vistar (para ver, a área toda vê). Vale para as próximas triagens; \"Voltar ao padrão\" desfaz.",
    },
    {
      id: "alerta",
      alvo: "cg-alerta",
      titulo: "Alerta do arquivo do dia",
      texto:
        "A partir desta hora, em dia útil, a falta do arquivo da Kurier vira faixa vermelha nas abas. Escolha 7h, 8h ou 9h; salva no clique.",
    },
    {
      id: "ia",
      alvo: "cg-ia",
      titulo: "Inteligência artificial",
      texto:
        "Liga e desliga a sugestão de tarefas (Trabalhista) e a sugestão de pasta (Triagem Manual); salva no clique. Nenhuma das duas grava nada sozinha: só sugere.",
    },
    {
      id: "resumo",
      alvo: null,
      titulo: "Tudo registrado",
      texto:
        "Cada mudança mostra um aviso de salvo e passa a valer em até 1 minuto. Para ver o que mudou e quem mudou, abra \"Histórico\".",
    },
  ],
};
