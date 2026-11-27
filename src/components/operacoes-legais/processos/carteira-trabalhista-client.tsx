"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, ArrowUpDown, ClipboardCheck, FileSpreadsheet, FolderSearch, Handshake, LoaderCircle, RefreshCw, Scale, SearchX, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { rotuloDoStatus, type StatusNegociacao } from "@/lib/processos/negociacao";
import { SITUACOES_DA_ATUALIZACAO, diaEmBrasilia, situacaoDaAtualizacao } from "@/lib/processos/rec-credito";
import type { LinhaCarteiraTrabalhista } from "@/lib/processos/trabalhista-carteira";
import { formatarReais } from "@/lib/processos/trabalhista";
import { cn } from "@/lib/utils";
import { LogoGrupo } from "../vistagem/marcas";
import { Seletor, SeletorBusca, type OpcaoSeletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, Carregando, Indicador, Indicadores, Painel, Selo, Vazio, type TomSelo } from "../vistagem/ui";
import { AcessoProcessos } from "./acesso-processos";
import { PainelDeAcordos } from "./acordos-trabalhistas-painel";
import { AtualizacaoDosAutosNaLinha } from "./carteira-client";
import { BarraPreenchimento } from "./preenchimento-ui";
import { mensagemDeErro, processosApi } from "./processos-api";

type Aba = "carteira" | "acordos";

const ABAS: { valor: Aba; rotulo: string }[] = [
  { valor: "carteira", rotulo: "Carteira" },
  { valor: "acordos", rotulo: "Acordos" },
];

/** Carteira Trabalhista, como a de Rec. Crédito: a lista dos processos da área e, numa aba, a tentativa de acordo. */
export function CarteiraTrabalhistaClient({ aba }: { aba: Aba }) {
  return (
    <AcessoProcessos>
      <CarteiraTrabalhista abaInicial={aba} />
    </AcessoProcessos>
  );
}

function CarteiraTrabalhista({ abaInicial }: { abaInicial: Aba }) {
  const [aba, setAba] = useState<Aba>(abaInicial);
  const router = useRouter();
  const caminho = usePathname();
  const ir = (nova: Aba) => {
    setAba(nova);
    // A aba fica no endereço: voltar da ficha cai nela.
    router.replace(nova === "carteira" ? caminho : `${caminho}?aba=${nova}`, { scroll: false });
  };
  return (
    <div className="space-y-4">
      <div role="tablist" aria-label="Carteira Trabalhista" className="inline-flex rounded-md border border-[#c9dde6] bg-white p-0.5">
        {ABAS.map((item) => (
          <button
            key={item.valor}
            type="button"
            role="tab"
            aria-selected={aba === item.valor}
            onClick={() => ir(item.valor)}
            className={cn(
              "flex items-center gap-1.5 rounded px-4 py-1.5 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
              aba === item.valor ? "bg-[#183f50] text-white" : "text-[#285f7a] hover:bg-[#e8f8f8]"
            )}
          >
            {item.valor === "carteira" ? <Scale className="size-4" aria-hidden /> : <Handshake className="size-4" aria-hidden />}
            {item.rotulo}
          </button>
        ))}
      </div>
      {aba === "carteira" ? <Carteira /> : <PainelDeAcordos />}
    </div>
  );
}

const SITUACOES: OpcaoSeletor[] = [
  { valor: "ativos", rotulo: "Ativos" },
  { valor: "encerrados", rotulo: "Encerrados" },
];
const ATUALIZACOES: OpcaoSeletor[] = SITUACOES_DA_ATUALIZACAO.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));
const SANEAMENTO: OpcaoSeletor[] = [
  { valor: "completo", rotulo: "Saneamento completo" },
  { valor: "incompleto", rotulo: "Saneamento incompleto" },
  { valor: "sem_email", rotulo: "Sem e-mail do advogado" },
];
const TOM_STATUS: Record<StatusNegociacao, TomSelo> = {
  a_enviar: "neutro",
  enviado: "marca",
  respondido: "ia",
  proposta_recebida: "alerta",
  contraproposta: "alerta",
  acordo_fechado: "sucesso",
  sem_interesse: "perigo",
};

