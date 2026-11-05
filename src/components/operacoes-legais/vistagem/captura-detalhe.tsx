"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, Ban, ClipboardList, Copy, Hourglass, Scale, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { authFetch } from "@/lib/auth-fetch";
import type { PublicacaoResumo, PublicacaoStatus } from "@/lib/vistagem/types";
import { ContextoDoProcesso } from "./dialogo-acao";
import { FaixaDoProcesso, NA_FAIXA, SetasDaFila, type NavegacaoNaFila } from "./faixa-processo";
import { ResumoDaFicha } from "./ficha-processo";
import { LeitorPublicacao } from "./leitor-publicacao";
import { PENDENCIAS } from "./publicacao-ui";
import { ReguaDatas } from "./regua-datas";
import { Aviso, Selo, type TomSelo } from "./ui";

/** Para onde a publicação foi na captura: liberada ao jurídico, pendente, duplicidade, descartada ou ainda sem triagem. */
export type SituacaoCaptura = "juridico" | "pendente" | "duplicidade" | "descartada" | "captada";

export const SITUACOES_CAPTURA: SituacaoCaptura[] = ["juridico", "pendente", "duplicidade", "descartada", "captada"];

export const SITUACAO_CAPTURA: Record<SituacaoCaptura, { rotulo: string; curto: string; icone: LucideIcon; tom: TomSelo }> = {
  juridico: { rotulo: "Para o jurídico", curto: "Jurídico", icone: Scale, tom: "sucesso" },
  pendente: { rotulo: "Pendências", curto: "Pendente", icone: ClipboardList, tom: "alerta" },
  duplicidade: { rotulo: "Duplicidades", curto: "Duplicidade", icone: Copy, tom: "alerta" },
  descartada: { rotulo: "Descartadas", curto: "Descartada", icone: Ban, tom: "neutro" },
  captada: { rotulo: "Aguardando triagem", curto: "Sem triagem", icone: Hourglass, tom: "marca" },
};

export function situacaoNaCaptura(status: PublicacaoStatus): SituacaoCaptura {
  if (status === "captada" || status === "duplicidade" || status === "descartada") return status;
  if (status === "triagem_pendente") return "pendente";
  return "juridico";
}

/** Onde está agora a que seguiu para o jurídico (a captura mostra, mas não mexe). */
export const ETAPA_DEPOIS: Partial<Record<PublicacaoStatus, string>> = {
  juridico_vistar: "No jurídico, para vistar",
  controladoria_vistar: "Na conferência da controladoria",
  pronto_para_agendar: "Com o robô",
  agendado: "Agendada no VIOS",
  checado: "Checada",
  revisar: "Em revisão",
};

const CRITERIO: Record<string, string> = { texto: "mesmo texto", id_documento: "mesmo Id do documento" };

/** Situação com ícone, no padrão dos selos da Vistagem. */
export function SeloSituacaoCaptura({ status }: { status: PublicacaoStatus }) {
  const info = SITUACAO_CAPTURA[situacaoNaCaptura(status)];
  return (
    <Selo tom={info.tom} icone={info.icone}>
      {info.curto}
    </Selo>
  );
}

/** Uma linha que explica a situação: a etapa atual, a pendência, o critério da duplicidade ou o motivo do descarte. */
export function detalheDaSituacao(publicacao: PublicacaoResumo, principal: PublicacaoResumo | null): string | null {
  switch (situacaoNaCaptura(publicacao.status)) {
    case "juridico":
      return ETAPA_DEPOIS[publicacao.status] ?? null;
    case "pendente":
      return publicacao.pendencia ? PENDENCIAS[publicacao.pendencia] : null;
    case "duplicidade": {
      const criterio = publicacao.duplicidadeCriterio ? CRITERIO[publicacao.duplicidadeCriterio] : null;
      const resultado =
        publicacao.duplicidadeResultado === "confirmada"
          ? "confirmada"
          : publicacao.duplicidadeResultado === "nao_duplicidade"
            ? "não era duplicidade"
            : "a conferir";
      const de = principal ? `da linha ${principal.linhaArquivo ?? "?"}` : null;
      return [criterio, de, resultado].filter(Boolean).join(" · ");
    }
    case "descartada":
      return publicacao.motivoDescarte;
    default:
      return "Aguardando a triagem com o SIOE";
  }
}

