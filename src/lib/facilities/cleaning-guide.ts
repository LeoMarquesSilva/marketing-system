/**
 * Guias da Limpeza: um por tela, no padrão do "Ver guia" da Vistagem. Abre sozinho na primeira vez que a pessoa
 * entra na tela e volta pelo botão "Ver guia". Cada passo aponta para um elemento com data-tour; sem o elemento
 * (lista vazia, fim de semana), o cartão aparece no meio da tela, ou o passo some quando é opcional.
 */

export const CLEANING_GUIDES = ["limpeza-hoje", "limpeza-acompanhamento", "limpeza-cronograma"] as const;
export type CleaningGuide = (typeof CLEANING_GUIDES)[number];

export function isCleaningGuide(value: unknown): value is CleaningGuide {
  return typeof value === "string" && (CLEANING_GUIDES as readonly string[]).includes(value);
}

export const CLEANING_GUIDE_TITLE: Record<CleaningGuide, string> = {
  "limpeza-hoje": "Limpeza de hoje",
  "limpeza-acompanhamento": "Acompanhamento da limpeza",
  "limpeza-cronograma": "Cronograma da limpeza",
};

export type CleaningGuideIcon =
  | "boas-vindas"
  | "progresso"
  | "marcar"
  | "nao-deu"
  | "aviso"
  | "encerrar"
  | "guia"
  | "assinar"
  | "numeros"
  | "calendario"
  | "anotacao"
  | "ambientes"
  | "equipe"
  | "tipos"
  | "carga"
  | "organizar"
  | "novo";

export interface CleaningGuideStep {
  id: string;
  title: string;
  body: string;
  icon: CleaningGuideIcon;
  /** Valor do data-tour do elemento em destaque; null = cartão no meio da tela. */
  target: string | null;
  /** Some do guia quando o elemento não está na tela (ex.: nenhum dia para conferir). */
  optional?: boolean;
}

export interface CleaningGuideContext {
  /** Quem cuida de Facilities (confere e assina); senão, a equipe da limpeza. */
  canManage: boolean;
  /** Administrador do ORQESTRAI (libera o acesso em Usuários). */
  isAdmin: boolean;
}

function hojeSteps({ canManage }: CleaningGuideContext): CleaningGuideStep[] {
  return [
    canManage
      ? {
          id: "boas-vindas",
          icon: "boas-vindas",
          target: null,
          title: "Esta é a lista da equipe da limpeza",
          body: "É a mesma tela que a equipe abre no celular. O que você marcar aqui conta no Acompanhamento com o seu nome: use para marcar pela equipe só quando precisar.",
        }
      : {
          id: "boas-vindas",
          icon: "boas-vindas",
          target: null,
          title: "Boas-vindas à Limpeza de hoje",
          body: "Aqui você marca, pelo celular, os ambientes que limpou no dia. São poucos toques. Vamos ver juntos, um passo de cada vez.",
        },
    {
      id: "progresso",
      icon: "progresso",
      target: "progresso",
      title: "O seu dia de uma olhada",
      body: "O número mostra quantos ambientes já foram marcados hoje. Embaixo, quantas limpezas de cada tipo tem no dia: S é simples, M é média, C é completa e L é lavagem.",
    },
    {
      id: "ambiente",
      icon: "marcar",
      target: "ambiente",
      title: "Limpou? Toque no círculo",
      body: "Cada linha é um ambiente, com o tipo de limpeza de hoje embaixo do nome. Terminou de limpar, toque no círculo com o visto: o ambiente vai para Feitos, com o horário. Tocou errado? Use Desfazer.",
    },
    {
      id: "nao-deu",
      icon: "nao-deu",
      target: "nao-deu",
      optional: true,
      title: "Não deu para limpar?",
      body: "Toque em Não deu e escolha o motivo: sala ocupada, em reunião, falta de material ou outro. Facilities vê o motivo na conferência.",
    },
    {
      id: "avisar",
      icon: "aviso",
      target: "avisar",
      title: "Viu algum problema?",
      body: "Lâmpada queimada, vazamento, algo quebrado ou faltando: toque em Avisar problema, escolha o lugar e, se quiser, tire uma foto. O aviso chega para Facilities.",
    },
    {
      id: "encerrar",
      icon: "encerrar",
      target: "encerrar",
      title: "No fim do dia, encerre",
      body: "Quando terminar, toque em Encerrar o dia. Antes de enviar, aparece o resumo: limpos, não deu e sem marcar. Se precisar, dá para desfazer o encerramento até Facilities assinar.",
    },
    {
      id: "ver-guia",
      icon: "guia",
      target: "ver-guia",
      title: canManage ? "Você confere e assina no Acompanhamento" : "Depois, Facilities confere",
      body: canManage
        ? "Depois do encerramento, o dia aparece para conferir no Acompanhamento. Para rever estas dicas, toque em Ver guia."
        : "Facilities confere e assina o dia. Depois de assinado, a lista fica fechada. Quer rever estas dicas? Toque em Ver guia, aqui em cima.",
    },
  ];
}