type Valor = string | number | null;
const COLUNAS: { titulo: string; valor: (linha: LinhaCarteiraTrabalhista) => Valor }[] = [
  { titulo: "Processo", valor: (linha) => linha.cnj ?? linha.ci },
  { titulo: "Advogado do reclamante", valor: (linha) => linha.advogadosReclamante[0]?.nome ?? null },
  { titulo: "Robô e IA", valor: (linha) => linha.autos.roboEm },
  { titulo: "Situação", valor: (linha) => `${linha.encerrado ? "1" : "0"} ${linha.fase ?? ""}` },
  { titulo: "Contrato", valor: (linha) => linha.admissao },
  { titulo: "Laudo", valor: (linha) => linha.laudo },
  { titulo: "Decisão", valor: (linha) => linha.decisao },
  { titulo: "Pedidos", valor: (linha) => linha.pedidos || null },
  { titulo: "Risco total", valor: (linha) => linha.riscoTotal },
  { titulo: "Acordo", valor: (linha) => rotuloDoStatus(linha.negociacao) },
  { titulo: "Saneamento", valor: (linha) => linha.saneamento.percentual },
];

function compararValores(a: Valor, b: Valor, sentido: 1 | -1): number {
  if (a === null || a === "") return b === null || b === "" ? 0 : 1;
  if (b === null || b === "") return -1;
  const resultado = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "pt-BR", { numeric: true });
  return resultado * sentido;
}

const br = (iso: string | null) => (iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : null);
const real = (valor: number | null) => (valor === null ? "—" : formatarReais(valor));

