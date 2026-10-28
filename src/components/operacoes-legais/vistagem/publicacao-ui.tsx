"use client";

import { useState } from "react";
import { ChevronRight, FileText, ShieldAlert } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import type { Pendencia } from "@/lib/vistagem/triagem";
import type { PublicacaoResumo, PublicacaoStatus } from "@/lib/vistagem/types";
import { Selo, type TomSelo } from "./ui";

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

const STATUS: Partial<Record<PublicacaoStatus, { rotulo: string; tom: TomSelo }>> = {
  captada: { rotulo: "Captada", tom: "marca" },
  duplicidade: { rotulo: "Duplicidade", tom: "alerta" },
  descartada: { rotulo: "Descartada", tom: "neutro" },
  triagem_pendente: { rotulo: "Pendente na controladoria", tom: "alerta" },
  juridico_vistar: { rotulo: "Jurídico vistar", tom: "sucesso" },
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
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-muted-foreground">
      {publicacao.escritorioResponsavel ? <Selo tom="escuro">{publicacao.escritorioResponsavel}</Selo> : null}
      {publicacao.demandaRisco ? (
        <Selo tom="perigo" icone={ShieldAlert}>
          Demanda de risco
        </Selo>
      ) : null}
      {publicacao.pendencia ? <Selo tom="alerta">{PENDENCIAS[publicacao.pendencia]}</Selo> : null}
      {publicacao.pastaCi ? (
        <span className="font-mono text-foreground">
          {publicacao.pastaVinculo ? `${publicacao.pastaVinculo} · ` : ""}CI {publicacao.pastaCi}
        </span>
      ) : null}
      {publicacao.grupoCliente ? <span className="font-medium text-foreground">{publicacao.grupoCliente}</span> : null}
      {publicacao.cliente ? <span>{publicacao.cliente}</span> : null}
      {publicacao.advogadoResponsavel ? <span>Resp.: {publicacao.advogadoResponsavel}</span> : null}
    </div>
  );
}

export function StatusPublicacao({ status }: { status: PublicacaoStatus }) {
  const info = STATUS[status] ?? { rotulo: status, tom: "neutro" as const };
  return <Selo tom={info.tom}>{info.rotulo}</Selo>;
}

/** Classificação eSocial dada pelo jurídico (Trabalhista); não vai para o VIOS. */
export function SeloEsocial({ publicacao }: { publicacao: PublicacaoResumo }) {
  if (!publicacao.publicacaoEsocial) return null;
  return <Selo tom="marca">eSocial: {publicacao.publicacaoEsocial}</Selo>;
}

function Dado({ rotulo, children, largo = false }: { rotulo: string; children: React.ReactNode; largo?: boolean }) {
  return (
    <div className={largo ? "min-w-0 sm:col-span-2" : "min-w-0"}>
      <dt className="text-muted-foreground">{rotulo}</dt>
      <dd className="mt-0.5 break-words text-foreground">{children}</dd>
    </div>
  );
}

/** Dados da publicação: datas, IDs e órgão do DJEN. */
export function DadosPublicacao({ publicacao }: { publicacao: PublicacaoResumo }) {
  return (
    <dl className="grid gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
      <Dado rotulo="Divulgação → publicação">
        <span className="font-mono">
          {formatarData(publicacao.dataDivulgacao)} → {formatarData(publicacao.dataPublicacao)}
        </span>
      </Dado>
      {publicacao.djenIdComunicacao ? (
        <Dado rotulo="ID comunicação">
          <span className="font-mono">{publicacao.djenIdComunicacao}</span>
        </Dado>
      ) : null}
      {publicacao.documentoIds.length ? (
        <Dado rotulo="Id do documento">
          <span className="font-mono">
            {publicacao.documentoIds.slice(0, 4).join(", ")}
            {publicacao.documentoIds.length > 4 ? "…" : ""}
          </span>
        </Dado>
      ) : null}
      {publicacao.djenOrgao ? (
        <Dado rotulo="Órgão" largo>
          {publicacao.djenOrgao}
          {publicacao.djenTipoComunicacao ? ` · ${publicacao.djenTipoComunicacao}` : ""}
        </Dado>
      ) : null}
      {publicacao.djenIntimados.length ? (
        <Dado rotulo="Intimado" largo>
          <span className="font-medium">{publicacao.djenIntimados.join(" · ")}</span>
        </Dado>
      ) : null}
      {publicacao.motivoDescarte ? (
        <Dado rotulo="Motivo" largo>
          {publicacao.motivoDescarte}
        </Dado>
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
    <details className="group rounded-md border border-[#e6eef0] bg-[#f7fbfc]" open={aberto}>
      <summary className="flex cursor-pointer select-none list-none items-center gap-2 px-3 py-2 text-xs font-medium text-[#285f7a] [&::-webkit-details-marker]:hidden">
        <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" aria-hidden />
        <FileText className="size-3.5" aria-hidden />
        Texto da publicação
        <span className="font-normal text-muted-foreground">
          {teor.length.toLocaleString("pt-BR")}
          {resumido ? "+" : ""} caracteres
        </span>
      </summary>
      <div className="border-t border-[#e6eef0] bg-white px-3 py-3">
        <pre className="max-h-80 overflow-auto whitespace-pre-wrap break-words font-sans text-xs leading-relaxed text-foreground">{teor}</pre>
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
