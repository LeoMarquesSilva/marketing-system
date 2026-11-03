"use client";

import { useMemo, useState } from "react";
import { Check, LoaderCircle, PencilLine, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { authFetch } from "@/lib/auth-fetch";
import { chaveNome } from "@/lib/vistagem/agendamento";
import { cn } from "@/lib/utils";
import {
  LIMITE_TRECHO_SINTESE,
  classeDoProcesso,
  paragrafosDaSintese,
  partesPorPolo,
  valorDaCausa,
  type ParteDoPolo,
} from "@/lib/vistagem/dados-processo";
import { lerPublicacao } from "@/lib/vistagem/leitura";
import { advogadosDoEscritorioCitados } from "@/lib/vistagem/triagem";
import type { PublicacaoResumo, SintesePedida } from "@/lib/vistagem/types";
import { Celula } from "./ficha-pasta";
import { Selo, type TomSelo } from "./ui";

/** Nomes de cada polo que aparecem antes do "e mais N". */
const VISIVEIS = 2;

function Polo({ rotulo, partes, todas, onVerTodas }: { rotulo: string; partes: ParteDoPolo[]; todas: boolean; onVerTodas: () => void }) {
  const mostradas = todas ? partes : partes.slice(0, VISIVEIS);
  const resto = partes.length - mostradas.length;
  return (
    <Celula rotulo={rotulo}>
      {partes.length ? (
        <ul className="space-y-0.5">
          {mostradas.map((parte) => (
            <li key={parte.nome} className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
              <span className="truncate" title={parte.nome}>
                {parte.nome}
              </span>
              {parte.cliente ? (
                <Selo tom="escuro" className="shrink-0">
                  cliente
                </Selo>
              ) : null}
            </li>
          ))}
          {resto > 0 ? (
            <li>
              <button type="button" className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline" onClick={onVerTodas}>
                e mais {resto}
              </button>
            </li>
          ) : null}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">—</p>
      )}
    </Celula>
  );
}

const reais = (valor: number) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Processo no cabeçalho do jurídico: tipo de ação (da pasta no VIOS, ou a classe do DJEN), fase e valor da ação
 * da pasta no VIOS (o valor cai para o citado na publicação, se houver), as partes do DJEN por polo, com o
 * cliente marcado, e os advogados, com os do escritório na frente. A fase nunca é deduzida.
 */
export function FichaProcesso({ publicacao }: { publicacao: PublicacaoResumo }) {
  const leitura = useMemo(() => lerPublicacao(publicacao.teor), [publicacao.teor]);
  const [todasAsPartes, setTodasAsPartes] = useState(false);
  const classe = classeDoProcesso(leitura.classe);
  const tipo = publicacao.acaoProcesso ?? classe;
  const citado = useMemo(() => valorDaCausa(publicacao.teor), [publicacao.teor]);
  const { ativo, passivo } = partesPorPolo(leitura.partes, publicacao.cliente);
  // Pelo nome ou pela OAB no texto todo: vale também para os diários fora do DJEN, que não listam os advogados.
  const doEscritorio = useMemo(() => advogadosDoEscritorioCitados(publicacao.teor), [publicacao.teor]);
  const outros = leitura.advogados.filter((advogado) => !advogado.doEscritorio);
  const [todosOsAdvogados, setTodosOsAdvogados] = useState(false);

  return (
    <div className="grid gap-x-4 gap-y-3 rounded-md border border-[#c9dde6] bg-[#e9f2f6] px-3 py-2.5 @md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <Celula rotulo="Tipo de ação">
        <p className="truncate text-sm font-semibold text-foreground" title={tipo ?? undefined}>
          {tipo ?? "—"}
        </p>
        {classe && tipo && chaveNome(classe) !== chaveNome(tipo) ? (
          <p className="truncate text-[11px] text-muted-foreground" title={classe}>
            No tribunal: {classe}
          </p>
        ) : null}
      </Celula>
      <Celula rotulo="Fase">
        {publicacao.faseProcessual ? (
          <p className="truncate text-sm font-semibold text-foreground" title="Fase da pasta no VIOS">
            {publicacao.faseProcessual}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground" title="A pasta no VIOS está sem a fase.">
            Não informada
          </p>
        )}
      </Celula>
      <Celula rotulo="Valor da causa">
        {publicacao.valorAcao !== null ? (
          <>
            <p className="truncate text-sm font-semibold tabular-nums text-foreground" title="Valor da ação da pasta no VIOS">
              {reais(publicacao.valorAcao)}
            </p>
            {publicacao.valorAcaoAtualizado !== null && publicacao.valorAcaoAtualizado !== publicacao.valorAcao ? (
              <p className="truncate text-[11px] tabular-nums text-muted-foreground">atualizado {reais(publicacao.valorAcaoAtualizado)}</p>
            ) : null}
          </>
        ) : citado ? (
          <>
            <p className="truncate text-sm font-semibold tabular-nums text-foreground">{citado}</p>
            <p className="truncate text-[11px] text-muted-foreground">citado na publicação</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground" title="A pasta no VIOS está sem o valor da ação, e esta publicação não o cita.">
            Não informado
          </p>
        )}
      </Celula>
      {ativo.length || passivo.length ? (
        <div className="grid gap-x-4 gap-y-2 border-t border-[#c9dde6] pt-2.5 @md:col-span-full @md:grid-cols-2">
          <Polo rotulo="Polo ativo" partes={ativo} todas={todasAsPartes} onVerTodas={() => setTodasAsPartes(true)} />
          <Polo rotulo="Polo passivo" partes={passivo} todas={todasAsPartes} onVerTodas={() => setTodasAsPartes(true)} />
        </div>
      ) : null}
      {/* Advogados: o vistador confere logo se a publicação saiu em nome do Gustavo ou do Ricardo. */}
      <div className="grid gap-x-4 gap-y-2 border-t border-[#c9dde6] pt-2.5 @md:col-span-full @md:grid-cols-2">
        <Celula rotulo="Advogados do escritório">
          {doEscritorio.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {doEscritorio.map((advogado) => (
                <li key={advogado.oab}>
                  <Selo tom="escuro" icone={Check}>
                    {advogado.nome} · OAB {advogado.oab}/SP
                  </Selo>
                </li>
              ))}
            </ul>
          ) : (
            <Selo tom="alerta" icone={TriangleAlert}>
              Gustavo e Ricardo não aparecem na publicação
            </Selo>
          )}
        </Celula>
        <Celula rotulo="Outros advogados">
          {outros.length ? (
            <ul className="space-y-0.5">
              {(todosOsAdvogados ? outros : outros.slice(0, VISIVEIS)).map((advogado) => (
                <li key={`${advogado.nome}|${advogado.oab}`} className="flex min-w-0 items-baseline gap-1.5 text-sm text-foreground">
                  <span className="truncate font-medium" title={advogado.nome}>
                    {advogado.nome}
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground">
                    OAB {advogado.oab}/{advogado.uf}
                  </span>
                </li>
              ))}
              {!todosOsAdvogados && outros.length > VISIVEIS ? (
                <li>
                  <button
                    type="button"
                    className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline"
                    onClick={() => setTodosOsAdvogados(true)}
                  >
                    e mais {outros.length - VISIVEIS}
                  </button>
                </li>
              ) : null}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">—</p>
          )}
        </Celula>
      </div>
    </div>
  );
}