function Carteira() {
  const [linhas, setLinhas] = useState<LinhaCarteiraTrabalhista[] | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [busca, setBusca] = useState("");
  const [grupo, setGrupo] = useState("");
  const [advogado, setAdvogado] = useState("");
  const [situacao, setSituacao] = useState("");
  const [atualizacao, setAtualizacao] = useState("");
  const [saneamento, setSaneamento] = useState("");
  const [ordem, setOrdem] = useState<{ coluna: string; sentido: 1 | -1 } | null>(null);
  const [baixando, setBaixando] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  useEffect(() => {
    let ativo = true;
    processosApi.get<{ linhas: LinhaCarteiraTrabalhista[] }>("/trabalhista").then(
      (resposta) => {
        if (!ativo) return;
        setLinhas(resposta.linhas);
        setErro("");
      },
      (falha: unknown) => {
        if (ativo) setErro(mensagemDeErro(falha));
      }
    );
    return () => {
      ativo = false;
    };
  }, [tentativa]);

  const todas = useMemo(() => linhas ?? [], [linhas]);
  const hoje = diaEmBrasilia(new Date());
  // Enquanto o robô ou a IA trabalham em algum processo, a carteira se recarrega sozinha a cada 30 s.
  const trabalhando = todas.some((linha) => situacaoDaAtualizacao(linha.autos, hoje) === "em_andamento");
  useEffect(() => {
    if (!trabalhando) return;
    const relogio = window.setInterval(() => setTentativa((atual) => atual + 1), 30_000);
    return () => window.clearInterval(relogio);
  }, [trabalhando]);

  const contar = (filtro: (linha: LinhaCarteiraTrabalhista) => boolean) => todas.filter(filtro).length;
  const opcoesGrupo: OpcaoSeletor[] = [...new Set(todas.map((linha) => linha.grupoCliente).filter((valor): valor is string => Boolean(valor)))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((valor) => ({ valor, rotulo: valor, contagem: contar((linha) => linha.grupoCliente === valor) }));
  const opcoesAdvogado: OpcaoSeletor[] = [...new Set(todas.map((linha) => linha.advogadoResponsavel).filter((valor): valor is string => Boolean(valor)))]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((valor) => ({ valor, rotulo: valor, contagem: contar((linha) => linha.advogadoResponsavel === valor) }));

  const filtradas = useMemo(() => {
    const digitos = busca.replace(/\D/g, "");
    const termo = busca.trim().toLowerCase();
    return todas.filter((linha) => {
      if (grupo && linha.grupoCliente !== grupo) return false;
      if (advogado && linha.advogadoResponsavel !== advogado) return false;
      if (situacao === "ativos" && linha.encerrado) return false;
      if (situacao === "encerrados" && !linha.encerrado) return false;
      if (atualizacao && situacaoDaAtualizacao(linha.autos, hoje) !== atualizacao) return false;
      if (saneamento === "completo" && linha.saneamento.percentual < 100) return false;
      if (saneamento === "incompleto" && linha.saneamento.percentual >= 100) return false;
      if (saneamento === "sem_email" && linha.advogadosReclamante.some((item) => item.emails.length)) return false;
      if (!termo) return true;
      if (digitos.length >= 4 && ((linha.cnj ?? "").replace(/\D/g, "").includes(digitos) || (linha.ci ?? "").includes(digitos))) return true;
      return [linha.reclamante, linha.cliente, linha.advogadoResponsavel, ...linha.advogadosReclamante.map((item) => item.nome)].some((campo) => campo?.toLowerCase().includes(termo));
    });
  }, [todas, busca, grupo, advogado, situacao, atualizacao, saneamento, hoje]);

  const ordenadas = useMemo(() => {
    const coluna = ordem ? COLUNAS.find((item) => item.titulo === ordem.coluna) : null;
    if (!coluna || !ordem) return filtradas;
    return [...filtradas].sort((a, b) => compararValores(coluna.valor(a), coluna.valor(b), ordem.sentido));
  }, [filtradas, ordem]);
  const ordenarPor = (titulo: string) =>
    setOrdem((atual) => (atual?.coluna !== titulo ? { coluna: titulo, sentido: 1 } : atual.sentido === 1 ? { coluna: titulo, sentido: -1 } : null));

  if (!linhas && !erro) return <Carregando rotulo="Montando a carteira trabalhista" />;

  const risco = filtradas.reduce((total, linha) => total + (linha.riscoTotal ?? 0), 0);
  const comRisco = filtradas.filter((linha) => linha.riscoTotal !== null).length;
  const saneados = filtradas.filter((linha) => linha.saneamento.percentual >= 100).length;
  const mediaSaneamento = filtradas.length ? Math.round(filtradas.reduce((total, linha) => total + linha.saneamento.percentual, 0) / filtradas.length) : 0;
  const semEmail = filtradas.filter((linha) => !linha.advogadosReclamante.some((item) => item.emails.length)).length;
  const fechados = filtradas.filter((linha) => linha.negociacao === "acordo_fechado").length;
  const emConversa = filtradas.filter((linha) => ["respondido", "proposta_recebida", "contraproposta"].includes(linha.negociacao)).length;
  const filtrado = Boolean(busca || grupo || advogado || situacao || atualizacao || saneamento);

  async function atualizarAutos() {
    setAtualizando(true);
    setErro("");
    setFeito("");
    try {
      const { resultado } = await processosApi.post<{ resultado: { pedidos: number; emAndamento: number; semRobo: number } }>("/autos/atualizar", { ids: filtradas.map((linha) => linha.id) });
      setFeito(
        [
          `${resultado.pedidos} processo${resultado.pedidos === 1 ? "" : "s"} na fila do robô para atualizar os autos.`,
          resultado.emAndamento ? `${resultado.emAndamento} já estava${resultado.emAndamento === 1 ? "" : "m"} na fila.` : "",
          resultado.semRobo ? `${resultado.semRobo} sem robô para o tribunal (ou em segredo de justiça): anexe o PDF na ficha.` : "",
        ]
          .filter(Boolean)
          .join(" ")
      );
      setTentativa((atual) => atual + 1);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setAtualizando(false);
    }
  }

  async function baixar() {
    setBaixando(true);
    try {
      await processosApi.baixarCarteiraTrabalhista(filtrado ? filtradas.map((linha) => linha.id) : null);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setBaixando(false);
    }
  }

  return (
    <div className="space-y-4">
      <Indicadores>
        <Indicador icone={Scale} rotulo="Risco total" valor={formatarReais(risco)}>
          {comRisco} de {filtradas.length} processo{filtradas.length === 1 ? "" : "s"} com risco calculado
        </Indicador>
        <Indicador icone={ClipboardCheck} rotulo="Saneamento" valor={`${mediaSaneamento}%`} tom={mediaSaneamento >= 100 ? "sucesso" : "neutro"} ativo={saneamento === "incompleto"} onClick={() => setSaneamento((atual) => (atual === "incompleto" ? "" : "incompleto"))}>
          {saneados} completo{saneados === 1 ? "" : "s"} · {filtradas.length - saneados} por completar
        </Indicador>
        <Indicador icone={TriangleAlert} rotulo="Sem e-mail do advogado" valor={semEmail} tom={semEmail ? "alerta" : "sucesso"} ativo={saneamento === "sem_email"} onClick={() => setSaneamento((atual) => (atual === "sem_email" ? "" : "sem_email"))}>
          precisam do e-mail para o acordo
        </Indicador>
        <Indicador icone={Handshake} rotulo="Acordos fechados" valor={fechados} tom={fechados ? "sucesso" : "neutro"}>
          {emConversa} em conversa
        </Indicador>
      </Indicadores>

      {feito ? <Aviso tom="sucesso">{feito}</Aviso> : null}
      {erro ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => setTentativa((atual) => atual + 1)}>
              <RefreshCw /> Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : null}

      <BarraAba
        resumo={
          <span>
            <strong className="font-semibold tabular-nums text-foreground">{filtradas.length}</strong> {filtradas.length === 1 ? "processo" : "processos"}
          </span>
        }
      >
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="CNJ, CI, reclamante, cliente ou advogado" aria-label="Buscar processo" />
        {opcoesGrupo.length > 1 ? <SeletorBusca valor={grupo} onChange={setGrupo} opcoes={opcoesGrupo} todos={{ rotulo: "Todos os grupos" }} rotulo="Grupo do cliente" className="sm:w-52" /> : null}
        <SeletorBusca valor={advogado} onChange={setAdvogado} opcoes={opcoesAdvogado} todos={{ rotulo: "Todos os advogados" }} rotulo="Advogado responsável" className="sm:w-56" />
        <Seletor valor={situacao} onChange={setSituacao} opcoes={SITUACOES} todos={{ rotulo: "Ativos e encerrados" }} rotulo="Situação" className="sm:w-48" />
        <Seletor valor={atualizacao} onChange={setAtualizacao} opcoes={ATUALIZACOES} todos={{ rotulo: "Toda atualização" }} rotulo="Atualização dos autos" className="sm:w-56" />
        <Seletor valor={saneamento} onChange={setSaneamento} opcoes={SANEAMENTO} todos={{ rotulo: "Todo saneamento" }} rotulo="Saneamento" className="sm:w-56" />
        <Button variant="outline" onClick={() => void atualizarAutos()} disabled={atualizando || !filtradas.length} title="Pede ao robô os autos dos processos filtrados: só o que entrou desde o último download, e a IA lê só o novo">
          {atualizando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Atualizar autos ({filtradas.length})
        </Button>
        <Button variant="outline" onClick={() => void baixar()} disabled={baixando || !filtradas.length}>
          {baixando ? <LoaderCircle className="animate-spin" /> : <FileSpreadsheet />} Excel
        </Button>
      </BarraAba>

      <Painel>
        {!todas.length ? (
          <Vazio icone={FolderSearch} titulo="Nenhum processo da área Trabalhista no cadastro" />
        ) : !filtradas.length ? (
          <Vazio icone={SearchX} titulo="Nenhum processo com esses filtros" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[96rem] text-left text-sm">
              <thead className="border-b border-[#e6eef0] bg-[#f7fbfc] text-xs font-medium text-muted-foreground">
                <tr>
                  {COLUNAS.map(({ titulo }) => {
                    const ativa = ordem?.coluna === titulo ? ordem : null;
                    const Seta = !ativa ? ArrowUpDown : ativa.sentido === 1 ? ArrowUp : ArrowDown;
                    return (
                      <th key={titulo} scope="col" className="whitespace-nowrap px-3 py-2 font-medium" aria-sort={!ativa ? "none" : ativa.sentido === 1 ? "ascending" : "descending"}>
                        <button type="button" onClick={() => ordenarPor(titulo)} className={cn("inline-flex items-center gap-1 hover:text-[#10293a]", ativa && "text-[#10293a]")}>
                          {titulo}
                          <Seta className={cn("size-3.5", !ativa && "opacity-40")} aria-hidden />
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e6eef0] align-top">
                {ordenadas.map((linha) => (
                  <tr key={linha.id} className="hover:bg-[#f6fafb]">
                    <td className="min-w-[16rem] px-3 py-2.5">
                      <Link href={`/operacoes-legais/processos/${linha.id}?de=trabalhista`} className="flex min-w-0 max-w-[24rem] items-start gap-2.5 hover:underline">
                        <LogoGrupo grupo={linha.grupoCliente} tamanho="md" />
                        <span className="min-w-0">
                          <span className="block truncate font-semibold tabular-nums text-[#10293a]">{linha.cnj ?? "Sem número CNJ"}</span>
                          <span className="line-clamp-2 text-xs text-muted-foreground" title={linha.reclamante ?? undefined}>
                            CI {linha.ci ?? "—"} · {linha.reclamante ?? "reclamante não cadastrado"}
                          </span>
                        </span>
                      </Link>
                    </td>
                    <td className="min-w-[13rem] max-w-[18rem] px-3 py-2.5 text-xs">
                      {linha.advogadosReclamante.length ? (
                        <ul className="space-y-1">
                          {linha.advogadosReclamante.map((item) => (
                            <li key={item.nome}>
                              <span className="font-medium text-foreground">{item.nome}</span>
                              {item.oab ? <span className="text-muted-foreground"> · OAB {item.oab}</span> : null}
                              <p className={item.emails.length ? "break-all text-muted-foreground" : "text-amber-700"}>{item.emails.join(", ") || "sem e-mail"}</p>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <span className="text-amber-700">não cadastrado</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      <AtualizacaoDosAutosNaLinha autos={linha.autos} hoje={hoje} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Selo tom={linha.encerrado ? "neutro" : "marca"}>{linha.encerrado ? "Encerrado" : "Ativo"}</Selo>
                      {linha.fase ? <p className="mt-1 text-xs text-muted-foreground">{linha.fase}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {linha.admissao || linha.termino ? (
                        <p className="tabular-nums">
                          {br(linha.admissao) ?? "?"} a {br(linha.termino) ?? "?"}
                        </p>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                      {linha.tipoTermino ? <p className="text-muted-foreground">{linha.tipoTermino}</p> : null}
                      {linha.afastamentos ? <p className="text-muted-foreground">{linha.afastamentos} afastamento{linha.afastamentos === 1 ? "" : "s"} INSS</p> : null}
                    </td>
                    <td className="px-3 py-2.5 text-xs">{linha.laudo ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs">
                      {linha.decisao ?? <span className="text-muted-foreground">—</span>}
                      {linha.transito ? <p className="text-muted-foreground">trânsito {br(linha.transito)}</p> : null}
                      {linha.prescricao ? <p className="max-w-[14rem] whitespace-normal text-muted-foreground">Prescrição: {linha.prescricao}</p> : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs tabular-nums">
                      {linha.pedidos ? (
                        <>
                          {linha.pedidos} pedido{linha.pedidos === 1 ? "" : "s"}
                          <p className={linha.pedidosDeferidos ? "text-red-700" : "text-muted-foreground"}>{linha.pedidosDeferidos} com condenação</p>
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">
                      <span className="font-medium text-[#10293a]">{real(linha.riscoTotal)}</span>
                      {linha.riscoValor !== null ? (
                        <p className="text-xs text-muted-foreground">
                          {real(linha.riscoValor)} + {real(linha.riscoReflexos)}
                        </p>
                      ) : null}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Selo tom={TOM_STATUS[linha.negociacao]}>{rotuloDoStatus(linha.negociacao)}</Selo>
                      {linha.valorMaximoCliente !== null ? <p className="mt-1 text-xs tabular-nums text-muted-foreground">máx. {real(linha.valorMaximoCliente)}</p> : null}
                    </td>
                    <td className="min-w-[11rem] px-3 py-2.5">
                      <BarraPreenchimento feitos={linha.saneamento.feitos} total={linha.saneamento.total} percentual={linha.saneamento.percentual} />
                      {linha.saneamento.faltando.length ? (
                        <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground" title={linha.saneamento.faltando.join("\n")}>
                          Falta: {linha.saneamento.faltando.join(", ")}
                        </p>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Painel>
    </div>
  );
}
