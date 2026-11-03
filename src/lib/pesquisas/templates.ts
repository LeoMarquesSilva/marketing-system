/**
 * Modelos para começar uma pesquisa. O de planejamento estratégico nasceu para
 * o PE27: é ponto de partida, os embaixadores trocam as perguntas na tela.
 */

import { blankQuestion, newId, type QuestionType, type SurveyQuestion } from "./types";

export const SURVEY_TEMPLATES = ["em_branco", "planejamento"] as const;
export type SurveyTemplate = (typeof SURVEY_TEMPLATES)[number];

export const SURVEY_TEMPLATE_LABELS: Record<SurveyTemplate, { title: string; description: string }> = {
  em_branco: { title: "Em branco", description: "Você escreve todas as perguntas." },
  planejamento: {
    title: "Escuta para o planejamento",
    description: "9 perguntas sugeridas:balanço do ano, como trabalhamos e prioridades do próximo.",
  },
};

function question(type: QuestionType, title: string, extra: Partial<SurveyQuestion> = {}): SurveyQuestion {
  return { ...blankQuestion(type), title, ...extra };
}

function options(labels: string[]) {
  return labels.map((label) => ({ id: newId(), label }));
}

export function templateQuestions(template: SurveyTemplate): SurveyQuestion[] {
  if (template === "em_branco") return [];
  return [
    question("secao", "Olhando para 2026", { help: "Um balanço rápido do ano da equipe." }),
    question("escala", "De 1 a 5, como foi 2026 para a nossa equipe?", {
      required: true,
      scale_min_label: "Muito difícil",
      scale_max_label: "Excelente",
    }),
    question("texto_longo", "Do que você mais se orgulha no que a equipe entregou em 2026?", {
      help: "Pode ser um projeto, uma melhoria, um resultado ou um jeito de trabalhar.",
    }),
    question("texto_longo", "O que mais travou ou atrapalhou o seu trabalho este ano?"),
    question("secao", "Como trabalhamos", { help: "Processos, ferramentas e a relação com as outras áreas." }),
    question("multipla", "Onde você mais perde tempo hoje?", {
      help: "Escolha até 3.",
      max_choices: 3,
      allow_other: true,
      options: options([
        "Retrabalho e correções",
        "Tarefas manuais e repetitivas",
        "Falta de informação ou de padrão",
        "Ferramentas e sistemas",
        "Comunicação com as áreas jurídicas",
        "Aprovações e prazos curtos",
      ]),
    }),
    question("texto_longo", "Começar, parar, continuar: o que a equipe deveria começar a fazer, parar de fazer e continuar fazendo?"),
    question("secao", "Para 2027", { help: "O que você quer que os embaixadores levem ao Planejamento Estratégico." }),
    question("ranking", "Ordene as prioridades da equipe para 2027", {
      help: "A primeira é a mais importante.",
      options: options([
        "Automação e tecnologia (ORQESTRAI, VIOS e IA)",
        "Padronização de processos e indicadores",
        "Atendimento às áreas jurídicas",
        "Controle financeiro e de custos",
        "Estrutura e Facilities do escritório",
        "Treinamento e desenvolvimento da equipe",
        "Comunicação interna",
      ]),
    }),
    question("texto_longo", "Se uma única coisa mudasse em 2027, qual faria mais diferença no seu dia a dia?", { required: true }),
    question("texto_longo", "Que capacitação ou apoio você precisa para crescer em 2027?"),
    question("texto_longo", "Quer deixar mais algum recado para o Planejamento Estratégico?"),
  ];
}