/** Síntese acima disto (parágrafos ou caracteres) começa recolhida, com o "Ver síntese completa". */
const SINTESE_CURTA = { paragrafos: 4, caracteres: 360 };

/** Situação do pedido na fila do robô. */
function situacaoDoPedido(pedida: SintesePedida): { rotulo: string; tom: TomSelo } {
  if (pedida.status === "erro") return { rotulo: "Erro no robô", tom: "perigo" };
  if (pedida.status === "processando") return { rotulo: "Gravando no VIOS", tom: "marca" };
  if (pedida.status !== "concluido") return { rotulo: pedida.simulado ? "Na fila (simulação)" : "Na fila do robô", tom: "neutro" };
  if (pedida.simulado) return { rotulo: "Simulado, não gravou", tom: "alerta" };
  return { rotulo: pedida.jaEstava ? "Já estava na síntese" : "Gravado no VIOS", tom: "sucesso" };
}

/** O que já foi pedido ao robô para esta pasta: data, quem pediu, o trecho e a situação. */
function SintesesPedidas({ pedidas }: { pedidas: SintesePedida[] }) {
  return (
    <ul className="space-y-1.5 border-t border-[#c9dde6] pt-2">
      {pedidas.map((pedida) => {
        const situacao = situacaoDoPedido(pedida);
        return (
          <li key={pedida.id} className="min-w-0 text-xs">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <Selo tom={situacao.tom}>{situacao.rotulo}</Selo>
              <span className="font-medium text-[#285f7a]">
                {pedida.data}
                {pedida.autor ? ` (${pedida.autor})` : ""}
              </span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-foreground" title={pedida.texto}>
              {pedida.texto}
            </p>
            {pedida.erro ? <p className="mt-0.5 text-red-700">{pedida.erro}</p> : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Síntese do processo da pasta no VIOS, embaixo da ficha. Longa, começa recolhida em umas cinco linhas; aberta,
 * rola dentro do bloco (há sínteses de 20 mil caracteres). Com `publicacaoId`, a pessoa acrescenta um trecho:
 * o robô junta no fim da síntese do VIOS como "dd/mm/aaaa (Nome): texto", quando não houver outro trabalho na fila.
 */
export function SinteseDoProcesso({
  sintese,
  erro,
  pedidas: pedidasIniciais = [],
  publicacaoId = null,
}: {
  sintese: string | null;
  erro: string | null;
  pedidas?: SintesePedida[];
  /** Publicação da vistagem; sem ela (prévia da controladoria), só leitura. */
  publicacaoId?: string | null;
}) {
  const paragrafos = useMemo(() => paragrafosDaSintese(sintese), [sintese]);
  const [completa, setCompleta] = useState(false);
  const [pedidas, setPedidas] = useState(pedidasIniciais);
  const [escrevendo, setEscrevendo] = useState(false);
  const [trecho, setTrecho] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erroEnvio, setErroEnvio] = useState("");
  const longa = paragrafos.length > SINTESE_CURTA.paragrafos || paragrafos.join(" ").length > SINTESE_CURTA.caracteres;
  const recolhida = longa && !completa;

  async function atualizarSintese() {
    setEnviando(true);
    setErroEnvio("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/juridico/${publicacaoId}/sintese`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ texto: trecho }),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao pedir a atualização da síntese.");
      setPedidas(corpo.sintesesPedidas ?? []);
      setTrecho("");
      setEscrevendo(false);
    } catch (e) {
      setErroEnvio(e instanceof Error ? e.message : "Falha ao pedir a atualização da síntese.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="rounded-md border border-[#c9dde6] bg-[#e9f2f6] px-3 py-2.5">
      <Celula rotulo="Síntese do processo">
        {erro ? (
          <p className="text-sm text-muted-foreground" title={erro}>
            Não foi possível carregar a síntese do VIOS.
          </p>
        ) : paragrafos.length ? (
          <>
            <div className={cn("relative", recolhida && "max-h-[6.25rem] overflow-hidden", completa && "max-h-96 overflow-y-auto pr-1")}>
              <div className="space-y-1 text-sm leading-5 text-foreground">
                {paragrafos.map((paragrafo, indice) => (
                  <p key={indice}>{paragrafo}</p>
                ))}
              </div>
              {recolhida ? <div className="pointer-events-none absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-[#e9f2f6]" aria-hidden /> : null}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Não preenchida no VIOS.</p>
        )}
        {longa || (publicacaoId && !escrevendo) ? (
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1">
            {longa ? (
              <button
                type="button"
                className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline"
                aria-expanded={completa}
                onClick={() => setCompleta((aberta) => !aberta)}
              >
                {completa ? "Recolher síntese" : "Ver síntese completa"}
              </button>
            ) : null}
            {publicacaoId && !escrevendo ? (
              <button
                type="button"
                className="inline-flex items-center gap-1 text-xs font-medium text-[#347796] underline-offset-4 hover:underline"
                onClick={() => setEscrevendo(true)}
              >
                <PencilLine className="size-3.5" aria-hidden />
                Acrescentar à síntese
              </button>
            ) : null}
          </div>
        ) : null}
        {publicacaoId && escrevendo ? (
          <form
            className="mt-2 space-y-2"
            onSubmit={(evento) => {
              evento.preventDefault();
              if (trecho.trim().length >= 3 && !enviando) void atualizarSintese();
            }}
          >
            <Textarea
              value={trecho}
              onChange={(evento) => setTrecho(evento.target.value)}
              maxLength={LIMITE_TRECHO_SINTESE}
              rows={3}
              placeholder="O que acrescentar à síntese do processo"
              aria-label="Trecho para acrescentar à síntese"
              className="bg-white"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Vai no fim da síntese do VIOS, com a data de hoje e o seu nome. O robô grava quando não houver outro agendamento na fila; o texto
              acima muda depois da próxima carga do VIOS.
            </p>
            {erroEnvio ? <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{erroEnvio}</p> : null}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEscrevendo(false)} disabled={enviando}>
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={trecho.trim().length < 3 || enviando}>
                {enviando ? <LoaderCircle className="animate-spin" /> : <PencilLine />}
                Atualizar Síntese
              </Button>
            </div>
          </form>
        ) : null}
        {pedidas.length ? (
          <div className="mt-2">
            <SintesesPedidas pedidas={pedidas} />
          </div>
        ) : null}
      </Celula>
    </div>
  );
}
