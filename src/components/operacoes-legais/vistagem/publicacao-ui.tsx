"use client";

import { useState } from "react";
import { authFetch } from "@/lib/auth-fetch";
import { cn } from "@/lib/utils";
import type { Pendencia } from "@/lib/vistagem/triagem";
import type { PublicacaoResumo, PublicacaoStatus } from "@/lib/vistagem/types";

export function formatarData(iso: string | null): string {
  if (!iso) return "—";
  const [ano, mes, dia] = iso.slice(0, 10).split("-");
  return `${dia}/${mes}/${ano}`;
}

export function formatarDataHora(iso: string | null): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

const STATUS: Partial<Record<PublicacaoStatus, { rotulo: string; classe: string }>> = {
  captada: { rotulo: "Captada", classe: "border-[#47cdd0]/35 bg-[#e8f8f8] text-[#285f7a]" },
  duplicidade: { rotulo: "Duplicidade", classe: "border-amber-200 bg-amber-50 text-amber-800" },
  descartada: { rotulo: "Descartada", classe: "border-slate-200 bg-slate-100 text-slate-600" },
  triagem_pendente: { rotulo: "Pendente na controladoria", classe: "border-orange-200 bg-orange-50 text-orange-800" },
  juridico_vistar: { rotulo: "Jurídico vistar", classe: "border-emerald-200 bg-emerald-50 text-emerald-800" },
};

export const PENDENCIAS: Record<Pendencia, string> = {
  sem_pasta: "Sem pasta no VIOS (possível abertura)",
  varias_pastas: "Mais de uma pasta para o processo",
  ex_cliente: "Ex-cliente",
  sem_area: "Sem área definida",
  sem_grupo: "Sem grupo do cliente",
};

/** Resultado da triagem com o SIOE: escritório, pasta, grupo, responsável e demanda de risco. */
export function DadosPasta({ publicacao }: { publicacao: PublicacaoResumo }) {
  if (!publicacao.pastaCi && !publicacao.escritorioResponsavel && !publicacao.pendencia) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
      {publicacao.escritorioResponsavel ? (
        <span className="rounded-full bg-[#183f50] px-2 py-0.5 font-medium text-white">{publicacao.escritorioResponsavel}</span>
      ) : null}
      {publicacao.pastaCi ? (
        <span className="font-mono text-slate-800">
          {publicacao.pastaVinculo ? `${publicacao.pastaVinculo} - ` : ""}CI {publicacao.pastaCi}
        </span>
      ) : null}
      {publicacao.grupoCliente ? <span className="font-medium text-slate-800">{publicacao.grupoCliente}</span> : null}
      {publicacao.cliente ? <span>{publicacao.cliente}</span> : null}
      {publicacao.advogadoResponsavel ? <span>Resp.: {publicacao.advogadoResponsavel}</span> : null}
      {publicacao.demandaRisco ? (
        <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 font-medium text-red-700">Demanda de risco</span>
      ) : null}
      {publicacao.pendencia ? (
        <span className="rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-orange-800">{PENDENCIAS[publicacao.pendencia]}</span>
      ) : null}
    </div>
  );
}

export function StatusPublicacao({ status }: { status: PublicacaoStatus }) {
  const info = STATUS[status] ?? { rotulo: status, classe: "border-slate-200 bg-white text-slate-700" };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium", info.classe)}>
      {info.rotulo}
    </span>
  );
}

/** Cabeçalho compacto com processo, tribunal, datas e dados do DJEN. */
/** Classificação eSocial dada pelo jurídico (Trabalhista); não vai para o VIOS. */
export function SeloEsocial({ publicacao }: { publicacao: PublicacaoResumo }) {
  if (!publicacao.publicacaoEsocial) return null;
  return (
    <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-900">eSocial: {publicacao.publicacaoEsocial}</span>
  );
}

export function DadosPublicacao({ publicacao }: { publicacao: PublicacaoResumo }) {
  return (
    <dl className="grid gap-x-4 gap-y-1 text-xs text-slate-600 sm:grid-cols-2">
      <div className="flex gap-1">
        <dt className="text-slate-500">Divulgação → publicação:</dt>
        <dd className="font-mono">{formatarData(publicacao.dataDivulgacao)} → {formatarData(publicacao.dataPublicacao)}</dd>
      </div>
      {publicacao.djenIdComunicacao ? (
        <div className="flex gap-1">
          <dt className="text-slate-500">ID comunicação:</dt>
          <dd className="font-mono">{publicacao.djenIdComunicacao}</dd>
        </div>
      ) : null}
      {publicacao.documentoIds.length ? (
        <div className="flex gap-1">
          <dt className="text-slate-500">Id do documento:</dt>
          <dd className="font-mono">
            {publicacao.documentoIds.slice(0, 4).join(", ")}
            {publicacao.documentoIds.length > 4 ? "…" : ""}
          </dd>
        </div>
      ) : null}
      {publicacao.djenOrgao ? (
        <div className="flex gap-1 sm:col-span-2">
          <dt className="text-slate-500">Órgão:</dt>
          <dd>{publicacao.djenOrgao}{publicacao.djenTipoComunicacao ? ` · ${publicacao.djenTipoComunicacao}` : ""}</dd>
        </div>
      ) : null}
      {publicacao.djenIntimados.length ? (
        <div className="flex gap-1 sm:col-span-2">
          <dt className="text-slate-500">Intimado:</dt>
          <dd className="font-medium text-slate-800">{publicacao.djenIntimados.join(" · ")}</dd>
        </div>
      ) : null}
      {publicacao.motivoDescarte ? (
        <div className="flex gap-1 sm:col-span-2">
          <dt className="text-slate-500">Motivo:</dt>
          <dd>{publicacao.motivoDescarte}</dd>
        </div>
      ) : null}
    </dl>
  );
}

/** Texto da publicação; quando a listagem veio resumida, busca o texto completo sob demanda. */
export function TeorPublicacao({ publicacao, aberto = false }: { publicacao: PublicacaoResumo; aberto?: boolean }) {
  const [teor, setTeor] = useState(publicacao.teor);
  const [resumido, setResumido] = useState(publicacao.teorResumido);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");

  async function carregarCompleto() {
    setCarregando(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/publicacoes/${publicacao.id}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o texto.");
      setTeor(corpo.publicacao.teor);
      setResumido(false);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar o texto.");
    } finally {
      setCarregando(false);
    }
  }

  return (
    <details className="group rounded-md border border-[#dce9eb] bg-slate-50/60" open={aberto}>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-medium text-[#285f7a]">
        Texto da publicação ({teor.length.toLocaleString("pt-BR")}{resumido ? "+" : ""} caracteres)
      </summary>
      <div className="border-t border-[#dce9eb] px-3 py-2">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-slate-700">{teor}</pre>
        {resumido ? (
          <button
            type="button"
            onClick={carregarCompleto}
            disabled={carregando}
            className="mt-2 text-xs font-medium text-[#347796] underline-offset-4 hover:underline disabled:opacity-60"
          >
            {carregando ? "Carregando…" : "Ver texto completo"}
          </button>
        ) : null}
        {erro ? <p className="mt-1 text-xs text-red-700">{erro}</p> : null}
      </div>
    </details>
  );
}
