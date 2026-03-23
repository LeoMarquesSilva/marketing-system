/**
 * Dados mockados da pesquisa de clima organizacional
 * Extraídos do INDICADORES CLIMA.csv (Miro)
 */

import type { Indicator, ActionPlan, QuantitativeIndicator } from "./clima-types";

export const INDICADORES: Indicator[] = [
  {
    id: "proposito",
    name: "Indicador de Propósito",
    question:
      "Como vai o seu senso de propósito em relação ao que fazemos no escritório?",
    actions: [
      "E-mail automático estratégico",
      "Reunião mensal/semanal",
      "Canal de comunicação integrado",
      "Cartilha de procedimentos",
      "Análise de demanda",
      "Plano de carreira",
    ],
    /* Scores na ordem da legenda Miro: [DT, D, N, C, CT] */
    statements: [
      {
        id: "p1",
        text: "Os gestores me mantêm informados sobre mudanças na empresa.",
        scores: [11.1, 26.7, 0, 37.8, 24.4], // DT, D, N, C, CT
        practiceType: "evitar",
        actions: ["Reunião mensal de feedback", "E-mail automático"],
      },
      {
        id: "p2",
        text: "Os gestores deixam claras suas expectativas.",
        scores: [8.9, 28.9, 0, 40, 22.2], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Feedback e 1:1 mensais", "Alinhamento trimestral"],
      },
      {
        id: "p3",
        text: "É fácil se aproximar dos gestores e falar com eles.",
        scores: [4.4, 13.3, 28.9, 0, 53.3], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Atuação mais presente dos gestores na operação"],
      },
      {
        id: "p4",
        text: "Os gestores são competentes para tocar o negócio.",
        scores: [2.2, 0, 40, 0, 57.8], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Cursos, imersões, treinamentos sobre gestão"],
      },
      {
        id: "p5",
        text: "Posso fazer qualquer pergunta razoável e obter respostas diretas.",
        scores: [2.2, 6.7, 44.4, 0, 46.7], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Cartilha de procedimentos"],
      },
      {
        id: "p6",
        text: "Os gestores contratam pessoas que se enquadram bem aqui.",
        scores: [4.4, 13.3, 40, 0, 42.2], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Testes no seletivo", "Conversas com a equipe antes de contratar"],
      },
      {
        id: "p7",
        text: "Os gestores sabem coordenar e distribuir tarefas.",
        scores: [2.2, 22.2, 0, 42.2, 31.1], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Análise de demanda"],
      },
      {
        id: "p8",
        text: "Os gestores confiam que as pessoas fazem bom trabalho sem vigiá-las.",
        scores: [6.7, 15.6, 0, 42.2, 35.6], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Gestão mais comunicativa", "Investir em aprendizado"],
      },
      {
        id: "p9",
        text: "Os gestores dão autonomia às pessoas.",
        scores: [6.7, 6.7, 0, 44.4, 42.2], // DT, D, N, C, CT
        practiceType: "evitar",
        actions: ["Alinhamento de expectativas", "Evitar feedbacks subjetivos"],
      },
      {
        id: "p10",
        text: "Os gestores têm visão clara de para onde estamos indo.",
        scores: [6.8, 15.9, 45.5, 31.8, 0], // DT, D, N, C, CT (sum 100%)
        practiceType: "acelerar",
        actions: ["Metas individuais e de equipe", "Plano de carreira"],
      },
      {
        id: "p11",
        text: "Os gestores cumprem o que prometem.",
        scores: [2.2, 28.9, 0, 35.6, 26.7], // DT, D, N, C, CT
        practiceType: "evitar",
        actions: ["Plano de carreira", "Evitar criar promessas"],
      },
      {
        id: "p12",
        text: "Os gestores agem de acordo com o que falam.",
        scores: [2.2, 26.7, 0, 40, 28.9], // DT, D, N, C, CT (sum 97.8%, missing ~2.2)
        practiceType: "evitar",
        actions: ["Gestão aberta e consciente", "Expor situação e soluções"],
      },
      {
        id: "p13",
        text: "Os gestores só promoveriam reduções de quadro como último recurso.",
        scores: [11.1, 26.7, 55.6, 0, 6.7], // DT, D, N, C, CT (small dark blue segment ~6.7)
        practiceType: "acelerar",
      },
      {
        id: "p14",
        text: "Os gestores são honestos e éticos na condução dos negócios.",
        scores: [6.7, 44.4, 0, 46.7, 2.2], // DT, D, N, C, CT (small dark blue ~2.2)
        practiceType: "acelerar",
        actions: ["Cartilha de política da área"],
      },
    ],
  },
  {
    id: "seguranca",
    name: "Indicador de Segurança",
    question: "Como está sua segurança física e emocional?",
    actions: [
      "Instalação de câmeras",
      "Canal de denúncia",
      "Convênios médicos",
      "Formato híbrido",
      "Day off por performance",
      "Workshops de saúde mental",
    ],
    /* Scores na ordem da legenda Miro: [DT, D, N, C, CT] */
    statements: [
      {
        id: "s1",
        text: "Este é um lugar fisicamente seguro para trabalhar.",
        scores: [0, 0, 8.9, 26.7, 64.4], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Instalação de câmeras", "Adaptar local para prevenção"],
      },
      {
        id: "s2",
        text: "Este é um lugar psicológico e emocionalmente saudável.",
        scores: [2.2, 24.4, 0, 44.4, 28.9], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Workshops de saúde mental", "Canal de denúncia"],
      },
      {
        id: "s3",
        text: "Nossas instalações contribuem para um bom ambiente.",
        scores: [0, 6.7, 0, 42.2, 51.1], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Logística do refeitório"],
      },
      {
        id: "s4",
        text: "Posso me ausentar do trabalho quando necessário.",
        scores: [0, 4.4, 0, 37.8, 51.1], // DT, D, N, C, CT
        practiceType: "evitar",
        actions: ["Evitar sobrejornada", "Análise de demanda"],
      },
      {
        id: "s5",
        text: "A liderança me incentiva a equilibrar vida pessoal e profissional.",
        scores: [0, 15.6, 0, 35.6, 48.9], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Day off por performance", "Gifts"],
      },
      {
        id: "s6",
        text: "A liderança me trata com respeito como profissional e como pessoa.",
        scores: [0, 4.4, 0, 28.9, 66.7], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Reconhecimento dos funcionários"],
      },
      {
        id: "s7",
        text: "Meu salário é justo pelo trabalho que executo.",
        scores: [6.7, 28.9, 28.9, 22.2, 13.3], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Análise de mercado salarial", "Avaliação de desempenho"],
      },
    ],
  },
  {
    id: "reconhecimento",
    name: "Indicador de Reconhecimento",
    question: "Você se sente reconhecido e valorizado por aqui?",
    actions: [
      "Reuniões individuais de feedback",
      "Bonificações",
      "Plano de carreira",
      "Avaliação de desempenho trimestral/semestral",
      "Caixinha de sugestões",
      "Eventos de confraternização",
    ],
    /* Scores na ordem da legenda Miro: [DT, D, N, C, CT] */
    statements: [
      {
        id: "r1",
        text: "Sinto que o meu trabalho tem um propósito significativo.",
        scores: [2.2, 2.2, 4.5, 46.7, 44.4], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Reconhecer por mérito", "Promover mais autonomia", "Promover mais desafios"],
      },
      {
        id: "r2",
        text: "As atividades que realizo no meu trabalho são importantes para mim.",
        scores: [2.2, 2.2, 4.5, 48.9, 42.2], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Reconhecer por mérito", "Promover mais autonomia", "Promover mais desafios"],
      },
      {
        id: "r3",
        text: "Sinto-me valorizado(a) pelo trabalho que realizo.",
        scores: [4.1, 2.6, 20, 44.4, 28.9], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Incentivos financeiros", "Projetos mais desafiadores", "Crescimento profissional"],
      },
      {
        id: "r4",
        text: "Recebo reconhecimento adequado pelo meu desempenho no trabalho.",
        scores: [6.7, 28.9, 37.8, 24.4, 2.2], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Incentivos financeiros", "Projetos mais desafiadores", "Crescimento profissional"],
      },
      {
        id: "r5",
        text: "Consigo equilibrar bem minhas responsabilidades profissionais e pessoais.",
        scores: [11.1, 17.8, 46.7, 24.4, 0], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Flexibilidade de horário", "Redução de sobrecarga", "Apoio a saúde mental"],
      },
      {
        id: "r6",
        text: "A empresa promove um bom equilíbrio entre trabalho e vida pessoal.",
        scores: [11.4, 20.5, 36.4, 27.3, 4.4], // DT, D, N, C, CT
        practiceType: "evitar",
        actions: ["Flexibilidade de horário", "Redução de sobrecarga", "Apoio a saúde mental"],
      },
      {
        id: "r7",
        text: "Tenho boas relações interpessoais no meu ambiente de trabalho.",
        scores: [2.2, 0, 0, 35.6, 62.2], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Fomentar a coletividade", "Dia do vôlei, beach tennis, treino (unir equipes)"],
      },
      {
        id: "r8",
        text: "O ambiente de trabalho é saudável e colaborativo.",
        scores: [0, 13.3, 0, 35.6, 51.1], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Definir metas/regras para o engajamento", "Promover ambiente de cooperação e trabalho em equipe"],
      },
      {
        id: "r9",
        text: "Os gestores agradecem o bom trabalho e o esforço extra.",
        scores: [2.3, 4.5, 11.4, 29.5, 52.3], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Caixinha de sugestões anônima"],
      },
      {
        id: "r10",
        text: "Meu superior me encoraja a contribuir com ideias.",
        scores: [4.4, 8.9, 22.2, 0, 64.4], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Reuniões de novas ideias", "Convidar equipe para reuniões com clientes"],
      },
    ],
  },
  {
    id: "qualidade-eficiencia",
    name: "Indicador de Qualidade e Eficiência (Remuneração/Performance)",
    question: "Como avalia remuneração e meritocracia?",
    actions: [
      "PLR",
      "Avaliação de desempenho",
      "Plano de participação nos lucros",
      "VR/Ifood Benefícios",
      "Análise de mercado salarial",
    ],
    /* Scores na ordem da legenda Miro: [DT, D, N, C, CT] */
    statements: [
      {
        id: "q1",
        text: "Meu salário é justo.",
        scores: [6.7, 13.3, 22.2, 28.9, 28.9],
        practiceType: "comecar",
        actions: ["Análise de mercado", "Plano de PLR"],
      },
      {
        id: "q2",
        text: "A quantia que recebo como participação nos resultados é justa.",
        scores: [26.7, 22.2, 37.8, 2.2, 11.1], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Plano de participação nos lucros"],
      },
      {
        id: "q3",
        text: "Temos benefícios especiais e diferenciados aqui.",
        scores: [26.7, 31.1, 28.9, 6.7, 6.7], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["VR, Ifood Benefícios"],
      },
      {
        id: "q4",
        text: "Todos têm a oportunidade de receber um reconhecimento especial.",
        scores: [4.4, 17.8, 15.6, 35.6, 26.7], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Plano de carreira", "Avaliação de desempenho"],
      },
      {
        id: "q5",
        text: "Eu sou considerado importante independentemente de minha posição.",
        scores: [2.2, 13.3, 0, 44.4, 40], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Plano de transparência"],
      },
      {
        id: "q6",
        text: "As promoções são dadas às pessoas que realmente mais merecem.",
        scores: [4.4, 15.6, 26.7, 31.1, 22.2], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Métricas de desempenho", "Plano de carreira"],
      },
      {
        id: "q7",
        text: "Os gestores evitam o favoritismo.",
        scores: [4.4, 8.9, 28.9, 31.1, 26.7], // DT, D, N, C, CT
        practiceType: "evitar",
        actions: ["Planilha de feedback anônimo"],
      },
      {
        id: "q8",
        text: "As pessoas evitam 'politicagem' e intrigas.",
        scores: [4.4, 6.7, 24.4, 37.8, 26.7], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Canal de denúncia", "Feedback anônimo"],
      },
    ],
  },
  {
    id: "diversidade",
    name: "Indicador de Diversidade e Inclusão",
    question: "O escritório respeita diversidade e inclusão?",
    actions: [
      "Central de denúncias",
      "Compliance",
      "Eventos de integração",
      "Happy hour temático",
    ],
    /* Scores na ordem da legenda Miro: [DT, D, N, C, CT] */
    statements: [
      {
        id: "d1",
        text: "As pessoas são bem tratadas independente de cor/etnia.",
        scores: [0, 0, 0, 15.6, 84.4], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Contratação multiracial", "Eventos de integração"],
      },
      {
        id: "d2",
        text: "As pessoas são bem tratadas independente de idade.",
        scores: [0, 2.2, 0, 17.8, 80], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Abordar tema em datas importantes"],
      },
      {
        id: "d3",
        text: "As pessoas são bem tratadas independente do sexo.",
        scores: [2.2, 4.4, 0, 17.8, 75.6], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Reuniões sobre como as pessoas se sentem"],
      },
      {
        id: "d4",
        text: "As pessoas são bem tratadas independente de orientação sexual.",
        scores: [0, 0, 0, 20, 80], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Central de denúncias", "Compliance"],
      },
      {
        id: "d5",
        text: "Se tratado injustamente, serei ouvido e receberei tratamento justo.",
        scores: [2.2, 13.3, 6.7, 28.9, 48.9], // DT, D, N, C, CT
        practiceType: "comecar",
        actions: ["Reuniões que deem espaço para o colaborador"],
      },
      {
        id: "d6",
        text: "O escritório tem ambiente que respeita diversidade e inclusão.",
        scores: [0, 4.4, 0, 26.7, 68.9], // DT, D, N, C, CT
        practiceType: "acelerar",
        actions: ["Eventos sobre inclusão e diversidade"],
      },
    ],
  },
];

