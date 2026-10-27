/**
 * Categorias do cadastro único de fornecedores (event_suppliers), usado por
 * Facilities > Fornecedores e contratos e pela Gestão de eventos.
 *
 * Os eventos continuam oferecendo só o grupo "eventos" nos orçamentos; os
 * rótulos valem para todas, porque um fornecedor de Facilities pode aparecer
 * num evento e vice-versa.
 */

import type { LucideIcon } from "lucide-react";
import {
  Armchair,
  Building2,
  Camera,
  Car,
  Coffee,
  Gift,
  HeartHandshake,
  Laptop,
  MonitorCog,
  Package,
  Paperclip,
  PartyPopper,
  Plug,
  Printer,
  ShieldCheck,
  Speaker,
  SprayCan,
  BriefcaseBusiness,
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
}

export const SUPPLIER_CATEGORY_DEFS: SupplierCategoryDef[] = [
  { key: "imovel", label: "Aluguel e condomínio", group: "facilities", icon: Building2 },
  { key: "consumo", label: "Água, energia e telefonia", group: "facilities", icon: Plug },
  { key: "tecnologia", label: "Sistemas e licenças", group: "facilities", icon: MonitorCog },
  { key: "informatica", label: "Informática e equipamentos", group: "facilities", icon: Laptop },
  { key: "limpeza", label: "Limpeza e conservação", group: "facilities", icon: SprayCan },
  { key: "manutencao", label: "Manutenção e obras", group: "facilities", icon: Wrench },
  { key: "copa", label: "Copa e insumos", group: "facilities", icon: Coffee },
  { key: "escritorio", label: "Material de escritório", group: "facilities", icon: Paperclip },
  { key: "mobiliario", label: "Móveis e eletrodomésticos", group: "facilities", icon: Armchair },
  { key: "beneficios", label: "Benefícios", group: "facilities", icon: HeartHandshake },
  { key: "servicos_profissionais", label: "Serviços profissionais", group: "facilities", icon: BriefcaseBusiness },
  { key: "grafica", label: "Gráfica e impressão", group: "facilities", icon: Printer },
  { key: "transporte", label: "Transporte e estacionamento", group: "facilities", icon: Car },
  { key: "seguranca", label: "Segurança", group: "facilities", icon: ShieldCheck },
  { key: "brindes", label: "Brindes", group: "eventos", icon: Gift },
  { key: "catering", label: "Catering", group: "eventos", icon: Coffee },
  { key: "buffet", label: "Buffet", group: "eventos", icon: UtensilsCrossed },
  { key: "decoracao", label: "Decoração", group: "eventos", icon: PartyPopper },
  { key: "fotografia", label: "Fotografia", group: "eventos", icon: Camera },
  { key: "som_iluminacao", label: "Som e iluminação", group: "eventos", icon: Speaker },
  { key: "locacao", label: "Locação", group: "eventos", icon: Tent },
  { key: "outros", label: "Outros", group: "eventos", icon: Package },
];

const BY_KEY = new Map(SUPPLIER_CATEGORY_DEFS.map((def) => [def.key, def]));

/** Rótulo de qualquer categoria do cadastro (chave desconhecida volta como veio). */
export const SUPPLIER_CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  SUPPLIER_CATEGORY_DEFS.map((def) => [def.key, def.label])
);

/** Transporte e segurança servem aos dois grupos. */
const SHARED_KEYS = new Set(["transporte", "seguranca"]);

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
