"use client";

import { useState } from "react";
import { LoaderCircle, MessageSquareWarning, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { InconsistenciaResumo } from "@/lib/vistagem/types";
import { formatarDataHora } from "./publicacao-ui";

/** Cartão de uma inconsistência, com contestar (jurídico) ou excluir (controladoria). */
export function CartaoInconsistencia({
  inconsistencia,
  acao,
  onAlterada,
}: {
  inconsistencia: InconsistenciaResumo;
  acao: "contestar" | "excluir" | null;
  onAlterada?: () => void;
}) {
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const excluida = Boolean(inconsistencia.excluidaEm);

  async function salvar() {
    if (!acao) return;
    setOcupado(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/inconsistencias/${inconsistencia.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ acao, texto }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao salvar.");
      setAberto(false);
      setTexto("");
      onAlterada?.();
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao salvar.");
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div
      className={cn(
        "space-y-2 rounded-md border px-3 py-2 text-sm",
        excluida ? "border-slate-200 bg-slate-50 text-slate-500" : "border-amber-200 bg-amber-50 text-amber-900"
      )}
    >
      <p className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">
          {inconsistencia.origem === "juridico" ? "Inconsistência do jurídico" : "Inconsistência de agendamento"}: {inconsistencia.tipo}
          {inconsistencia.subtipo ? ` · ${inconsistencia.subtipo}` : ""}
        </span>
        <span className="text-xs opacity-80">
          {inconsistencia.criadoPor ? `${inconsistencia.criadoPor} · ` : ""}
          {formatarDataHora(inconsistencia.criadoEm)}
        </span>
        {excluida ? <span className="rounded-full border border-slate-300 px-2 text-xs">Excluída</span> : null}
      </p>
      <p className="whitespace-pre-wrap">{inconsistencia.descricao}</p>
      {inconsistencia.contestacao ? (
        <p className="whitespace-pre-wrap rounded bg-white/70 px-2 py-1 text-slate-700">
          <span className="font-medium">Contestação{inconsistencia.contestadoPor ? ` de ${inconsistencia.contestadoPor}` : ""}: </span>
          {inconsistencia.contestacao}
        </p>
      ) : null}
      {excluida ? (
        <p className="text-xs">
          Excluída{inconsistencia.excluidaPor ? ` por ${inconsistencia.excluidaPor}` : ""} em {formatarDataHora(inconsistencia.excluidaEm)}: {inconsistencia.motivoExclusao}
        </p>
      ) : null}

      {!excluida && acao && !(acao === "contestar" && inconsistencia.contestacao) ? (
        aberto ? (
          <div className="space-y-2">
            <Textarea
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              rows={2}
              maxLength={2000}
              autoFocus
              aria-label={acao === "contestar" ? "Por que a devolução não procede" : "Motivo da exclusão"}
              placeholder={acao === "contestar" ? "Por que a devolução não procede?" : "Motivo da exclusão"}
              className="bg-white"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={salvar} disabled={ocupado || !texto.trim()}>
                {ocupado ? <LoaderCircle className="animate-spin" /> : acao === "contestar" ? <MessageSquareWarning /> : <Trash2 />}
                {acao === "contestar" ? "Enviar contestação" : "Excluir inconsistência"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAberto(false)} disabled={ocupado}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <Button size="xs" variant="outline" onClick={() => setAberto(true)}>
            {acao === "contestar" ? <MessageSquareWarning /> : <Trash2 />}
            {acao === "contestar" ? "Contestar devolução" : "Excluir inconsistência"}
          </Button>
        )
      ) : null}
      {erro ? <p className="text-xs text-red-700">{erro}</p> : null}
    </div>
  );
}
