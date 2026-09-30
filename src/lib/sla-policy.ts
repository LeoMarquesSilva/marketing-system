/**
 * SLA proposto por tipo de solicitação (prazos em dias úteis a partir do pedido
 * completo). Definido a partir dos dados de mar–set/2026: tempo em que 80% das
 * peças saíram, no pior caso entre semana normal e semana cheia, arredondado e
 * agrupado em faixas. O dashboard mede quanto cada prazo é cumprido ao vivo.
 */

import type { SlaPolicy } from "@/lib/sla-metrics";

export interface SlaTier {
  days: number;
  label: string;
  policies: SlaPolicy[];
}

export const SLA_TIERS: SlaTier[] = [
  {
    days: 1,
    label: "rápidas",
    policies: [
      { type: "Comunicado", firstVersionDays: 1, adjustmentDays: 0 },
      { type: "Newsletter", firstVersionDays: 1, adjustmentDays: 1 },
    ],
  },
  {
    days: 2,
    label: "padrão",
    policies: [
      { type: "Post Redes Sociais", firstVersionDays: 2, adjustmentDays: 1, note: "Data de publicação combinada à parte." },
      { type: "Certificados", firstVersionDays: 2, adjustmentDays: 1, note: "Conta a partir da lista final de nomes." },
      { type: "Onboarding", firstVersionDays: 2, adjustmentDays: 1, note: "Criado pelo fluxo de novo colaborador." },
      { type: "Relatório", firstVersionDays: 2, adjustmentDays: 1 },
      { type: "Apresentação", firstVersionDays: 2, adjustmentDays: 1, note: "Se for um deck completo, tratar como PPT." },
    ],
  },
  {
    days: 3,
    label: "padrão com mais etapas",
    policies: [{ type: "Aplicação de Identidade", firstVersionDays: 3, adjustmentDays: 1 }],
  },
  {
    days: 5,
    label: "complexas",
    policies: [
      { type: "PPT", firstVersionDays: 5, adjustmentDays: 4, note: "Na semana cheia a fila faz o prazo dobrar." },
      { type: "Material Impresso", firstVersionDays: 5, adjustmentDays: 4, note: "Prazo da arte; gráfica e entrega à parte." },
    ],
  },
  {
    days: 10,
    label: "projetos",
    policies: [
      { type: "Identidade Visual", firstVersionDays: 10, adjustmentDays: 2, note: "Acima de um dia de trabalho, combinar cronograma próprio." },
      { type: "E-book", firstVersionDays: 10, adjustmentDays: 4, note: "Projeto; prazo por julgamento, poucas peças medidas." },
    ],
  },
];

export const SLA_POLICIES: SlaPolicy[] = SLA_TIERS.flatMap((tier) => tier.policies);

/** Condições para o SLA valer, exibidas junto com a tabela. */
export const SLA_CONDITIONS = [
  { title: "O prazo começa no pedido completo", text: "Briefing, textos, imagens e, nos certificados, a lista final de nomes." },
  { title: "O SLA é da 1ª versão", text: "Cada rodada de ajuste tem prazo próprio, contado a partir do retorno do solicitante." },
  { title: "Semana cheia pede prioridade", text: "Quando a semana passa do limite de semana cheia, o gestor define a ordem dos pedidos." },
  { title: "Urgência tem aval", text: "Pedido fora do SLA entra só com aprovação do gestor, sabendo que empurra a fila." },
];