function acompanhamentoSteps({ isAdmin }: CleaningGuideContext): CleaningGuideStep[] {
  return [
    {
      id: "topo",
      icon: "boas-vindas",
      target: "topo",
      title: "A limpeza do escritório, todo dia",
      body: "Aqui você vê quem está na limpeza, quantos ambientes já foram marcados hoje e a que horas começou e encerrou. As setas ao lado do mês mostram os meses anteriores.",
    },
    {
      id: "hoje",
      icon: "assinar",
      target: "botoes-hoje",
      optional: true,
      title: "O dia de hoje",
      body: "Quando a equipe encerrar o dia, este botão vira Conferir e assinar hoje. Lista que ela vê abre a mesma tela do celular da equipe.",
    },
    {
      id: "numeros",
      icon: "numeros",
      target: "numeros",
      title: "Os números do mês",
      body: "Ambientes limpos, dias conferidos e assinados, vezes que não deu para limpar (com o motivo mais comum) e avisos em aberto, com o horário médio de início e de encerramento.",
    },
    {
      id: "para-conferir",
      icon: "calendario",
      target: "para-conferir",
      optional: true,
      title: "Dias para conferir",
      body: "Ficam aqui os dias encerrados esperando a sua assinatura e os que passaram sem encerrar. Toque num deles para abrir.",
    },
    {
      id: "semana",
      icon: "calendario",
      target: "semana",
      title: "Semana a semana",
      body: "Cada célula tem a letra prevista no cronograma e o que aconteceu: visto verde com o horário, X quando não deu e tracejado quando ninguém marcou. Passe o mouse para ver o motivo. Toque na data, no topo da coluna, para abrir o dia.",
    },
    {
      id: "assinar",
      icon: "assinar",
      target: null,
      title: "Conferir e assinar o dia",
      body: "No dia aberto você vê o que foi limpo e o que não deu, escolhe Tudo certo ou Com ressalvas, escreve a anotação e assina. O dia de hoje só pode ser assinado depois que a equipe encerrar. Ali também dá para reabrir um dia assinado ou marcar o dia como sem limpeza, com o motivo.",
    },
    {
      id: "anotacoes",
      icon: "anotacao",
      target: "anotacoes-semana",
      title: "Anotações da semana",
      body: "Combinados e pontos de atenção da semana ficam guardados aqui, com quem salvou e quando.",
    },
    {
      id: "avisos",
      icon: "aviso",
      target: "avisos",
      title: "Avisos da limpeza",
      body: "Os problemas que a equipe avisou, com a foto. Marque como Resolvido ou toque em Virar manutenção: ele vira uma manutenção corretiva no módulo de Manutenção.",
    },
    {
      id: "por-ambiente",
      icon: "ambientes",
      target: "por-ambiente",
      title: "Por ambiente e por tipo",
      body: "Os ambientes que mais ficaram para trás no mês aparecem primeiro. Embaixo, quantas limpezas de cada tipo foram feitas.",
    },
    {
      id: "equipe",
      icon: "equipe",
      target: null,
      title: "Cronograma e equipe",
      body: isAdmin
        ? "Na aba Cronograma você troca o tipo de limpeza de cada ambiente por dia e inclui ou tira ambientes. Para colocar outra pessoa na equipe da limpeza, libere Limpeza de hoje no cadastro dela em Usuários: ela entra direto na lista do dia."
        : "Na aba Cronograma você troca o tipo de limpeza de cada ambiente por dia e inclui ou tira ambientes. Para colocar outra pessoa na equipe da limpeza, peça ao administrador do ORQESTRAI para liberar Limpeza de hoje em Usuários.",
    },
    {
      id: "ver-guia",
      icon: "guia",
      target: "ver-guia",
      title: "Para rever este guia",
      body: "Toque em Ver guia sempre que quiser repassar estas dicas.",
    },
  ];
}

function cronogramaSteps(): CleaningGuideStep[] {
  return [
    {
      id: "semanas",
      icon: "calendario",
      target: "semanas",
      title: "As 4 semanas da planilha",
      body: "Escolha a semana para ver e editar. As semanas contam pelos dias úteis do mês: feriado e fim de semana não têm limpeza, e a 5ª semana repete a 1ª.",
    },
    {
      id: "celula",
      icon: "tipos",
      target: "celula",
      title: "Toque na letra para trocar o tipo",
      body: "Escolha simples, média, completa ou lavagem. A troca vale a partir de agora; os dias já marcados guardam o tipo que estava previsto.",
    },
    {
      id: "carga",
      icon: "carga",
      target: "carga",
      title: "A carga de cada dia",
      body: "A barrinha embaixo do dia mostra a mistura de tipos, e o rodapé conta as limpezas pesadas (completa e lavagem), para não juntar tudo no mesmo dia.",
    },
    {
      id: "organizar",
      icon: "organizar",
      target: "menu-ambiente",
      title: "Organizar os ambientes",
      body: "Pelos três pontinhos você sobe, desce, renomeia ou tira um ambiente da lista. O que sai da lista não aparece para a limpeza nem conta nos números, mas o histórico fica guardado.",
    },
    {
      id: "novo",
      icon: "novo",
      target: "novo-ambiente",
      title: "Novo ambiente",
      body: "Um ambiente novo entra com limpeza simples em todos os dias. Depois é só ajustar as letras.",
    },
    {
      id: "ver-guia",
      icon: "guia",
      target: "ver-guia",
      title: "Para rever este guia",
      body: "Toque em Ver guia sempre que quiser repassar estas dicas.",
    },
  ];
}

export function cleaningGuideSteps(guide: CleaningGuide, context: CleaningGuideContext): CleaningGuideStep[] {
  if (guide === "limpeza-hoje") return hojeSteps(context);
  if (guide === "limpeza-acompanhamento") return acompanhamentoSteps(context);
  return cronogramaSteps();
}