export const PLANOS_ACAO: ActionPlan[] = [
  {
    id: "ap1",
    title: "Comunicação interna + Desenvolvimento pessoal e profissional",
    what: "2 pilares: Individual (cursos, pós-graduação) e Coletivo (cartilha de procedimentos, reuniões de feedback)",
    why: "Insatisfação com comunicação e falta de plano de carreira",
    who: "Emanueli (individual) / Gestores (coletivo)",
    where: "Salas de reunião (coletivo) / Plataformas de ensino (individual)",
    when: "Início imediato, revisões mensais por 6 meses",
    how: "Cartilha de procedimentos, reuniões de feedback, cursos de extensão até R$500/colaborador, pós até R$1.400/colaborador",
    howMuch: "Cursos extensão até R$500/colaborador; Pós até R$1.400/colaborador",
    priority: "urgente",
    status: "em_andamento",
    responsible: "Emanueli",
    indicatorId: "proposito",
  },
  {
    id: "ap2",
    title: "Segurança física",
    what: "Melhorias na segurança física do escritório",
    why: "Garantir ambiente seguro, saudável e acessível",
    who: "Equipe de clima + liderança",
    where: "Sede do escritório",
    when: "Metas para implementação em jan/2025",
    how: "Extintores, luzes de emergência, insulfilme, câmeras, avaliação de rachaduras",
    howMuch: "A definir com cotação",
    priority: "urgente",
    status: "backlog",
    responsible: "Leticia",
    indicatorId: "seguranca",
  },
  {
    id: "ap3",
    title: "Canal de Ouvidoria e Denúncia (Valor & Integração)",
    what: "Canal anônimo de solicitações/denúncias via extranet existente",
    why: "Insatisfação em reconhecimento, trato pessoal, saúde mental, salário",
    who: "Comissão Valor & Integração",
    where: "Central de Solicitações na extranet",
    when: "Início imediato, revisões trimestrais",
    how: "Integração com app existente, e-mail específico para clima/gestão",
    howMuch: "Sem custo inicial; gifts variáveis (jantar, spa day, vale, bônus)",
    priority: "urgente",
    status: "em_andamento",
    responsible: "Gabriel",
    indicatorId: "seguranca",
  },
  {
    id: "ap4",
    title: "Diversidade, Equidade e Equilíbrio",
    what: "Palestras e ações de conscientização",
    why: "Igualdade de gênero, raça, idade; equilíbrio vida pessoal/profissional",
    who: "O escritório / Gestores com suas áreas",
    where: "No escritório e eventualmente locais externos",
    when: "Datas específicas (Dia da Mulher, Consciência Negra) + Início imediato",
    how: "Palestras, ações, orientação para gestores sobre distribuição de demandas",
    howMuch: "A definir",
    priority: "programar",
    status: "backlog",
    responsible: "Caroline e Midian",
    indicatorId: "diversidade",
  },
  {
    id: "ap5",
    title: "Saúde Mental + Plano de Carreira + Pesquisa Salarial",
    what: "Conscientização saúde mental (TotalPass) + Plano de Carreira + Pesquisa salarial",
    why: "Alinhamento de expectativas, equilíbrio emocional, insatisfação salarial",
    who: "Profissional da área / Gestores / Gente e Gestão",
    where: "Online ou presencial / Escritório",
    when: "Setembro (saúde mental) / Início imediato (carreira) / Em andamento (salários)",
    how: "Palestras e workshops; diligências com 5-10 escritórios; estruturação de plano",
    howMuch: "Palestrante + TotalPass TP2 a partir de R$150; hora dos colaboradores/gestores",
    priority: "programar",
    status: "backlog",
    responsible: "Gente e Gestão",
    indicatorId: "reconhecimento",
  },
  {
    id: "ap6",
    title: "Newsletter + Teste de Personalidade + Treinamento de Gestão",
    what: "Newsletter quinzenal + teste de personalidade no seletivo + treinamento de liderança",
    why: "Manter informação entre todos; filtrar enquadramento à cultura; insatisfação com gestão",
    who: "Gestores indicados / Gestor / Empresa contratada",
    where: "Via e-mail / No escritório / A definir",
    when: "Quinzenalmente / 2ª etapa do seletivo / Janeiro (recesso)",
    how: "Via e-mail / Curso / Teste presencial ou online",
    howMuch: "~R$1.200/pessoa (treinamento); hora do colaborador",
    priority: "programar",
    status: "backlog",
    responsible: "Gestores",
    indicatorId: "proposito",
  },
];

