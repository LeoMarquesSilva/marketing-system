"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Check, ClipboardCheck, FolderSearch, FolderX, LoaderCircle, RefreshCw, Search, SearchX, Send, UserRoundX, X } from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/auth-fetch";
import { ESCRITORIOS, type PastaSioe, type Pendencia } from "@/lib/vistagem/triagem";
import type { PendenciasControladoria, PublicacaoResumo, ResolucaoPendencia, TriagemResumo } from "@/lib/vistagem/types";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { AvisoArquivoDoDia } from "./aviso-arquivo-do-dia";
import { DadosPasta, DadosPublicacao, PENDENCIAS, TeorPublicacao, formatarData } from "./publicacao-ui";
import {
  Aviso,
  BarraAba,
  Busca,
  Campo,
  Carregando,
  Indicador,
  Indicadores,
  Painel,
  PainelTopo,
  Secao,
  Selo,
  Vazio,
  campoClasse,
} from "./ui";

type FiltroPendencia = Pendencia | "todas";

/** Rótulos curtos para o filtro; o selo de cada publicação usa o texto completo de PENDENCIAS. */
const PENDENCIA_CURTA: Record<Pendencia, string> = {
  sem_pasta: "Sem pasta",
  varias_pastas: "Várias pastas",
  ex_cliente: "Ex-cliente",
  sem_area: "Sem área",
  sem_grupo: "Sem grupo",
};

const ORDEM_PENDENCIAS: Pendencia[] = ["sem_pasta", "varias_pastas", "sem_area", "sem_grupo", "ex_cliente"];

function numeroProcesso(publicacao: PublicacaoResumo): string {
  return publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal;
}

/** Busca por número do processo (a partir de 4 dígitos), tribunal, órgão, pasta, grupo, cliente ou intimado. */
function combinaBusca(publicacao: PublicacaoResumo, busca: string): boolean {
  const texto = busca.trim().toLowerCase();
  if (!texto) return true;
  const digitos = busca.replace(/\D/g, "");
  if (digitos.length >= 4 && numeroProcesso(publicacao).replace(/\D/g, "").includes(digitos)) return true;
  return [
    publicacao.tribunal,
    publicacao.djenOrgao,
    publicacao.escritorioResponsavel,
    publicacao.grupoCliente,
    publicacao.cliente,
    publicacao.pastaCi,
    ...publicacao.djenIntimados,
  ].some((campo) => campo?.toLowerCase().includes(texto));
}

/** Pasta do SIOE como opção de uma lista: CI, vínculo e situação; grupo e cliente; área e responsável. */
function LinhaPasta({ pasta, acao }: { pasta: PastaSioe; acao?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2.5 px-3 py-3 text-xs text-muted-foreground">
      <div className="min-w-0 space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-mono text-sm font-semibold text-foreground">CI {pasta.ci}</span>
          {pasta.vinculo ? <span>{pasta.vinculo}</span> : null}
          {pasta.situacao ? <span>· {pasta.situacao}</span> : null}
        </p>
        <p>
          <span className="font-medium text-foreground">{pasta.grupoCliente || "sem grupo"}</span>
          {pasta.cliente ? ` · ${pasta.cliente}` : ""}
        </p>
        <p>
          {pasta.area || "sem área"}
          {pasta.advogadoResponsavel ? ` · Resp.: ${pasta.advogadoResponsavel}` : ""}
        </p>
      </div>
      {acao}
    </div>
  );
}

const LISTA_PASTAS = "divide-y divide-[#e6eef0] overflow-hidden rounded-md border border-[#dce9eb] bg-white";

