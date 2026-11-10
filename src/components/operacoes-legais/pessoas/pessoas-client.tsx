"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, CopyCheck, Link2, LoaderCircle, Plus, RefreshCw, SearchX, UserRoundSearch, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PessoaDetalhe, PessoaResumo, ResultadoCargaPessoas, ResumoPessoas } from "@/lib/processos/types";
import { AcessoProcessos } from "../processos/acesso-processos";
import { formatarDataHora, mensagemDeErro, pessoasApi } from "../processos/processos-api";
import { Seletor } from "../vistagem/seletor";
import { Aviso, BarraAba, Busca, CabecalhoLista, Carregando, Indicador, Indicadores, Painel, Selo, Vazio, linhaLista } from "../vistagem/ui";
import { EditarPessoa } from "./editar-pessoa";
import { IconePessoa, tomDaCategoria } from "./pessoa-ui";

const COLUNAS = "lg:grid lg:grid-cols-[minmax(0,1.6fr)_11rem_minmax(0,1fr)_9rem] lg:items-center lg:gap-4";
const TIPOS = [
  { valor: "fisica", rotulo: "Pessoa física" },
  { valor: "juridica", rotulo: "Pessoa jurídica" },
];
const SITUACOES = [
  { valor: "com_processo", rotulo: "Com processo" },
  { valor: "sem_documento", rotulo: "Sem CPF/CNPJ" },
  { valor: "sem_vios", rotulo: "Sem ligação com o VIOS" },
];

interface Pagina {
  consulta: string;
  pessoas: PessoaResumo[];
  total: number;
  paginas: number;
}

export function PessoasClient() {
  return (
    <AcessoProcessos>
      <Lista />
    </AcessoProcessos>
  );
}

