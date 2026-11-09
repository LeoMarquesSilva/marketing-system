"use client";

import { useState, type ReactNode } from "react";
import { GitCompareArrows, ListTodo, TriangleAlert, Undo2, X } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { compararTarefa } from "@/lib/vistagem/check";
import type { ConferenciaItem } from "@/lib/vistagem/types";
import { SituacaoNaCentral } from "./abertura-pasta";
import { devolucoesDe, etapasDaEsteira, EsteiraDetalhada, situacaoAgendada, SITUACAO_AGENDADA } from "./esteira-agendada";
import { FaixaDoProcesso, NA_FAIXA, SetasDaFila, type NavegacaoNaFila } from "./faixa-processo";
import { FichaPasta } from "./ficha-pasta";
import { FichaProcesso, ResumoDaFicha } from "./ficha-processo";
import { CartaoInconsistencia } from "./inconsistencias-ui";
import { formatarData, formatarDataHora, SeloEsocial } from "./publicacao-ui";
import { CartoesCheck } from "./tarefas-check";
import { CartoesTarefas } from "./tarefas-conferencia";
import { Aviso, Selo } from "./ui";

const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`;

/** Título de bloco no corpo do modal, igual ao das seções da Conferência e do Check. */
function TituloBloco({ id, children, acao }: { id: string; children: string; acao?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 id={id} className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">
        {children}
      </h3>
      {acao}
    </div>
  );
}

type VistaTarefas = "pedido" | "vios";

/**
 * Detalhe de uma publicação da visão Agendadas, num modal centralizado e só de leitura: a esteira com quem fez cada
 * etapa e quando, a ficha da pasta e do processo, as observações, as inconsistências e as tarefas (como foram pedidas,
 * com o fluxo, ou o pedido × o que o robô gravou no VIOS).
 */
export function DetalheAgendada({
  item,
  fotos,
  hoje,
  navegacao,
  onAbrir,
  onFechar,
}: {
  item: ConferenciaItem | null;
  fotos: Record<string, string>;
  hoje: string;
  navegacao: NavegacaoNaFila | null;
  onAbrir: (id: string) => void;
  onFechar: () => void;
}) {
  // A escolha "Como foi pedido" × "Pedido × VIOS" segue ao andar pelas setas.
  const [vista, setVista] = useState<VistaTarefas>("pedido");
  return (
    <Dialog open={Boolean(item)} onOpenChange={(abrir) => !abrir && onFechar()}>
      {item ? (
        <DialogContent
          showCloseButton={false}
          aria-describedby={`agendada-${item.publicacao.id}-descricao`}
          className="flex max-h-[90dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl lg:max-w-3xl"
        >
          <Conteudo item={item} fotos={fotos} hoje={hoje} navegacao={navegacao} onAbrir={onAbrir} onFechar={onFechar} vista={vista} onVista={setVista} />
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

function Conteudo({
  item,
  fotos,
  hoje,
  navegacao,
  onAbrir,
  onFechar,
  vista,
  onVista,
}: {
  item: ConferenciaItem;
  fotos: Record<string, string>;
  hoje: string;
  navegacao: NavegacaoNaFila | null;
  onAbrir: (id: string) => void;
  onFechar: () => void;
  vista: VistaTarefas;
  onVista: (vista: VistaTarefas) => void;
}) {
  const { publicacao, agendamentos } = item;
  const base = `agendada-${publicacao.id}`;
  const processo = publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal;
  const situacao = situacaoAgendada(item);
  const etapas = etapasDaEsteira(item);
  const devolucoes = devolucoesDe(item);
  // "Pedido × VIOS" só quando o robô já devolveu alguma tarefa (com o CI ou como ficou no VIOS).
  const comVios = agendamentos.some((agendamento) => agendamento.viosTarefaId || agendamento.viosTarefas?.length);
  const vistaAtiva: VistaTarefas = comVios ? vista : "pedido";
  const divergentes = comVios ? agendamentos.filter((agendamento) => compararTarefa(agendamento).situacao === "diverge").length : 0;
  const agendadas = agendamentos.filter((agendamento) => agendamento.envioStatus === "concluido").length;

  return (
    <>
      {/* O topo é a faixa do processo das outras telas: o número pesquisa no tribunal e copia; as setas andam na lista. */}
      <div className="shrink-0">
        <DialogTitle className="sr-only">Processo {processo}</DialogTitle>
        <DialogDescription id={`${base}-descricao`} className="sr-only">
          Onde está cada tarefa desta publicação, da vistagem ao check. Só consulta.
        </DialogDescription>
        <FaixaDoProcesso
          numero={processo}
          tribunal={publicacao.tribunal}
          tituloId={`${base}-titulo`}
          selos={
            <>
              <SeloEsocial publicacao={publicacao} />
              {situacao ? (
                <Selo tom={SITUACAO_AGENDADA[situacao].tom} icone={SITUACAO_AGENDADA[situacao].icone} className="ring-white/30">
                  {SITUACAO_AGENDADA[situacao].rotulo}
                </Selo>
              ) : null}
              {devolucoes ? (
                <Selo tom="alerta" icone={Undo2} className="ring-white/30">
                  Devolvida{devolucoes > 1 ? ` ${devolucoes}×` : ""}
                </Selo>
              ) : null}
            </>
          }
        >
          {navegacao ? <SetasDaFila navegacao={navegacao} onAbrir={onAbrir} /> : null}
          <Button type="button" size="icon-sm" variant="ghost" className={NA_FAIXA} onClick={onFechar} aria-label="Fechar" title="Fechar">
            <X />
          </Button>
        </FaixaDoProcesso>
      </div>

      {/* Só o corpo rola; a chave volta a rolagem para o topo ao andar pelas setas. */}
      <div key={publicacao.id} className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6 px-4 py-5 sm:px-6">
          {situacao === "central" ? (
            <Aviso tom={publicacao.centralErro && !publicacao.centralItemId ? "erro" : "info"} titulo="Sem pasta no VIOS">
              As tarefas não vão para o robô: a controladoria abre a pasta e agenda pela Central do SharePoint.{" "}
              <SituacaoNaCentral publicacao={publicacao} />
            </Aviso>
          ) : null}

          {situacao === "revisao" ? (
            <p className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-800">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>A controladoria apontou erro no check. A publicação fica em revisão até ser corrigida no VIOS e checada de novo.</span>
            </p>
          ) : null}

          <section aria-labelledby={`${base}-esteira`} className="space-y-3">
            <TituloBloco id={`${base}-esteira`}>Onde está</TituloBloco>
            <EsteiraDetalhada etapas={etapas} fotos={fotos} />
          </section>

          <section aria-labelledby={`${base}-ficha`} className="space-y-3">
            <TituloBloco id={`${base}-ficha`}>Pasta e processo</TituloBloco>
            <FichaPasta
              publicacao={publicacao}
              auxiliar={item.auxiliar ?? null}
              fotos={fotos}
              resumo={<ResumoDaFicha publicacao={publicacao} auxiliar={item.auxiliar ?? null} fotos={fotos} />}
            >
              <FichaProcesso publicacao={publicacao} />
            </FichaPasta>
            <p className="text-xs text-muted-foreground">
              Publicada em <span className="tabular-nums">{formatarData(publicacao.dataPublicacao)}</span>
              {publicacao.dataDivulgacao ? (
                <>
                  {" "}
                  · divulgada em <span className="tabular-nums">{formatarData(publicacao.dataDivulgacao)}</span>
                </>
              ) : null}
            </p>
          </section>

          {publicacao.observacaoVistagem ? (
            <section aria-labelledby={`${base}-observacao`} className="space-y-2">
              <TituloBloco id={`${base}-observacao`}>Observação do jurídico</TituloBloco>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{publicacao.observacaoVistagem}</p>
            </section>
          ) : null}

          {publicacao.checkNota ? (
            <section aria-labelledby={`${base}-nota`} className="space-y-2">
              <TituloBloco id={`${base}-nota`}>Observação do check</TituloBloco>
              <p className="whitespace-pre-wrap break-words text-sm text-foreground">{publicacao.checkNota}</p>
            </section>
          ) : null}

          {item.inconsistencias.length ? (
            <section aria-labelledby={`${base}-inconsistencias`} className="space-y-2">
              <TituloBloco id={`${base}-inconsistencias`} acao={<Selo tom="alerta">{item.inconsistencias.length}</Selo>}>
                Inconsistências
              </TituloBloco>
              <div className="space-y-2">
                {item.inconsistencias.map((inconsistencia) => (
                  <CartaoInconsistencia key={inconsistencia.id} inconsistencia={inconsistencia} acao={null} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        {/* Tarefas numa banda com o fundo das colunas de tarefas da Conferência e do Check. */}
        <section aria-labelledby={`${base}-tarefas`} className="@container border-t border-[#e6eef0] bg-[#f2f6f7]">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 px-4 pb-3 pt-4 sm:px-6">
            <div className="min-w-0">
              <h3 id={`${base}-tarefas`} className="text-xs font-semibold uppercase tracking-normal text-[#285f7a]">
                Tarefas
              </h3>
              <p className="text-xs text-muted-foreground">
                {[
                  plural(agendamentos.length, "tarefa", "tarefas"),
                  agendadas ? plural(agendadas, "agendada no VIOS", "agendadas no VIOS") : null,
                  divergentes ? `${divergentes} com divergência` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            {comVios ? (
              <Segmented
                label="Ver as tarefas"
                value={vistaAtiva}
                options={[
                  { value: "pedido", label: "Como foi pedido", icon: ListTodo },
                  { value: "vios", label: "Pedido × VIOS", icon: GitCompareArrows },
                ]}
                onChange={onVista}
              />
            ) : null}
          </div>
          <div className="sm:px-3">
            {vistaAtiva === "vios" ? (
              <CartoesCheck agendamentos={agendamentos} fotos={fotos} hoje={hoje} />
            ) : (
              <CartoesTarefas agendamentos={agendamentos} comEnvio={situacao !== "central"} fotos={fotos} hoje={hoje} />
            )}
          </div>
        </section>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 border-t border-[#e6eef0] bg-[#fafcfc] px-4 py-3 sm:px-6">
        <p className="min-w-0 flex-1 text-xs text-muted-foreground">
          Vistada{item.vistadoPor ? ` por ${item.vistadoPor}` : ""} em <span className="tabular-nums">{formatarDataHora(publicacao.vistadoEm)}</span>. Só
          consulta: nada aqui altera a publicação.
        </p>
        <Button type="button" variant="outline" onClick={onFechar}>
          Fechar
        </Button>
      </div>
    </>
  );
}
