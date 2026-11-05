"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import type { AgendamentoResumo, PublicacaoResumo } from "@/lib/vistagem/types";
import { FichaPasta } from "./ficha-pasta";
import { FichaProcesso, ResumoDaFicha } from "./ficha-processo";
import { LeitorPublicacao } from "./leitor-publicacao";
import { ReguaDatas } from "./regua-datas";

/**
 * Publicação como na vistagem do jurídico: ficha da pasta (recolhível) e do processo, régua de datas e o texto já
 * aberto no leitor. A lista traz o texto até um limite; o resto vem sob demanda. Usada no Check; a Conferência tem
 * a mesma peça dentro dela e pode passar a usar esta.
 */
export function PublicacaoNaVistagem({
  publicacao: inicial,
  agendamentos,
  auxiliar,
  fotos,
  hoje,
}: {
  publicacao: PublicacaoResumo;
  agendamentos: AgendamentoResumo[];
  auxiliar: string | null;
  fotos: Record<string, string>;
  hoje: string;
}) {
  const [publicacao, setPublicacao] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const fatais = agendamentos.flatMap((agendamento) => (agendamento.etiqueta === "PRAZO" && agendamento.dataFatal ? [agendamento.dataFatal] : [])).sort();
  const marcos = [
    { rotulo: "Divulgação", data: publicacao.dataDivulgacao, dica: "Disponibilização no diário." },
    { rotulo: "Publicação", data: publicacao.dataPublicacao, tom: "marca" as const, dica: "Considera-se publicada no 1º dia útil após a disponibilização." },
    { rotulo: fatais.length > 1 ? "1ª fatal" : "Fatal", data: fatais[0] ?? null, tom: "perigo" as const },
  ];

  async function carregarCompleto() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/publicacoes/${publicacao.id}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o texto.");
      setPublicacao((atual) => ({ ...atual, teor: corpo.publicacao.teor, teorResumido: false }));
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o texto.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <>
      <div className="space-y-4 px-4 py-3">
        <FichaPasta publicacao={publicacao} auxiliar={auxiliar} fotos={fotos} resumo={<ResumoDaFicha publicacao={publicacao} auxiliar={auxiliar} fotos={fotos} />}>
          <FichaProcesso publicacao={publicacao} />
        </FichaPasta>
        <ReguaDatas rotulo="Datas da publicação" hoje={hoje} marcos={marcos} />
      </div>
      {publicacao.teorResumido ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#e6eef0] bg-[#fcfdfd] px-4 py-2 text-xs text-muted-foreground">
          <span>Texto grande: aparece só o começo.</span>
          <button
            type="button"
            onClick={carregarCompleto}
            disabled={carregando}
            className="font-medium text-[#347796] underline-offset-4 hover:underline disabled:opacity-60"
          >
            {carregando ? "Carregando…" : "Ver texto completo"}
          </button>
          {erro ? <span className="text-red-700">{erro}</span> : null}
        </div>
      ) : null}
      <LeitorPublicacao key={publicacao.teorResumido ? "resumido" : "completo"} publicacao={publicacao} partesNoCabecalho />
    </>
  );
}
