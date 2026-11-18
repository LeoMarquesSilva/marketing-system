"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ListPlus, LoaderCircle, PencilLine, Plus, RefreshCw, SearchX, ToggleLeft, ToggleRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UFS, definicaoDaLista, normalizar, type Opcao } from "@/lib/processos/opcoes";
import type { ResumoDaLista } from "@/lib/processos/opcoes-server";
import { cn } from "@/lib/utils";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Busca, Carregando, Painel, PainelTopo, Selo, Vazio, linhaLista } from "../vistagem/ui";
import { AcessoProcessos } from "./acesso-processos";
import { limparCacheDeOpcoes } from "./opcoes-client";
import { mensagemDeErro, processosApi } from "./processos-api";

const PASSO = 200;
const OPCOES_UF = UFS.map((uf) => ({ valor: uf, rotulo: uf }));
const SITUACOES = [
  { valor: "ativas", rotulo: "Ativas" },
  { valor: "desativadas", rotulo: "Desativadas" },
  { valor: "todas", rotulo: "Todas" },
];

export function CadastrosClient() {
  return (
    <AcessoProcessos>
      <Cadastros />
    </AcessoProcessos>
  );
}

/**
 * As listas dos campos de escolha do processo, como os Cadastros do VIOS: incluir, corrigir o nome e
 * desativar. Opção desativada some da escolha, mas os processos que já a usam continuam com ela.
 */
function Cadastros() {
  const [listas, setListas] = useState<ResumoDaLista[] | null>(null);
  const [erro, setErro] = useState("");
  const [tentativa, setTentativa] = useState(0);
  const [escolhida, setEscolhida] = useState("justica");

  useEffect(() => {
    let vivo = true;
    processosApi.get<{ listas: ResumoDaLista[] }>("/opcoes").then(
      (resposta) => {
        if (!vivo) return;
        setListas(resposta.listas);
        setErro("");
      },
      (falha: unknown) => vivo && setErro(mensagemDeErro(falha)),
    );
    return () => {
      vivo = false;
    };
  }, [tentativa]);

  if (!listas && !erro) return <Carregando rotulo="Carregando os cadastros" />;

  const atual = listas?.find((lista) => lista.chave === escolhida) ?? null;

  return (
    <div className="space-y-4">
      {erro ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => setTentativa((valor) => valor + 1)}>
              <RefreshCw /> Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <Painel>
          <PainelTopo titulo="Listas" descricao="Campos de escolha do processo." />
          <ul className="divide-y divide-[#e6eef0]">
            {(listas ?? []).map((lista) => (
              <li key={lista.chave}>
                <button
                  type="button"
                  onClick={() => setEscolhida(lista.chave)}
                  aria-current={lista.chave === escolhida ? "true" : undefined}
                  className={cn(linhaLista(lista.chave === escolhida), "flex w-full items-center gap-3 text-left")}
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">{lista.rotulo}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{lista.ativas.toLocaleString("pt-BR")}</span>
                </button>
              </li>
            ))}
          </ul>
        </Painel>

        {atual ? (
          <ListaDeOpcoes
            key={atual.chave}
            lista={atual}
            onMudou={() => {
              limparCacheDeOpcoes();
              setTentativa((valor) => valor + 1);
            }}
          />
        ) : null}
      </div>
    </div>
  );
}

function descricaoDaOpcao(opcao: Opcao): string | null {
  const extra = opcao.extra;
  const partes: string[] = [];
  if (typeof extra.cidade === "string" && extra.cidade) partes.push(extra.cidade);
  if (typeof extra.uf === "string" && extra.uf) partes.push(extra.uf);
  if (Array.isArray(extra.justicas) && extra.justicas.length) partes.push((extra.justicas as string[]).join(", "));
  if (typeof extra.jurisdicao === "string" && extra.jurisdicao) partes.push(extra.jurisdicao);
  if (typeof extra.tipo === "string" && extra.tipo) partes.push(extra.tipo);
  if (typeof extra.oposta === "string" && extra.oposta) partes.push(`parte oposta: ${extra.oposta}`);
  return partes.length ? partes.join(" · ") : null;
}