export const INDICADORES_QUANTITATIVOS: QuantitativeIndicator[] = [
  {
    id: "comunicacao-interna",
    name: "Indicador de Comunicação Interna",
    question: "Como você avalia a comunicação interna no escritório?",
    scores: [2.2, 11.1, 35.6, 35.6, 15.6],
    labels: ["Muito ruim", "Ruim", "Média", "Boa", "Excelente"],
    analysis:
      "Reflete a eficácia da comunicação dentro da organização. Uma comunicação clara e eficiente é essencial para o alinhamento e a coesão da equipe. OKR: Melhorar a percepção da eficácia da comunicação interna em X pontos no próximo trimestre. KPI: Percentual de colaboradores que avaliam positivamente a comunicação interna.",
  },
  {
    id: "motivacao",
    name: "Indicador de Motivação",
    question: "Você se sente motivado no seu trabalho diário?",
    scores: [0, 0, 22.2, 57.8, 20],
    labels: ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"],
    analysis:
      "Revela o nível de motivação dos colaboradores no trabalho diário, um fator crucial para a produtividade. OKR: Aumentar o índice de motivação dos colaboradores para Y até o final do ano. KPI: Percentual de colaboradores que se sentem motivados no trabalho diário.",
  },
  {
    id: "abertura-feedback-lideranca",
    name: "Liderança aberta a feedback",
    question: "A liderança do escritório está aberta a feedback e sugestões dos funcionários?",
    scores: [0, 6.7, 13.3, 40, 40],
    labels: ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"],
    analysis:
      "Avalia o quão aberta a liderança está para receber feedback dos colaboradores. OKR: Ampliar a abertura da liderança para feedback. KPI: Percentual de colaboradores que acreditam que a liderança está aberta a feedback.",
  },
  {
    id: "acesso-feedback-construtivo",
    name: "Acesso a feedback construtivo",
    question: "Você tem acesso a feedback construtivo sobre seu desempenho?",
    scores: [4.4, 15.6, 40, 22.2, 17.8],
    labels: ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"],
    analysis:
      "Avalia se os colaboradores têm acesso a feedback construtivo sobre desempenho. OKR: Garantir que todos os colaboradores recebam feedback construtivo pelo menos uma vez por trimestre. KPI: Percentual que recebe feedback construtivo regularmente.",
  },
  {
    id: "suporte-saude-mental",
    name: "Indicador de Suporte à Saúde Mental",
    question: "O Escritório oferece suporte adequado para saúde mental e bem-estar das pessoas?",
    scores: [4.4, 15.6, 44.4, 17.8, 17.8],
    labels: ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"],
    analysis:
      "Avalia se os colaboradores sentem que têm o suporte adequado para questões de saúde mental, o que é vital para a sustentabilidade do ambiente de trabalho. OKR: Implementar novas iniciativas de suporte à saúde mental para melhorar a percepção de adequação do suporte em Y% até o próximo trimestre. KPI: Percentual de colaboradores que classificam o suporte à saúde mental como adequado.",
  },
  {
    id: "equilibrio-vida-trabalho",
    name: "Indicador de Equilíbrio Vida/Trabalho",
    question: "Como você classificaria o equilíbrio entre trabalho e vida pessoal no escritório?",
    scores: [2.2, 15.6, 53.3, 22.2, 6.7],
    labels: [
      "Muito desequilibrado",
      "Pouco desequilibrado",
      "Equilibrado",
      "Bem equilibrado",
      "Excelentemente equilibrado",
    ],
    analysis:
      "Mede a percepção dos colaboradores sobre o equilíbrio entre trabalho e vida pessoal, fundamental para o bem-estar e retenção de talentos. A maioria classifica como Bem equilibrado ou Equilibrado. OKR: Aumentar a percepção de equilíbrio para que 90% classifiquem como Bem equilibrado ou Equilibrado até o próximo trimestre. KPI: Percentual de colaboradores que classificam seu equilíbrio como Bem equilibrado ou Equilibrado.",
  },
  {
    id: "felicidade",
    name: "Indicador de Felicidade",
    question: "Em uma escala de 0 a 10, qual nota você daria para sua felicidade geral no trabalho?",
    averageScore: 8.31,
    scaleMax: 10,
    responseCount: 45,
    analysis:
      "Mede a satisfação geral dos colaboradores com seu trabalho, um reflexo direto do clima organizacional. OKR: Aumentar a média de satisfação dos colaboradores para X até o final do próximo semestre. KPI: Média da nota de satisfação dos colaboradores.",
  },
];
