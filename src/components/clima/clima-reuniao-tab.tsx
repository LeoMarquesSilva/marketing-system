"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Plus, Play, Pause, RotateCcw } from "lucide-react";
import type { Indicator, ActionPlan } from "@/lib/clima-types";
import type { ClimaTodo } from "@/lib/clima-types";

interface ClimaReuniaoTabProps {
  indicadores: Indicator[];
  planosAcao: ActionPlan[];
  onAddTodo?: (todo: Omit<ClimaTodo, "id" | "createdAt">) => void;
}

function formatTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((n) => n.toString().padStart(2, "0")).join(":");
}

export function ClimaReuniaoTab({
  indicadores,
  planosAcao,
  onAddTodo,
}: ClimaReuniaoTabProps) {
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [agenda, setAgenda] = useState("");
  const [ata, setAta] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<Set<string>>(new Set());
  const [quickTodo, setQuickTodo] = useState("");

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [running]);

  const toggleTopic = (id: string) => {
    setSelectedTopics((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const addQuickTodo = useCallback(() => {
    if (!quickTodo.trim()) return;
    onAddTodo?.({
      title: quickTodo.trim(),
      status: "pendente",
      priority: "normal",
    });
    setQuickTodo("");
  }, [quickTodo, onAddTodo]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Modo Reunião</h2>
        <p className="text-sm text-muted-foreground">
          Timer, pauta, temas do dia e criação de to-dos em tempo real
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Timer */}
        <Card className="rounded-xl">
          <CardHeader>
            <span className="text-base font-semibold">Timer</span>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center">
              <p className="text-4xl font-mono font-bold tabular-nums text-foreground">
                {formatTime(seconds)}
              </p>
            </div>
            <div className="flex justify-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setSeconds(0)}
                title="Zerar"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button
                variant={running ? "destructive" : "default"}
                size="icon"
                onClick={() => setRunning(!running)}
                title={running ? "Pausar" : "Iniciar"}
              >
                {running ? (
                  <Pause className="h-4 w-4" />
                ) : (
                  <Play className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Pauta */}
        <Card className="rounded-xl">
          <CardHeader>
            <span className="text-base font-semibold">Pauta</span>
          </CardHeader>
          <CardContent>
            <textarea
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              placeholder="Itens da pauta da reunião..."
              rows={5}
              className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </CardContent>
        </Card>
      </div>

      {/* Temas do dia */}
      <Card className="rounded-xl">
        <CardHeader>
          <span className="text-base font-semibold">Temas do dia</span>
          <p className="text-sm text-muted-foreground">
            Selecione indicadores ou planos para discutir
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-xs text-muted-foreground">Indicadores</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {indicadores.map((ind) => (
                <button
                  key={ind.id}
                  type="button"
                  onClick={() => toggleTopic(`ind-${ind.id}`)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                    selectedTopics.has(`ind-${ind.id}`)
                      ? "border-[#101f2e] bg-[#101f2e] text-white"
                      : "border-muted hover:bg-muted/50"
                  }`}
                >
                  {ind.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground">Planos de ação</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {planosAcao.slice(0, 6).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => toggleTopic(`plan-${p.id}`)}
                  className={`rounded-lg border px-3 py-1.5 text-sm transition-colors line-clamp-1 max-w-[200px] ${
                    selectedTopics.has(`plan-${p.id}`)
                      ? "border-[#101f2e] bg-[#101f2e] text-white"
                      : "border-muted hover:bg-muted/50"
                  }`}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Criar to-do rápido */}
      <Card className="rounded-xl">
        <CardHeader>
          <span className="text-base font-semibold">Criar to-do durante a reunião</span>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <input
              type="text"
              value={quickTodo}
              onChange={(e) => setQuickTodo(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addQuickTodo()}
              placeholder="Ex: Agendar palestra de saúde mental"
              className="flex-1 rounded-lg border bg-background px-3 py-2 text-sm"
            />
            <Button onClick={addQuickTodo} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
          {onAddTodo && (
            <p className="text-xs text-muted-foreground mt-2">
              O to-do será adicionado à aba To-Dos
            </p>
          )}
        </CardContent>
      </Card>

      {/* Ata */}
      <Card className="rounded-xl">
        <CardHeader>
          <span className="text-base font-semibold">Ata da reunião</span>
        </CardHeader>
        <CardContent>
          <textarea
            value={ata}
            onChange={(e) => setAta(e.target.value)}
            placeholder="Registro da reunião..."
            rows={6}
            className="w-full resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </CardContent>
      </Card>
    </div>
  );
}