function Resolucao({
  publicacao,
  onResolvida,
}: {
  publicacao: PublicacaoResumo;
  onResolvida: (id: string, escritorio: string | null) => void;
}) {
  const [ci, setCi] = useState("");
  const [previa, setPrevia] = useState<{ pasta: PastaSioe; escritorioSugerido: string | null } | null>(null);
  const [escritorio, setEscritorio] = useState("");
  const [grupo, setGrupo] = useState(publicacao.grupoCliente ?? "");
  const [demandaRisco, setDemandaRisco] = useState(Boolean(publicacao.demandaRisco));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");

  async function enviar(entrada: ResolucaoPendencia) {
    setOcupado(true);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/pendencias/${publicacao.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(entrada),
      });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao resolver.");
      onResolvida(publicacao.id, corpo.publicacao?.escritorioResponsavel ?? null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao resolver.");
    } finally {
      setOcupado(false);
    }
  }

  async function buscarCi() {
    setOcupado(true);
    setErro("");
    setPrevia(null);
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/sioe/pasta?ci=${encodeURIComponent(ci)}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "CI não encontrada.");
      setPrevia(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "CI não encontrada.");
    } finally {
      setOcupado(false);
    }
  }

  const candidatas = publicacao.pastasCandidatas;
  const base = `resolucao-${publicacao.id}`;

  return (
    <div className="min-w-0 border-t border-[#e6eef0] bg-[#fafcfc] lg:border-l lg:border-t-0">
      {candidatas.length > 1 ? (
        <Secao titulo="Escolha a pasta" id={`${base}-pastas`}>
          <ul className={LISTA_PASTAS}>
            {candidatas.map((pasta) => (
              <li key={pasta.ci}>
                <LinhaPasta
                  pasta={pasta}
                  acao={
                    <Button size="sm" variant="outline" className="self-start" onClick={() => enviar({ ci: pasta.ci })} disabled={ocupado}>
                      <Check />
                      Usar esta pasta
                    </Button>
                  }
                />
              </li>
            ))}
          </ul>
        </Secao>
      ) : null}

      {!publicacao.pastaCi && candidatas.length <= 1 ? (
        <Secao titulo="Pasta no VIOS" id={`${base}-ci`}>
          <div className="flex items-end gap-2">
            <Campo rotulo="CI da pasta (se existir)" className="min-w-0 flex-1">
              <Input
                value={ci}
                onChange={(evento) => setCi(evento.target.value)}
                placeholder="Número da CI"
                inputMode="numeric"
                aria-label="CI da pasta"
                onKeyDown={(evento) => {
                  if (evento.key === "Enter" && ci.trim()) void buscarCi();
                }}
              />
            </Campo>
            <Button variant="outline" onClick={buscarCi} disabled={ocupado || !ci.trim()}>
              <Search />
              Buscar no SIOE
            </Button>
          </div>
          {previa ? (
            <div className={LISTA_PASTAS}>
              <LinhaPasta
                pasta={previa.pasta}
                acao={
                  <Button size="sm" className="self-start" onClick={() => enviar({ ci: previa.pasta.ci })} disabled={ocupado}>
                    <Check />
                    Usar · {previa.escritorioSugerido ?? "definir escritório"}
                  </Button>
                }
              />
            </div>
          ) : null}
        </Secao>
      ) : null}

      <Secao
        titulo={publicacao.pastaCi || candidatas.length > 1 ? "Ou informe os dados" : "Sem pasta: informe os dados"}
        id={`${base}-dados`}
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          <Campo rotulo="Escritório responsável">
            <select
              value={escritorio}
              onChange={(evento) => setEscritorio(evento.target.value)}
              className={campoClasse}
              aria-label="Escritório responsável"
            >
              <option value="">Escolha o escritório</option>
              {ESCRITORIOS.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo rotulo="Grupo do cliente">
            <Input
              value={grupo}
              onChange={(evento) => setGrupo(evento.target.value)}
              placeholder="Grupo do cliente"
              aria-label="Grupo do cliente"
            />
          </Campo>
        </div>
        <label className="flex min-h-10 w-fit cursor-pointer items-center gap-2.5 text-sm text-foreground">
          <input
            type="checkbox"
            checked={demandaRisco}
            onChange={(evento) => setDemandaRisco(evento.target.checked)}
            className="size-4 accent-[#347796]"
          />
          Demanda de risco
        </label>
        <Button
          className="w-full sm:w-auto lg:w-full"
          onClick={() => enviar({ escritorio, grupo, demandaRisco, ci: publicacao.pastaCi ?? undefined })}
          disabled={ocupado || !escritorio || !grupo.trim()}
        >
          {ocupado ? <LoaderCircle className="animate-spin" /> : <Send />}
          Liberar para o jurídico
        </Button>
      </Secao>

      {erro ? (
        <div className="px-4 pb-4">
          <Aviso tom="erro">{erro}</Aviso>
        </div>
      ) : null}
    </div>
  );
}

/** Linha principal da publicação: processo em mono, tribunal, data e, à direita, o selo da pendência. */
function CabecalhoPublicacao({ publicacao, comPendencia = false }: { publicacao: PublicacaoResumo; comPendencia?: boolean }) {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      <span className="font-mono text-sm font-semibold text-foreground">{numeroProcesso(publicacao)}</span>
      {publicacao.tribunal ? <Selo>{publicacao.tribunal}</Selo> : null}
      <span className="text-xs text-muted-foreground">publicação {formatarData(publicacao.dataPublicacao)}</span>
      {comPendencia && publicacao.pendencia ? (
        <Selo tom="alerta" className="sm:ml-auto">
          {PENDENCIAS[publicacao.pendencia]}
        </Selo>
      ) : null}
    </div>
  );
}

function CorpoPublicacao({ publicacao }: { publicacao: PublicacaoResumo }) {
  return (
    <>
      <DadosPasta publicacao={{ ...publicacao, pendencia: null }} />
      <DadosPublicacao publicacao={publicacao} />
      <TeorPublicacao publicacao={publicacao} />
    </>
  );
}