function TituloBloco({ children, acao }: { children: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">{children}</h3>
      {acao}
    </div>
  );
}

/** Aba que resolve a situação, para quem quiser seguir dali (a captura é só consulta). */
const ONDE_RESOLVER: Partial<Record<SituacaoCaptura, { rotulo: string; href: string }>> = {
  pendente: { rotulo: "Abrir na Controladoria", href: "/operacoes-legais/vistagem/controladoria" },
  duplicidade: { rotulo: "Abrir em Duplicidades", href: "/operacoes-legais/vistagem/duplicidades" },
};

/**
 * Detalhe de uma publicação da Captura, num modal centralizado e só de leitura: para onde ela foi (e por quê), a
 * pasta e o processo, as datas e o texto. As setas andam pelas publicações da lista, na ordem do arquivo.
 */
export function DetalheCaptura({
  publicacao,
  principal,
  hoje,
  navegacao,
  onAbrir,
  onFechar,
}: {
  publicacao: PublicacaoResumo | null;
  /** Na duplicidade, a publicação principal (quando é deste mesmo arquivo). */
  principal: PublicacaoResumo | null;
  hoje: string;
  navegacao: NavegacaoNaFila | null;
  onAbrir: (id: string) => void;
  onFechar: () => void;
}) {
  return (
    <Dialog open={Boolean(publicacao)} onOpenChange={(abrir) => !abrir && onFechar()}>
      {publicacao ? (
        <DialogContent showCloseButton={false} className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl">
          <DialogTitle className="sr-only">Publicação {publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}</DialogTitle>
          <DialogDescription className="sr-only">Para onde a publicação foi na captura, com a pasta, as datas e o texto. Só consulta.</DialogDescription>
          <FaixaDoProcesso
            numero={publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
            tribunal={publicacao.tribunal}
            tituloId={`captura-${publicacao.id}-titulo`}
            selos={<SeloSituacaoCaptura status={publicacao.status} />}
          >
            {navegacao ? <SetasDaFila navegacao={navegacao} onAbrir={onAbrir} /> : null}
            <Button type="button" size="icon-sm" variant="ghost" className={NA_FAIXA} onClick={onFechar} aria-label="Fechar" title="Fechar">
              <X />
            </Button>
          </FaixaDoProcesso>
          {/* key: ao andar pelas setas, o texto completo carregado não passa para a próxima publicação. */}
          <CorpoDoDetalhe key={publicacao.id} publicacao={publicacao} principal={principal} hoje={hoje} />
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e6eef0] bg-[#fafcfc] px-6 py-3">
            <p className="min-w-0 flex-1 text-xs text-muted-foreground">
              Linha {publicacao.linhaArquivo ?? "—"} do arquivo · só consulta: a captura não muda nada.
            </p>
            {ONDE_RESOLVER[situacaoNaCaptura(publicacao.status)] ? (
              <Button asChild size="sm" variant="outline">
                <Link href={ONDE_RESOLVER[situacaoNaCaptura(publicacao.status)]!.href}>
                  {ONDE_RESOLVER[situacaoNaCaptura(publicacao.status)]!.rotulo}
                  <ArrowRight />
                </Link>
              </Button>
            ) : null}
            <Button size="sm" onClick={onFechar}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function CorpoDoDetalhe({ publicacao: inicial, principal, hoje }: { publicacao: PublicacaoResumo; principal: PublicacaoResumo | null; hoje: string }) {
  const [publicacao, setPublicacao] = useState(inicial);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const situacao = situacaoNaCaptura(publicacao.status);
  const info = SITUACAO_CAPTURA[situacao];
  const detalhe = detalheDaSituacao(publicacao, principal);

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
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="space-y-5 px-6 py-5">
        {/* Para onde a publicação foi: é o que a captura existe para conferir. */}
        <section className="space-y-2">
          <TituloBloco>Para onde foi</TituloBloco>
          <div className="flex items-start gap-3 rounded-lg border border-[#dce9eb] bg-[#f7fbfc] px-3.5 py-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-md bg-white text-[#285f7a] ring-1 ring-[#dce9eb]" aria-hidden>
              <info.icone className="size-4" />
            </span>
            <div className="min-w-0 flex-1 space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{info.rotulo}</p>
              {detalhe ? <p className="break-words text-sm text-muted-foreground">{detalhe}</p> : null}
              {situacao === "duplicidade" && principal ? (
                <p className="text-xs text-muted-foreground">
                  Principal: <span className="tabular-nums text-foreground">{principal.numeroProcesso ?? principal.numeroProcessoOriginal}</span>
                </p>
              ) : null}
            </div>
          </div>
        </section>

        {publicacao.grupoCliente || publicacao.cliente || publicacao.pastaCi ? (
          <section className="space-y-2">
            <TituloBloco>Pasta e processo</TituloBloco>
            <ContextoDoProcesso
              grupo={publicacao.grupoCliente}
              cliente={publicacao.cliente}
              area={publicacao.escritorioResponsavel}
              processo={publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal}
              pessoa={publicacao.advogadoResponsavel}
              papel="Advogado responsável"
              fotos={{}}
            />
            {publicacao.pastaCi ? <ResumoDaFicha publicacao={publicacao} auxiliar={null} fotos={{}} /> : null}
          </section>
        ) : null}

        <section className="space-y-2">
          <TituloBloco>Datas</TituloBloco>
          <ReguaDatas
            rotulo="Datas da publicação"
            hoje={hoje}
            marcos={[
              { rotulo: "Divulgação", data: publicacao.dataDivulgacao, dica: "Disponibilização no diário." },
              { rotulo: "Publicação", data: publicacao.dataPublicacao, tom: "marca", dica: "1º dia útil após a disponibilização." },
              { rotulo: "Importação", data: publicacao.dataImportacao, dica: "Dia do lote em que a publicação entrou." },
            ]}
          />
          {publicacao.djenOrgao || publicacao.documentoIds.length ? (
            <dl className="flex flex-wrap gap-x-5 gap-y-1 text-xs">
              {publicacao.djenOrgao ? (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Órgão</dt>
                  <dd className="text-foreground">{publicacao.djenOrgao}</dd>
                </div>
              ) : null}
              {publicacao.documentoIds.length ? (
                <div className="flex gap-1">
                  <dt className="text-muted-foreground">Id do documento</dt>
                  <dd className="tabular-nums text-foreground">{publicacao.documentoIds.join(", ")}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </section>
      </div>

      <section aria-label="Texto da publicação" className="border-t border-[#e6eef0]">
        {publicacao.teorResumido ? (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 bg-[#fcfdfd] px-6 py-2 text-xs text-muted-foreground">
            <span>Texto grande: aparece só o começo.</span>
            <button
              type="button"
              onClick={carregarCompleto}
              disabled={carregando}
              className="font-medium text-[#347796] underline-offset-4 hover:underline disabled:opacity-60"
            >
              {carregando ? "Carregando…" : "Ver texto completo"}
            </button>
          </div>
        ) : null}
        {erro ? (
          <div className="px-6 pt-2">
            <Aviso tom="erro">{erro}</Aviso>
          </div>
        ) : null}
        <LeitorPublicacao key={publicacao.teorResumido ? "resumido" : "completo"} publicacao={publicacao} className="[&_article]:px-6" />
      </section>
    </div>
  );
}
