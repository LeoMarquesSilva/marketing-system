"use client";

import { useEffect, useState } from "react";
import { Eye, Heart, ImageIcon, TrendingUp, Users } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { AreaWithIcon } from "@/components/solicitacoes/area-with-icon";
import { getAreaIcon } from "@/lib/area-icons";
import type { AreaInsight } from "@/lib/instagram-analytics";
import { cn } from "@/lib/utils";

interface InstagramAreaDashboardProps {
  areas: AreaInsight[];
}

function formatNumber(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString("pt-BR");
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground mb-0.5">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
    </div>
  );
}

function AreaPanel({ area }: { area: AreaInsight }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-white/90 via-white/70 to-white/50 backdrop-blur-xl shadow-[0_2px_16px_-4px_rgba(0,0,0,0.08)] overflow-hidden">
      <div className="px-5 pt-5 pb-4 border-b border-border/40">
        <AreaWithIcon area={area.area} className="text-base font-semibold" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4">
          <Metric icon={<ImageIcon className="h-3 w-3" />} label="Posts" value={String(area.posts)} />
          <Metric icon={<Eye className="h-3 w-3" />} label="Alcance" value={formatNumber(area.reach)} />
          <Metric icon={<Users className="h-3 w-3" />} label="Views" value={formatNumber(area.views)} />
          <Metric
            icon={<TrendingUp className="h-3 w-3" />}
            label="Interações"
            value={formatNumber(area.interactions)}
          />
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Média de {formatNumber(Math.round(area.avgInteractions))} interações por post
          {" · "}
          {formatNumber(area.likes)} curtidas
        </p>
      </div>

      <div className="px-5 py-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
          Colaboradores da área
        </h4>
        {area.collaborators.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado.</p>
        ) : (
          <div className="space-y-2">
            {area.collaborators.map((collab) => (
              <div
                key={collab.userId}
                className="flex items-center gap-3 rounded-xl border border-border/40 bg-white/60 px-3 py-2.5"
              >
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={collab.avatar_url || undefined} />
                  <AvatarFallback className="text-[10px]">
                    {getInitials(collab.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{collab.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {collab.posts} post{collab.posts !== 1 ? "s" : ""} ·{" "}
                    {formatNumber(collab.interactions)} interações ·{" "}
                    {formatNumber(collab.reach)} alcance
                  </p>
                </div>
                {collab.posts > 0 && (
                  <div className="shrink-0 flex items-center gap-1 text-emerald-600">
                    <Heart className="h-3.5 w-3.5" />
                    <span className="text-xs font-semibold tabular-nums">
                      {formatNumber(collab.interactions)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function InstagramAreaDashboard({ areas }: InstagramAreaDashboardProps) {
  const [activeArea, setActiveArea] = useState(areas[0]?.area ?? "");

  useEffect(() => {
    if (areas.length === 0) return;
    if (!areas.some((a) => a.area === activeArea)) {
      setActiveArea(areas[0].area);
    }
  }, [areas, activeArea]);

  if (areas.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/60 bg-white/50 p-8 text-center">
        <p className="text-sm text-muted-foreground">
          Atribua áreas às postagens para ver o dashboard por área e colaboradores.
        </p>
      </div>
    );
  }

  const selected =
    areas.find((a) => a.area === activeArea) ?? areas[0];

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-base font-semibold">Dashboard por área</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Selecione uma área para ver insights e colaboradores.
        </p>
      </div>

      <div className="overflow-x-auto -mx-1 px-1 pb-1">
        <div className="flex gap-2 min-w-max border-b border-border/60 pb-3">
          {areas.map((area) => {
            const Icon = getAreaIcon(area.area);
            const isActive = selected.area === area.area;

            return (
              <Button
                key={area.area}
                variant={isActive ? "default" : "ghost"}
                size="sm"
                onClick={() => setActiveArea(area.area)}
                className={cn(
                  "gap-2 rounded-xl shrink-0 h-9",
                  isActive && "bg-[#101f2e] hover:bg-[#101f2e]/90"
                )}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                <span className="max-w-[140px] truncate">{area.area}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums leading-none",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {area.posts}
                </span>
              </Button>
            );
          })}
        </div>
      </div>

      <AreaPanel area={selected} />
    </div>
  );
}
