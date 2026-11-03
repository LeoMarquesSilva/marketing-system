"use client";

import { useState } from "react";
import { Ban, LoaderCircle, MessageSquareWarning, Trash2, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { InconsistenciaResumo } from "@/lib/vistagem/types";
import { formatarDataHora } from "./publicacao-ui";
import { Campo, Selo } from "./ui";

/**
 * Uma inconsistência registrada, com contestar (jurídico) ou excluir (controladoria).
 * É um bloco de aviso, não um card: cabe dentro de uma Secao do Painel sem empilhar superfícies.
 */
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
  const podeAgir = !excluida && acao !== null && !(acao === "contestar" && inconsistencia.contestacao);
  const IconeAcao = acao === "contestar" ? MessageSquareWarning : Trash2;
  const origem = inconsistencia.origem === "juridico" ? "Inconsistência do jurídico" : "Inconsistência de agendamento";

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
    <article
      aria-label={`${origem}: ${inconsistencia.tipo}`}
      className={cn(
        "rounded-md border px-3 py-2.5 text-sm",
        excluida ? "border-[#e6eef0] bg-[#f7fbfc]" : "border-amber-200 bg-amber-50/70"
      )}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        {excluida ? (
          <Ban className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
        ) : (
          <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-700" aria-hidden />
        )}
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={cn("font-semibold", excluida ? "text-muted-foreground" : "text-amber-900")}>
              {inconsistencia.tipo}
              {inconsistencia.subtipo ? ` · ${inconsistencia.subtipo}` : ""}
            </span>
            {excluida ? <Selo>Excluída</Selo> : inconsistencia.contestacao ? <Selo tom="alerta">Contestada</Selo> : null}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {origem}
            {inconsistencia.criadoPor ? ` · ${inconsistencia.criadoPor}` : ""} · {formatarDataHora(inconsistencia.criadoEm)}
          </p>
        </div>
        {podeAgir && !aberto ? (
          <Button size="xs" variant="outline" onClick={() => setAberto(true)}>
            <IconeAcao />
            {acao === "contestar" ? "Contestar devolução" : "Excluir inconsistência"}
          </Button>
        ) : null}
      </div>

      <p className={cn("mt-2 whitespace-pre-wrap break-words", excluida ? "text-muted-foreground" : "text-foreground")}>{inconsistencia.descricao}</p>

      {inconsistencia.contestacao ? (
        <div className="mt-2 border-l-2 border-amber-300 pl-3">
          <p className="text-xs font-medium text-amber-900">
            Contestação{inconsistencia.contestadoPor ? ` de ${inconsistencia.contestadoPor}` : ""}
            {inconsistencia.contestadoEm ? <span className="font-normal text-muted-foreground"> · {formatarDataHora(inconsistencia.contestadoEm)}</span> : null}
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-foreground">{inconsistencia.contestacao}</p>
        </div>
      ) : null}

      {excluida ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Excluída{inconsistencia.excluidaPor ? ` por ${inconsistencia.excluidaPor}` : ""} em {formatarDataHora(inconsistencia.excluidaEm)}: {inconsistencia.motivoExclusao}
        </p>
      ) : null}

      {podeAgir && aberto ? (
        <div className="mt-3 space-y-3 border-t border-amber-200/80 pt-3">
          <Campo rotulo={acao === "contestar" ? "Por que a devolução não procede" : "Motivo da exclusão"}>
            <Textarea
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              rows={3}
              maxLength={2000}
              autoFocus
              placeholder={acao === "contestar" ? "Explique para a controladoria" : "Por que esta inconsistência não procede"}
            />
          </Campo>
          <div className="flex flex-wrap justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setAberto(false)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button size="sm" onClick={salvar} disabled={ocupado || !texto.trim()}>
              {ocupado ? <LoaderCircle className="animate-spin" /> : <IconeAcao />}
              {acao === "contestar" ? "Enviar contestação" : "Excluir inconsistência"}
            </Button>
          </div>
        </div>
      ) : null}

      {erro ? (
        <p role="alert" className="mt-2 text-xs text-red-700">
          {erro}
        </p>
      ) : null}
    </article>
  );
}