function Lista() {
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  const [tipo, setTipo] = useState("");
  const [situacao, setSituacao] = useState("");
  const [pagina, setPagina] = useState<Pagina | null>(null);
  const [resumo, setResumo] = useState<ResumoPessoas | null>(null);
  const [erro, setErro] = useState("");
  const [carga, setCarga] = useState<ResultadoCargaPessoas | null>(null);
  const [ocupado, setOcupado] = useState<"carga" | "mais" | "">("");
  const [nova, setNova] = useState(false);
  // Soma um a cada recarga pedida (carga do VIOS, pessoa nova).
  const [versao, setVersao] = useState(0);

  // A busca só vai ao servidor quando a pessoa para de digitar.
  useEffect(() => {
    const espera = window.setTimeout(() => setBuscaAplicada(busca.trim()), 350);
    return () => window.clearTimeout(espera);
  }, [busca]);

  const consulta = `q=${encodeURIComponent(buscaAplicada)}&tipo=${tipo}&situacao=${situacao}`;

  useEffect(() => {
    let vivo = true;
    pessoasApi.get<{ pessoas: PessoaResumo[]; total: number; resumo: ResumoPessoas }>(`?${consulta}&resumo=1`).then(
      (resposta) => {
        if (!vivo) return;
        setPagina({ consulta, pessoas: resposta.pessoas, total: resposta.total, paginas: 1 });
        setResumo(resposta.resumo);
        setErro("");
      },
      (falha: unknown) => {
        if (vivo) setErro(mensagemDeErro(falha));
      }
    );
    return () => {
      vivo = false;
    };
  }, [consulta, versao]);

  async function mostrarMais() {
    if (!pagina) return;
    setOcupado("mais");
    try {
      const resposta = await pessoasApi.get<{ pessoas: PessoaResumo[]; total: number }>(`?${pagina.consulta}&pagina=${pagina.paginas}`);
      setPagina((atual) => (atual && atual.consulta === pagina.consulta ? { ...atual, pessoas: [...atual.pessoas, ...resposta.pessoas], total: resposta.total, paginas: atual.paginas + 1 } : atual));
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  async function atualizarPeloVios() {
    setOcupado("carga");
    setErro("");
    setCarga(null);
    try {
      const resposta = await pessoasApi.post<{ resultado: ResultadoCargaPessoas; resumo: ResumoPessoas }>("/carga");
      setCarga(resposta.resultado);
      setVersao((atual) => atual + 1);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  if (!pagina && !erro) return <Carregando rotulo="Carregando as pessoas" />;

  const carregandoFiltro = pagina?.consulta !== consulta;
  const pessoas = pagina?.pessoas ?? [];
  const filtrando = Boolean(buscaAplicada || tipo || situacao);

  return (
    <div className="space-y-4">
      {resumo ? (
        <Indicadores>
          <Indicador icone={Users} rotulo="Pessoas no cadastro" valor={resumo.total}>
            partes, clientes, sócios, fiadores e advogados
          </Indicador>
          <Indicador icone={BadgeCheck} rotulo="Com CPF/CNPJ" valor={resumo.comDocumento} tom={resumo.total && resumo.comDocumento === resumo.total ? "sucesso" : "neutro"}>
            {resumo.total ? `${Math.round((resumo.comDocumento / resumo.total) * 100)}% do cadastro` : "—"}
          </Indicador>
          <Indicador icone={Link2} rotulo="Ligadas ao VIOS" valor={resumo.ligadasAoVios}>
            {resumo.ultimaCarga ? `última carga em ${formatarDataHora(resumo.ultimaCarga.quando)}` : "nenhuma carga ainda"}
          </Indicador>
          <Indicador icone={CopyCheck} rotulo="Possíveis repetidas" valor={resumo.gruposDuplicados} tom={resumo.gruposDuplicados ? "alerta" : "sucesso"}>
            {resumo.gruposDuplicados ? (
              <Link href="/operacoes-legais/pessoas/duplicadas" className="text-[#347796] underline-offset-4 hover:underline">
                Conferir e unificar
              </Link>
            ) : (
              "nenhum grupo a conferir"
            )}
          </Indicador>
        </Indicadores>
      ) : null}

      {erro ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => setVersao((atual) => atual + 1)}>
              <RefreshCw /> Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : null}
      {carga ? (
        <Aviso tom={carga.avisos.length ? "alerta" : "sucesso"} titulo="Cadastro atualizado pelo VIOS">
          {carga.ligadas} ligada{carga.ligadas === 1 ? "" : "s"} ao VIOS, {carga.unificadas} repetida{carga.unificadas === 1 ? "" : "s"} unificada{carga.unificadas === 1 ? "" : "s"}, {carga.importadas} cliente
          {carga.importadas === 1 ? "" : "s"} importado{carga.importadas === 1 ? "" : "s"} e {carga.atualizadas} atualizada{carga.atualizadas === 1 ? "" : "s"}. O cadastro tem agora {carga.pessoas} pessoas.
          {carga.avisos.length ? `\n${carga.avisos.join("\n")}` : ""}
        </Aviso>
      ) : null}

      <BarraAba
        resumo={
          <span>
            <strong className="font-semibold text-foreground tabular-nums">{pagina?.total ?? 0}</strong> {pagina?.total === 1 ? "pessoa" : "pessoas"}
            {filtrando && resumo ? ` de ${resumo.total}` : ""}
          </span>
        }
      >
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Nome ou CPF/CNPJ" aria-label="Buscar pessoa" className="sm:w-72" />
        <Seletor valor={tipo} onChange={setTipo} opcoes={TIPOS} todos={{ rotulo: "Físicas e jurídicas" }} rotulo="Tipo de pessoa" className="sm:w-48" />
        <Seletor valor={situacao} onChange={setSituacao} opcoes={SITUACOES} todos={{ rotulo: "Todas" }} rotulo="Situação do cadastro" className="sm:w-56" />
        <Button variant="outline" onClick={() => void atualizarPeloVios()} disabled={Boolean(ocupado)} title="Liga as pessoas ao cadastro do VIOS, unifica as repetidas e traz documento, endereço e contato">
          {ocupado === "carga" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />} Atualizar pelo VIOS
        </Button>
        <Button onClick={() => setNova(true)}>
          <Plus /> Nova pessoa
        </Button>
      </BarraAba>

      <Painel className={carregandoFiltro ? "opacity-60 transition-opacity" : "transition-opacity"}>
        {!pessoas.length ? (
          filtrando ? (
            <Vazio icone={SearchX} titulo="Ninguém com esses filtros" />
          ) : (
            <Vazio icone={UserRoundSearch} titulo="Nenhuma pessoa no cadastro ainda">
              As pessoas chegam com a carga de processos. Use “Atualizar pelo VIOS” para completar o cadastro.
            </Vazio>
          )
        ) : (
          <>
            <CabecalhoLista className={`hidden ${COLUNAS}`}>
              <span>Pessoa</span>
              <span>CPF/CNPJ</span>
              <span>Categoria e grupo</span>
              <span>No cadastro</span>
            </CabecalhoLista>
            <ul className="divide-y divide-[#e6eef0]">
              {pessoas.map((pessoa) => (
                <li key={pessoa.id}>
                  <Link href={`/operacoes-legais/pessoas/${pessoa.id}`} className={`${linhaLista()} block space-y-2 lg:space-y-0 ${COLUNAS}`}>
                    <div className="flex min-w-0 items-center gap-3">
                      <IconePessoa tipo={pessoa.tipo} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#10293a]">{pessoa.nome}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {pessoa.viosCi ? `CI ${pessoa.viosCi} no VIOS` : "Sem ligação com o VIOS"}
                          {pessoa.oab ? ` · OAB ${pessoa.oab}` : ""}
                        </p>
                      </div>
                    </div>
                    <p className="text-sm tabular-nums text-foreground">{pessoa.documento ?? <span className="text-muted-foreground">Não informado</span>}</p>
                    <div className="flex min-w-0 flex-wrap items-center gap-1">
                      {pessoa.categoria ? <Selo tom={tomDaCategoria(pessoa.categoria)}>{pessoa.categoria}</Selo> : null}
                      {pessoa.grupoCliente ? <span className="truncate text-xs text-muted-foreground">{pessoa.grupoCliente}</span> : null}
                      {!pessoa.categoria && !pessoa.grupoCliente ? <span className="text-xs text-muted-foreground">—</span> : null}
                    </div>
                    <p className="text-xs tabular-nums text-muted-foreground">
                      <span className="font-medium text-foreground">{pessoa.processos}</span> processo{pessoa.processos === 1 ? "" : "s"}
                      <span className="block">
                        {pessoa.enderecos} endereço{pessoa.enderecos === 1 ? "" : "s"} · {pessoa.contatos} contato{pessoa.contatos === 1 ? "" : "s"}
                      </span>
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
            {pagina && pessoas.length < pagina.total ? (
              <div className="border-t border-[#e6eef0] p-3 text-center">
                <Button variant="outline" onClick={() => void mostrarMais()} disabled={Boolean(ocupado)}>
                  {ocupado === "mais" ? <LoaderCircle className="animate-spin" /> : null} Mostrar mais ({pagina.total - pessoas.length} restantes)
                </Button>
              </div>
            ) : null}
          </>
        )}
      </Painel>

      {nova ? (
        <EditarPessoa
          pessoa={null}
          onFechar={() => setNova(false)}
          onSalvo={(pessoa: PessoaDetalhe) => {
            setNova(false);
            window.location.assign(`/operacoes-legais/pessoas/${pessoa.id}`);
          }}
        />
      ) : null}
    </div>
  );
}