function ListaDeOpcoes({ lista, onMudou }: { lista: ResumoDaLista; onMudou: () => void }) {
  const porUf = Boolean(definicaoDaLista(lista.chave)?.porUf);
  const [uf, setUf] = useState("SP");
  const [opcoes, setOpcoes] = useState<{
    chave: string;
    itens: Opcao[];
  } | null>(null);
  const [erro, setErro] = useState("");
  const [busca, setBusca] = useState("");
  const [situacao, setSituacao] = useState("ativas");
  const [visiveis, setVisiveis] = useState(PASSO);
  const [incluindo, setIncluindo] = useState(false);
  const [aviso, setAviso] = useState("");

  const chave = `${lista.chave}|${porUf ? uf : ""}`;
  useEffect(() => {
    let vivo = true;
    const parametros = new URLSearchParams({ lista: lista.chave });
    if (porUf) parametros.set("uf", uf);
    processosApi.get<{ opcoes: Opcao[] }>(`/opcoes?${parametros}`).then(
      (resposta) => {
        if (!vivo) return;
        setOpcoes({ chave, itens: resposta.opcoes });
        setErro("");
      },
      (falha: unknown) => vivo && setErro(mensagemDeErro(falha)),
    );
    return () => {
      vivo = false;
    };
  }, [chave, lista.chave, porUf, uf]);

  const carregadas = opcoes?.chave === chave ? opcoes.itens : null;
  const filtradas = useMemo(() => {
    const termos = normalizar(busca).split(" ").filter(Boolean);
    return (carregadas ?? []).filter(
      (opcao) => (situacao === "todas" || (situacao === "ativas" ? opcao.ativo : !opcao.ativo)) && termos.every((termo) => normalizar(`${opcao.valor} ${descricaoDaOpcao(opcao) ?? ""}`).includes(termo)),
    );
  }, [carregadas, busca, situacao]);

  function trocar(atualizada: Opcao, mensagem: string) {
    setOpcoes((atual) =>
      atual
        ? {
            ...atual,
            itens: atual.itens.map((item) => (item.id === atualizada.id ? atualizada : item)),
          }
        : atual,
    );
    setAviso(mensagem);
    onMudou();
  }

  function incluida(nova: Opcao) {
    setOpcoes((atual) => (atual ? { ...atual, itens: [nova, ...atual.itens] } : atual));
    setIncluindo(false);
    setBusca("");
    setSituacao("ativas");
    setAviso(`"${nova.valor}" incluída na lista.`);
    onMudou();
  }

  return (
    <Painel>
      <PainelTopo
        titulo={lista.rotulo}
        descricao={
          <>
            {lista.ativas.toLocaleString("pt-BR")} ativa
            {lista.ativas === 1 ? "" : "s"}
            {lista.total > lista.ativas ? ` · ${(lista.total - lista.ativas).toLocaleString("pt-BR")} desativada${lista.total - lista.ativas === 1 ? "" : "s"}` : ""}
            {" · carga inicial: "}
            {lista.origemVios}
          </>
        }
      >
        <Button size="sm" onClick={() => setIncluindo(true)} disabled={incluindo}>
          <ListPlus /> Incluir opção
        </Button>
      </PainelTopo>

      <div className="flex flex-wrap items-center gap-2 border-b border-[#e6eef0] px-4 py-3">
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Buscar na lista" aria-label={`Buscar em ${lista.rotulo.toLowerCase()}`} className="sm:w-72" />
        {porUf ? <Seletor valor={uf} onChange={setUf} opcoes={OPCOES_UF} rotulo="UF" className="w-24" /> : null}
        <Seletor valor={situacao} onChange={setSituacao} opcoes={SITUACOES} rotulo="Situação das opções" className="w-36" />
        <span className="ml-auto text-xs tabular-nums text-muted-foreground">{carregadas ? `${filtradas.length.toLocaleString("pt-BR")} ${filtradas.length === 1 ? "opção" : "opções"}` : ""}</span>
      </div>

      {aviso ? (
        <Aviso
          tom="sucesso"
          className="mx-4 mt-3"
          acao={
            <Button size="sm" variant="ghost" className="-my-1" onClick={() => setAviso("")} aria-label="Fechar aviso">
              <X />
            </Button>
          }
        >
          {aviso}
        </Aviso>
      ) : null}
      {erro ? (
        <Aviso tom="erro" className="mx-4 mt-3">
          {erro}
        </Aviso>
      ) : null}

      {incluindo ? <NovaOpcao lista={lista} porUf={porUf} ufInicial={uf} onCancelar={() => setIncluindo(false)} onIncluida={incluida} /> : null}

      {!carregadas && !erro ? (
        <Carregando rotulo="Carregando as opções" className="py-10" />
      ) : !filtradas.length ? (
        <Vazio icone={SearchX} titulo={busca ? "Nada encontrado nesta lista" : "Nenhuma opção aqui"} />
      ) : (
        <>
          <ul className="divide-y divide-[#e6eef0]">
            {filtradas.slice(0, visiveis).map((opcao) => (
              <LinhaDaOpcao key={opcao.id} opcao={opcao} onSalva={trocar} />
            ))}
          </ul>
          {filtradas.length > visiveis ? (
            <div className="border-t border-[#e6eef0] px-4 py-3 text-center">
              <Button variant="outline" size="sm" onClick={() => setVisiveis((atual) => atual + PASSO)}>
                Mostrar mais ({(filtradas.length - visiveis).toLocaleString("pt-BR")})
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Painel>
  );
}

function NovaOpcao({ lista, porUf, ufInicial, onCancelar, onIncluida }: { lista: ResumoDaLista; porUf: boolean; ufInicial: string; onCancelar: () => void; onIncluida: (opcao: Opcao) => void }) {
  const [valor, setValor] = useState("");
  const [uf, setUf] = useState(ufInicial);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const resposta = await processosApi.post<{ opcao: Opcao }>("/opcoes", {
        lista: lista.chave,
        valor,
        uf: porUf ? uf : null,
      });
      onIncluida(resposta.opcao);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-2 border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          autoFocus
          value={valor}
          onChange={(evento) => setValor(evento.target.value)}
          onKeyDown={(evento) => {
            if (evento.key === "Enter" && valor.trim()) void salvar();
            if (evento.key === "Escape") onCancelar();
          }}
          placeholder={`Nova opção em ${lista.rotulo.toLowerCase()}`}
          aria-label="Nome da nova opção"
          className="min-w-56 flex-1"
        />
        {porUf ? <Seletor valor={uf} onChange={setUf} opcoes={OPCOES_UF} rotulo="UF da nova opção" className="w-24" /> : null}
        <Button size="sm" onClick={() => void salvar()} disabled={salvando || !valor.trim()}>
          {salvando ? <LoaderCircle className="animate-spin" /> : <Plus />} Incluir
        </Button>
        <Button size="sm" variant="ghost" onClick={onCancelar} disabled={salvando}>
          Cancelar
        </Button>
      </div>
      {erro ? <p className="text-xs text-red-700">{erro}</p> : null}
    </div>
  );
}

function LinhaDaOpcao({ opcao, onSalva }: { opcao: Opcao; onSalva: (opcao: Opcao, mensagem: string) => void }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState(opcao.valor);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const descricao = descricaoDaOpcao(opcao);

  async function salvar(corpo: { valor?: string; ativo?: boolean }, mensagem: string) {
    setSalvando(true);
    setErro("");
    try {
      const resposta = await processosApi.patch<{ opcao: Opcao }>(`/opcoes/${opcao.id}`, corpo);
      setEditando(false);
      setSalvando(false);
      onSalva(resposta.opcao, mensagem);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  }

  return (
    <li className={cn("px-4 py-2.5", !opcao.ativo && "bg-[#fafbfc]")}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {editando ? (
          <Input
            autoFocus
            value={valor}
            onChange={(evento) => setValor(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === "Enter" && valor.trim()) void salvar({ valor }, "Nome corrigido.");
              if (evento.key === "Escape") setEditando(false);
            }}
            aria-label="Nome da opção"
            className="h-8 min-w-56 flex-1"
          />
        ) : (
          <div className="min-w-0 flex-1">
            <p className={cn("truncate text-sm", opcao.ativo ? "text-foreground" : "text-muted-foreground line-through decoration-muted-foreground/40")}>{opcao.valor}</p>
            {descricao ? <p className="truncate text-xs text-muted-foreground">{descricao}</p> : null}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <Selo tom={opcao.origem === "vios" ? "neutro" : "marca"} className="py-0 text-[11px]">
            {opcao.origem === "vios" ? "VIOS" : "Incluída aqui"}
          </Selo>
          {!opcao.ativo ? (
            <Selo tom="alerta" className="py-0 text-[11px]">
              Desativada
            </Selo>
          ) : null}
          {editando ? (
            <>
              <Button size="sm" variant="outline" className="h-8" onClick={() => void salvar({ valor }, "Nome corrigido.")} disabled={salvando || !valor.trim()}>
                {salvando ? <LoaderCircle className="animate-spin" /> : <Check />} Salvar
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={() => setEditando(false)} disabled={salvando}>
                Cancelar
              </Button>
            </>
          ) : (
            <>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => {
                  setValor(opcao.valor);
                  setEditando(true);
                }}
                disabled={salvando}
                aria-label={`Corrigir o nome de ${opcao.valor}`}
              >
                <PencilLine />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8"
                onClick={() => void salvar({ ativo: !opcao.ativo }, opcao.ativo ? `"${opcao.valor}" desativada.` : `"${opcao.valor}" ativada de novo.`)}
                disabled={salvando}
                title={opcao.ativo ? "Desativar: some da escolha; os processos que já a usam continuam com ela." : "Ativar de novo"}
              >
                {salvando ? <LoaderCircle className="animate-spin" /> : opcao.ativo ? <ToggleRight className="text-[#347796]" /> : <ToggleLeft />}
                {opcao.ativo ? "Desativar" : "Ativar"}
              </Button>
            </>
          )}
        </div>
      </div>
      {erro ? <p className="mt-1 text-xs text-red-700">{erro}</p> : null}
    </li>
  );
}
