/**
 * Sistemas do escritório que ficam fora do ORQESTRAI e aparecem como atalhos
 * na tela inicial (favoritos). VIOS, Responsum, Feedz, Intranet e Legis não
 * estão aqui: já vêm de "Meus links", mantidos por Pessoas e Cultura.
 *
 * Endereços conferidos em 11/11/2026 (o usuário passou o do cadastro de leads;
 * os demais são os endereços publicados de cada projeto).
 */
export interface OfficeSystem {
  id: string;
  title: string;
  description: string;
  url: string;
  /** Logo em /public, quando existe; sem ele a tela usa o ícone do tipo. */
  logo?: string;
  icon: "metas" | "crm" | "leads" | "ia" | "projetos";
}

export const OFFICE_SYSTEMS: OfficeSystem[] = [
  {
    id: "sama",
    title: "SAMA",
    description: "Acompanhamento de metas e atividades",
    url: "https://sama-bay-delta.vercel.app",
    logo: "/inicio/sistemas/sama.png",
    icon: "metas",
  },
  {
    id: "rd-crm",
    title: "RD CRM",
    description: "Funil comercial e negociações",
    url: "https://crm.rdstation.com",
    // Ícone oficial do RD Station (favicon de rdstation.com).
    logo: "/inicio/sistemas/rd-station.png",
    icon: "crm",
  },
  {
    id: "cadastro-leads",
    title: "Cadastro de leads",
    description: "Registro de novos leads e acompanhamento do SLA",
    url: "https://crm-bp.vercel.app/sla",
    logo: "/inicio/sistemas/cadastro-leads.png",
    icon: "leads",
  },
  {
    id: "fenix-ia",
    title: "Fênix I.A - Banco de Teses",
    description: "Banco de teses jurídicas com IA",
    url: "https://fenix-ia.vercel.app",
    // Símbolo da identidade própria da Fênix I.A (do projeto fenix-ia), não a fênix do escritório.
    logo: "/inicio/sistemas/fenix-ia.png",
    icon: "ia",
  },
  {
    id: "forjai",
    title: "FORJAI",
    description: "Projetos e tarefas das melhorias do escritório",
    url: "https://forjai.vercel.app",
    logo: "/inicio/sistemas/forjai.png",
    icon: "projetos",
  },
];
