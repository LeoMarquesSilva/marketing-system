/**
 * Ícones específicos por tipo de solicitação
 */
import {
  Megaphone,
  Presentation,
  Share2,
  Palette,
  Award,
  BookOpen,
  Image,
  Mail,
  Printer,
  FileBarChart,
  Monitor,
  FileText,
  type LucideIcon,
} from "lucide-react";

export const TYPE_ICONS: Record<string, LucideIcon> = {
  Comunicado: Megaphone,
  PPT: Presentation,
  "Post Redes Sociais": Share2,
  "Aplicação de Identidade": Palette,
  Certificados: Award,
  "E-book": BookOpen,
  "Identidade Visual": Image,
  Newsletter: Mail,
  "Material Impresso": Printer,
  Relatório: FileBarChart,
  Apresentação: Monitor,
};

export function getTypeIcon(type: string): LucideIcon {
  return TYPE_ICONS[type] ?? FileText;
}

/**
 * Cores por tipo de solicitação (badges elegantes, cores suaves)
 * Estilo premium: fundo com opacity baixa, texto não saturado
 */
export const TYPE_COLORS: Record<string, string> = {
  Comunicado: "bg-[#101f2e]/10 text-[#101f2e] dark:bg-[#101f2e]/30 dark:text-[#a8c5e0]",
  PPT: "bg-purple-100/90 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300",
  "Post Redes Sociais": "bg-emerald-100/90 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  "Aplicação de Identidade": "bg-pink-100/90 text-pink-700 dark:bg-pink-950/50 dark:text-pink-300",
  Certificados: "bg-amber-100/90 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  "E-book": "bg-indigo-100/90 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300",
  "Identidade Visual": "bg-rose-100/90 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
  Newsletter: "bg-cyan-100/90 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300",
  "Material Impresso": "bg-orange-100/90 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
  Relatório: "bg-slate-100/90 text-slate-700 dark:bg-slate-950/50 dark:text-slate-300",
  Apresentação: "bg-teal-100/90 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
};

export function getTypeColor(type: string): string {
  return TYPE_COLORS[type] ?? "bg-slate-100/90 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400";
}
