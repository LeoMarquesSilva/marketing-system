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
  type LucideIcon,
} from "lucide-react";

export const AREA_ICONS: Record<string, LucideIcon> = {
  Cível: Scale,
  Trabalhista: Briefcase,
  "Operações Legais": Settings,
  Reestruturação: RefreshCw,
  Marketing: Megaphone,
  "Societário e Contratos": FileSignature,
  Sócio: Crown,
  "Distressed Deals - Special Situations": Zap,
  Geral: Folder,
  "T.I": Monitor,
};

export function getAreaIcon(area: string): LucideIcon {
  if (!area) return Folder;
  return AREA_ICONS[area] ?? Folder;
}
