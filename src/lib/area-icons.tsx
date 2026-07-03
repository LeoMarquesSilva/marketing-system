/**
 * Ícones específicos por área - usados em gráficos, tabelas e filtros
 */
import {
  Scale,
  Briefcase,
  Settings,
  RefreshCw,
  Megaphone,
  FileSignature,
  Crown,
  Zap,
  Folder,
  Monitor,
  Landmark,
  CircleDollarSign,
  Receipt,
  type LucideIcon,
} from "lucide-react";

export const AREA_ICONS: Record<string, LucideIcon> = {
  Cível: Scale,
  Trabalhista: Briefcase,
  "Operações Legais": Settings,
  Reestruturação: RefreshCw,
  Insolvência: Landmark,
  "Recuperação de Crédito": CircleDollarSign,
  Tributário: Receipt,
  Contratos: FileSignature,
  Marketing: Megaphone,
  "Societário e Contratos": FileSignature,
  Sócio: Crown,
  "Distressed Deals - Special Situations": Zap,
  Geral: Folder,
  "T.I": Monitor,
};

/** Fundo do ícone por área (SIOE + departamentos internos). */
export const AREA_ICON_STYLES: Record<string, string> = {
  Cível: "bg-violet-100 text-violet-700 ring-violet-200/60",
  Trabalhista: "bg-amber-100 text-amber-700 ring-amber-200/60",
  Insolvência: "bg-rose-100 text-rose-700 ring-rose-200/60",
  "Recuperação de Crédito": "bg-orange-100 text-orange-700 ring-orange-200/60",
  Tributário: "bg-teal-100 text-teal-700 ring-teal-200/60",
  Contratos: "bg-sky-100 text-sky-700 ring-sky-200/60",
  "Operações Legais": "bg-emerald-100 text-emerald-700 ring-emerald-200/60",
  Reestruturação: "bg-rose-100 text-rose-700 ring-rose-200/60",
  Marketing: "bg-pink-100 text-pink-700 ring-pink-200/60",
  "Societário e Contratos": "bg-sky-100 text-sky-700 ring-sky-200/60",
  Sócio: "bg-yellow-100 text-yellow-800 ring-yellow-200/60",
  "Distressed Deals - Special Situations": "bg-orange-100 text-orange-700 ring-orange-200/60",
  Geral: "bg-slate-100 text-slate-700 ring-slate-200/60",
  "T.I": "bg-indigo-100 text-indigo-700 ring-indigo-200/60",
  "Cível | Insolvência": "bg-violet-100 text-violet-700 ring-violet-200/60",
};

const DEFAULT_AREA_ICON_STYLE = "bg-muted text-muted-foreground ring-border/60";

export function resolveAreaIconKey(area: string): string {
  if (!area) return "";
  if (AREA_ICONS[area]) return area;
  const first = area.split("|")[0]?.trim();
  if (first && AREA_ICONS[first]) return first;
  return area;
}

export function getAreaIcon(area: string): LucideIcon {
  if (!area) return Folder;
  return AREA_ICONS[area] ?? AREA_ICONS[resolveAreaIconKey(area)] ?? Folder;
}

export function getAreaIconStyle(area: string): string {
  if (!area) return DEFAULT_AREA_ICON_STYLE;
  return AREA_ICON_STYLES[area] ?? AREA_ICON_STYLES[resolveAreaIconKey(area)] ?? DEFAULT_AREA_ICON_STYLE;
}