function Controladoria() {
  const [dados, setDados] = useState<PendenciasControladoria | null>(null);
  const [erro, setErro] = useState("");
  const [triando, setTriando] = useState(false);
  const [aviso, setAviso] = useState<{ tom: "sucesso" | "info" | "erro"; texto: string } | null>(null);
  const [busca, setBusca] = useState("");
  const [tipo, setTipo] = useState<FiltroPendencia>("todas");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/controladoria");
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar as pendências.");
      setDados(corpo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as pendências.");
      setDados({ pendentes: [], exClientes: [] });
    }
  }, []);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function rodarTriagem() {
    setTriando(true);
    setAviso(null);
    try {
      const resposta = await authFetch("/api/operacoes-legais/vistagem/triagem", { method: "POST" });
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha na triagem.");
      const resumo = corpo as TriagemResumo;
      setAviso(
        resumo.triadas
          ? {
              tom: "sucesso",
              texto: `${resumo.triadas} publicação(ões) triada(s): ${resumo.juridico} para o jurídico, ${resumo.pendentes} ainda pendente(s)${resumo.descartadas ? `, ${resumo.descartadas} descartada(s)` : ""}.`,
            }
          : { tom: "info", texto: "Nada novo para triar." }
      );
      await carregar();
    } catch (e) {
      setAviso({ tom: "erro", texto: e instanceof Error ? e.message : "Falha na triagem." });
    } finally {
      setTriando(false);
    }
  }

  function removerResolvida(id: string, escritorio: string | null) {
    const publicacao = dados?.pendentes.find((p) => p.id === id);
    setDados((atual) => (atual ? { ...atual, pendentes: atual.pendentes.filter((p) => p.id !== id) } : atual));
    setAviso({
      tom: "sucesso",
      texto: `${publicacao ? numeroProcesso(publicacao) : "Publicação"} liberada para o jurídico${escritorio ? ` (${escritorio})` : ""}.`,
    });
  }

  const porTipo = useMemo(() => {
    const total = new Map<Pendencia, number>();
    for (const p of dados?.pendentes ?? []) {
      if (p.pendencia) total.set(p.pendencia, (total.get(p.pendencia) ?? 0) + 1);
    }
    return total;
  }, [dados]);

  const maisAntiga = useMemo(
    () =>
      (dados?.pendentes ?? [])
        .map((p) => p.dataPublicacao)
        .filter((data): data is string => Boolean(data))
        .sort()[0] ?? null,
    [dados]
  );

  const pendentesVisiveis = useMemo(
    () => (dados?.pendentes ?? []).filter((p) => (tipo === "todas" || p.pendencia === tipo) && combinaBusca(p, busca)),
    [dados, tipo, busca]
  );
  const exClientesVisiveis = useMemo(() => (dados?.exClientes ?? []).filter((p) => combinaBusca(p, busca)), [dados, busca]);

  const tiposPresentes = ORDEM_PENDENCIAS.filter((valor) => porTipo.has(valor) || tipo === valor);
  const aConfirmar = (porTipo.get("varias_pastas") ?? 0) + (porTipo.get("sem_area") ?? 0) + (porTipo.get("sem_grupo") ?? 0);
  const buscando = busca.trim() !== "";

  return (
    <div className="space-y-6">
      <AvisoArquivoDoDia
        acao={
          <Button asChild size="sm" variant="outline" className="-my-1 shrink-0">
            <Link href="/operacoes-legais/vistagem">Abrir Captura</Link>
          </Button>
        }
      />

      <div className="space-y-3">
        <BarraAba resumo="O que a triagem com o SIOE não conseguiu encaminhar sozinha e as publicações de ex-clientes, que a controladoria vista. Ex-cliente sem Ricardo Viscardi Pires ou Gustavo Bismarchi Motta na publicação é descartado automaticamente.">
          <Busca
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Processo, CI, grupo ou intimado"
            aria-label="Buscar publicação"
          />
          <Button variant="outline" onClick={rodarTriagem} disabled={triando}>
            {triando ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
            Rodar triagem agora
          </Button>
        </BarraAba>

        {aviso ? (
          <Aviso
            tom={aviso.tom}
            acao={
              <Button variant="ghost" size="icon-xs" className="-my-1 text-current" aria-label="Fechar aviso" onClick={() => setAviso(null)}>
                <X />
              </Button>
            }
          >
            {aviso.texto}
          </Aviso>
        ) : null}
      </div>

      {dados === null ? (
        <Painel>
          <Carregando rotulo="Carregando pendências" />
        </Painel>
      ) : erro ? (
        <Aviso
          tom="erro"
          titulo="Não foi possível carregar as pendências"
          acao={
            <Button
              size="sm"
              variant="outline"
              className="-my-1 shrink-0"
              onClick={() => {
                setDados(null);
                void carregar();
              }}
            >
              Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : (
        <>
          <Indicadores>
            <Indicador icone={ClipboardCheck} rotulo="Para resolver" valor={dados.pendentes.length} tom={dados.pendentes.length ? "alerta" : "neutro"}>
              {maisAntiga ? `Publicação mais antiga: ${formatarData(maisAntiga)}` : "Nenhuma pendência de triagem"}
            </Indicador>
            <Indicador icone={FolderX} rotulo="Sem pasta no VIOS" valor={porTipo.get("sem_pasta") ?? 0}>
              Possível abertura de pasta
            </Indicador>
            <Indicador icone={FolderSearch} rotulo="Pasta ou dados a confirmar" valor={aConfirmar}>
              {`${porTipo.get("varias_pastas") ?? 0} com várias pastas · ${porTipo.get("sem_area") ?? 0} sem área · ${porTipo.get("sem_grupo") ?? 0} sem grupo`}
            </Indicador>
            <Indicador icone={UserRoundX} rotulo="Ex-clientes" valor={dados.exClientes.length}>
              Vistagem da controladoria
            </Indicador>
          </Indicadores>

          <Painel aria-labelledby="pendentes-titulo">
            <PainelTopo
              id="pendentes-titulo"
              titulo={
                <>
                  Para resolver
                  <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                    {pendentesVisiveis.length !== dados.pendentes.length
                      ? `${pendentesVisiveis.length} de ${dados.pendentes.length}`
                      : dados.pendentes.length}
                  </span>
                </>
              }
              descricao="Escolha a pasta certa ou informe escritório e grupo para liberar ao jurídico."
            >
              {tiposPresentes.length > 1 ? (
                <Segmented
                  label="Filtrar por pendência"
                  value={tipo}
                  options={[
                    { value: "todas" as FiltroPendencia, label: `Todas ${dados.pendentes.length}` },
                    ...tiposPresentes.map((valor) => ({ value: valor as FiltroPendencia, label: `${PENDENCIA_CURTA[valor]} ${porTipo.get(valor) ?? 0}` })),
                  ]}
                  onChange={setTipo}
                />
              ) : null}
            </PainelTopo>

            {dados.pendentes.length === 0 ? (
              <Vazio icone={ClipboardCheck} titulo="Nenhuma pendência de triagem">
                Tudo o que chegou foi encaminhado para uma área.
              </Vazio>
            ) : pendentesVisiveis.length === 0 ? (
              <Vazio icone={SearchX} titulo="Nenhuma pendência com esse filtro">
                <Button
                  variant="link"
                  className="h-auto p-0"
                  onClick={() => {
                    setTipo("todas");
                    setBusca("");
                  }}
                >
                  Limpar filtros
                </Button>
              </Vazio>
            ) : (
              <ul className="divide-y divide-[#dce9eb]">
                {pendentesVisiveis.map((publicacao) => (
                  <li key={publicacao.id} className="grid lg:grid-cols-[minmax(0,1fr)_minmax(19rem,24rem)]">
                    <div className="min-w-0 space-y-2.5 px-4 py-4">
                      <CabecalhoPublicacao publicacao={publicacao} comPendencia />
                      <CorpoPublicacao publicacao={publicacao} />
                    </div>
                    <Resolucao publicacao={publicacao} onResolvida={removerResolvida} />
                  </li>
                ))}
              </ul>
            )}
          </Painel>

          <Painel aria-labelledby="ex-clientes-titulo">
            <PainelTopo
              id="ex-clientes-titulo"
              titulo={
                <>
                  Ex-clientes
                  <span className="ml-2 font-normal tabular-nums text-muted-foreground">
                    {buscando ? `${exClientesVisiveis.length} de ${dados.exClientes.length}` : dados.exClientes.length}
                  </span>
                </>
              }
              descricao="Vistagem da controladoria."
            />
            {dados.exClientes.length === 0 ? (
              <Vazio icone={UserRoundX} titulo="Nenhuma publicação de ex-cliente" />
            ) : exClientesVisiveis.length === 0 ? (
              <Vazio icone={SearchX} titulo="Nenhum ex-cliente com essa busca" />
            ) : (
              <ul className="divide-y divide-[#eef3f5]">
                {exClientesVisiveis.map((publicacao) => (
                  <li key={publicacao.id} className="space-y-2.5 px-4 py-4">
                    <CabecalhoPublicacao publicacao={publicacao} />
                    <CorpoPublicacao publicacao={publicacao} />
                  </li>
                ))}
              </ul>
            )}
          </Painel>
        </>
      )}
    </div>
  );
}

export function ControladoriaClient() {
  return (
    <AcessoOperacoesLegais>
      <Controladoria />
    </AcessoOperacoesLegais>
  );
}
