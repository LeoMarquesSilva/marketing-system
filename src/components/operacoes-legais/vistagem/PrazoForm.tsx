"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Publication, TaskType } from "@/lib/operacoes-legais/vistagem/types";

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
    <div className="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
      <h3 className="font-medium text-[#c9a227]">Definição de prazo / compromisso</h3>
      <p className="text-xs text-zinc-400">
        Conclusão = limite (sempre). Trabalhista: Ops Legais; demais áreas: Controladoria.
      </p>
      <label className="block text-sm">
        Tipo VIOS
        <select
          value={tipoId}
          onChange={(e) => setTipoId(e.target.value)}
          className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
        >
          <option value="">Selecione…</option>
          {taskTypes.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label_vios}
              {t.kind === "skip" ? " (NÃO AGENDAR)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        Data conclusão (= limite)
        <input
          type="date"
          value={data}
          onChange={(e) => setData(e.target.value)}
          className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        FATAL (se houver)
        <input
          type="date"
          value={fatal}
          onChange={(e) => setFatal(e.target.value)}
          className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
        />
      </label>
      {(selected?.requires_hora || /AUD|PER/i.test(selected?.label_vios || "")) && (
        <label className="block text-sm">
          Hora início
          <input
            type="time"
            value={hora}
            onChange={(e) => setHora(e.target.value)}
            className="mt-1 w-full rounded border border-white/20 bg-[#0b1c2c] px-3 py-2"
          />
        </label>
      )}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={prio} onChange={(e) => setPrio(e.target.checked)} />
        Prioridade de agendamento
      </label>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => save(false)}
          className="rounded-md border border-white/20 px-4 py-2 text-sm"
        >
          Salvar
        </button>
        <button
          type="button"
          disabled={saving || !tipoId || !data}
          onClick={() => save(true)}
          className="rounded-md bg-[#c9a227] px-4 py-2 text-sm font-medium text-[#0b1c2c] disabled:opacity-40"
        >
          Marcar AGENDAR
        </button>
      </div>
      {msg && <p className="text-sm text-zinc-300">{msg}</p>}
    </div>
  );
}
