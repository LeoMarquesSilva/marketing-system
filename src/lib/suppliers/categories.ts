/**
 * Classificações do cadastro único de terceiros (event_suppliers), usado por
 * Facilities > Gestão de Fornecedores e Prestadores de Serviços e pela Gestão
 * de eventos. Três eixos, como pediu o gestor de Facilities (10/11/2026):
 *
 * - Tipo de terceiro: fornecedor (produtos), prestador de serviços ou ambos.
 * - Categoria do terceiro: o que ele fornece ou qual serviço presta.
 * - Natureza da despesa (coluna category): onde o dinheiro é aplicado. A lista
 *   de Facilities é a do gestor; os fornecedores de evento mantêm a categoria
 *   de evento (buffet, brindes...), que os orçamentos dos eventos usam.
 */

import type { LucideIcon } from "lucide-react";
import {
  BriefcaseBusiness,
  Building2,
  Camera,
  Car,
  Coffee,
  Gift,
  HeartHandshake,
  Laptop,
  Lightbulb,
  MonitorCog,
  Package,
  PartyPopper,
  Plug,
  ShieldCheck,
  ShoppingBasket,
  Speaker,
  SprayCan,
  Tent,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

export type SupplierCategoryGroup = "facilities" | "eventos";

export interface SupplierCategoryDef {
  key: string;
  label: string;
  group: SupplierCategoryGroup;
  icon: LucideIcon;
  /** Exemplos da lista do gestor, para ajudar a escolher. */
  examples?: string;
}

/** Natureza da despesa (Facilities) e categorias de evento. */
export const SUPPLIER_CATEGORY_DEFS: SupplierCategoryDef[] = [
  { key: "servicos_profissionais", label: "Serviços profissionais", group: "facilities", icon: BriefcaseBusiness, examples: "Advocacia, consultoria, auditoria, contabilidade" },
  { key: "tecnologia", label: "Sistemas e licenças", group: "facilities", icon: MonitorCog, examples: "ERP, softwares, plataformas, licenças" },
  { key: "imovel", label: "Aluguel e condomínio", group: "facilities", icon: Building2, examples: "Locação, condomínio, IPTU" },
  { key: "consumo", label: "Água, energia e telefonia", group: "facilities", icon: Plug, examples: "Consumo e serviços públicos" },
  { key: "beneficios", label: "Benefícios", group: "facilities", icon: HeartHandshake, examples: "VR, VA, plano de saúde, TotalPass" },
  { key: "informatica", label: "Informática e equipamentos", group: "facilities", icon: Laptop, examples: "Computadores, notebooks, periféricos" },
  { key: "transporte", label: "Transporte e estacionamento", group: "facilities", icon: Car, examples: "Aplicativos, táxi, estacionamento" },
  { key: "copa", label: "Copa e insumos", group: "facilities", icon: Coffee, examples: "Café, água, alimentos e materiais" },
  { key: "limpeza", label: "Limpeza e conservação", group: "facilities", icon: SprayCan, examples: "Produtos e serviços de limpeza" },
  { key: "manutencao", label: "Manutenção e obras", group: "facilities", icon: Wrench, examples: "Elétrica, hidráulica, ar-condicionado, reformas" },
  { key: "outros", label: "Outros", group: "facilities", icon: Package, examples: "Despesas que não se encaixam nas anteriores" },
  { key: "brindes", label: "Brindes", group: "eventos", icon: Gift },
  { key: "catering", label: "Catering", group: "eventos", icon: Coffee },
  { key: "buffet", label: "Buffet", group: "eventos", icon: UtensilsCrossed },
  { key: "decoracao", label: "Decoração", group: "eventos", icon: PartyPopper },
  { key: "fotografia", label: "Fotografia", group: "eventos", icon: Camera },
  { key: "som_iluminacao", label: "Som e iluminação", group: "eventos", icon: Speaker },
  { key: "seguranca", label: "Segurança", group: "eventos", icon: ShieldCheck },
  { key: "locacao", label: "Locação", group: "eventos", icon: Tent },
];

const BY_KEY = new Map(SUPPLIER_CATEGORY_DEFS.map((def) => [def.key, def]));

/** Rótulo de qualquer categoria do cadastro (chave desconhecida volta como veio). */
export const SUPPLIER_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SUPPLIER_CATEGORY_DEFS.map((def) => [def.key, def.label])
);

/** Transporte e Outros servem aos dois grupos. */
const SHARED_KEYS = new Set(["transporte", "outros"]);

export function supplierCategoriesFor(group: SupplierCategoryGroup): SupplierCategoryDef[] {
  return SUPPLIER_CATEGORY_DEFS.filter((def) => def.group === group || SHARED_KEYS.has(def.key));
}

export function supplierCategoryLabel(key: string): string {
  return BY_KEY.get(key)?.label ?? key;
}

export function supplierCategoryIcon(key: string): LucideIcon {
  return BY_KEY.get(key)?.icon ?? Package;
}

export function isEventSupplierCategory(key: string): boolean {
  const def = BY_KEY.get(key);
  return !def || def.group === "eventos" || SHARED_KEYS.has(key);
}

/* ------------------------------------------------------------ tipo de terceiro */

export const PARTY_TYPES = ["fornecedor", "prestador", "ambos"] as const;
export type PartyType = (typeof PARTY_TYPES)[number];
export const PARTY_TYPE_LABEL: Record<PartyType, string> = {
  fornecedor: "Fornecedor",
  prestador: "Prestador de serviços",
  ambos: "Fornecedor e prestador",
};
export const PARTY_TYPE_SHORT: Record<PartyType, string> = {
  fornecedor: "Fornecedor",
  prestador: "Prestador",
  ambos: "Ambos",
};

/* ------------------------------------------------------- categoria do terceiro */

export interface ThirdPartyCategoryDef {
  key: string;
  label: string;
  icon: LucideIcon;
}

export const THIRD_PARTY_CATEGORY_DEFS: ThirdPartyCategoryDef[] = [
  { key: "tecnologia", label: "Tecnologia", icon: MonitorCog },
  { key: "consultoria", label: "Consultoria", icon: BriefcaseBusiness },
  { key: "facilities", label: "Facilities", icon: SprayCan },
  { key: "manutencao", label: "Manutenção", icon: Wrench },
  { key: "beneficios", label: "Benefícios", icon: HeartHandshake },
  { key: "suprimentos", label: "Suprimentos", icon: ShoppingBasket },
  { key: "imoveis", label: "Imóveis", icon: Building2 },
  { key: "utilidades", label: "Utilidades (água, luz e telefonia)", icon: Lightbulb },
  { key: "eventos", label: "Eventos", icon: PartyPopper },
  { key: "outros", label: "Outros", icon: Package },
];

const THIRD_BY_KEY = new Map(THIRD_PARTY_CATEGORY_DEFS.map((def) => [def.key, def]));

export function thirdPartyCategoryLabel(key: string | null): string {
  return key ? (THIRD_BY_KEY.get(key)?.label ?? key) : "Não informada";
}
