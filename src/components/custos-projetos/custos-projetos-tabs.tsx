"use client";

import { Cloud, Code2, Workflow } from "lucide-react";
import { cn } from "@/lib/utils";

export type CustosTabId = "supabase" | "cursor" | "n8n";

const TABS: {
  id: CustosTabId;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
}[] = [
  {
    id: "supabase",
    label: "Supabase",
    icon: <Cloud className="h-4 w-4" />,
    activeClass: "text-[#3ecf8e]",
  },
  {
    id: "cursor",
    label: "Cursor",
    icon: <Code2 className="h-4 w-4" />,
    activeClass: "text-slate-900 dark:text-slate-100",
  },
  {
    id: "n8n",
    label: "N8N",
    icon: <Workflow className="h-4 w-4" />,
    activeClass: "text-orange-600 dark:text-orange-400",
  },
];

interface CustosProjetosTabsProps {
  active: CustosTabId;
  onChange: (tab: CustosTabId) => void;
  counts?: Partial<Record<CustosTabId, number>>;
}

export function CustosProjetosTabs({ active, onChange, counts }: CustosProjetosTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Categorias de custos"
      className="flex flex-wrap gap-1 p-1 rounded-lg bg-muted/50 border w-full sm:w-fit"
    >
      {TABS.map((tab) => {
        const count = counts?.[tab.id];
        const selected = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`custos-panel-${tab.id}`}
            id={`custos-tab-${tab.id}`}
            onClick={() => onChange(tab.id)}
            className={cn(
              "flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-all",
              selected
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            )}
          >
            <span className={cn(selected && tab.activeClass)}>{tab.icon}</span>
            {tab.label}
            {count != null && count > 0 && (
              <span
                className={cn(
                  "flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold",
                  selected
                    ? "bg-muted text-foreground"
                    : "bg-muted/80 text-muted-foreground"
                )}
              >
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
