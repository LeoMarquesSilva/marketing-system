"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Publication, TaskType } from "@/lib/operacoes-legais/vistagem/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PrazoForm({
  publication,
  taskTypes,
}: {
  publication: Publication;
  taskTypes: TaskType[];
}) {
  const router = useRouter();
  const [tipoId, setTipoId] = useState(publication.tipo_agendamento_id || "");
  const [data, setData] = useState(publication.data_conclusao || "");
  const [fatal, setFatal] = useState(publication.data_fatal || "");
  const [hora, setHora] = useState(publication.hora_inicio?.slice(0, 5) || "");
  const [prio, setPrio] = useState(publication.prioridade_agendamento);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const selected = taskTypes.find((t) => t.id === tipoId);

  async function save(toSchedule: boolean) {
    if (selected?.kind === "skip") {
      setMsg("Tipo marcado como NÃO AGENDAR — use status SKIP");
    }
    setSaving(true);
    const res = await fetch(`/api/operacoes-legais/publications/${publication.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tipo_agendamento_id: tipoId || null,
        tipo_agendamento_label: selected?.label_vios || null,
        data_conclusao: data || null,
        data_limite: data || null,
        data_fatal: fatal || null,
        hora_inicio: hora || null,
        prioridade_agendamento: prio,
        status: selected?.kind === "skip" ? "SKIP" : toSchedule ? "AGENDAR" : "PRAZO_PENDENTE",
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      setMsg(json.error || "Erro");
      return;
    }
    setMsg(toSchedule ? "Enfileirado para agendamento" : "Salvo");
    router.refresh();
  }

  return (
    <div className="space-y-4 rounded-lg border border-border/80 bg-card p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-foreground">Definição de prazo / compromisso</h3>
      <p className="text-xs text-muted-foreground">
        Conclusão = limite (sempre). Trabalhista: Ops Legais; demais áreas: Controladoria.
      </p>
      <div className="space-y-2">
        <Label>Tipo VIOS</Label>
        <Select value={tipoId || "__none__"} onValueChange={(value) => setTipoId(value === "__none__" ? "" : value)}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione…" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Selecione…</SelectItem>
            {taskTypes.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.label_vios}
                {t.kind === "skip" ? " (NÃO AGENDAR)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="data-conclusao">Data conclusão (= limite)</Label>
        <Input id="data-conclusao" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="data-fatal">FATAL (se houver)</Label>
        <Input id="data-fatal" type="date" value={fatal} onChange={(e) => setFatal(e.target.value)} />
      </div>
      {(selected?.requires_hora || /AUD|PER/i.test(selected?.label_vios || "")) && (
        <div className="space-y-2">
          <Label htmlFor="hora-inicio">Hora início</Label>
          <Input id="hora-inicio" type="time" value={hora} onChange={(e) => setHora(e.target.value)} />
        </div>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[#347796]"
          checked={prio}
          onChange={(e) => setPrio(e.target.checked)}
        />
        Prioridade de agendamento
      </label>
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={saving} onClick={() => save(false)}>
          Salvar
        </Button>
        <Button type="button" disabled={saving || !tipoId || !data} onClick={() => save(true)}>
          Marcar AGENDAR
        </Button>
      </div>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
    </div>
  );
}
