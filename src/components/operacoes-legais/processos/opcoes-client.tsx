"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import type { CampoProcesso } from "@/lib/processos/campos";
import { definicaoDaLista, opcoesParaCampo, type Opcao } from "@/lib/processos/opcoes";
import { cn } from "@/lib/utils";
import { SeletorBusca, type OpcaoSeletor } from "../vistagem/seletor";
import { processosApi } from "./processos-api";

/** Opções dos campos de escolha (Cadastros), com cache por lista e UF enquanto a página estiver aberta. */
const cache = new Map<string, Promise<Opcao[]>>();

/** Depois de mexer em Cadastros: a próxima edição busca as listas de novo. */
export function limparCacheDeOpcoes(): void {
  cache.clear();
}

function chaveDoCache(lista: string, uf: string | null): string {
  return definicaoDaLista(lista)?.porUf ? `${lista}|${uf ?? ""}` : lista;
}

function carregar(lista: string, uf: string | null): Promise<Opcao[]> {
  const porUf = definicaoDaLista(lista)?.porUf;
  // Cidade e comarca dependem da UF: sem UF, nada a escolher.
  if (porUf && !uf) return Promise.resolve([]);
  const chave = chaveDoCache(lista, uf);
  let promessa = cache.get(chave);
  if (!promessa) {
    const parametros = new URLSearchParams({ listas: lista });
    if (porUf && uf) parametros.set("uf", uf);
    promessa = processosApi.get<{ opcoes: Record<string, Opcao[]> }>(`/opcoes?${parametros}`).then((resposta) => resposta.opcoes[lista] ?? []);
    promessa.catch(() => cache.delete(chave));
    cache.set(chave, promessa);
  }
  return promessa;
}

/** As opções ativas de uma lista (nas listas por UF, as da UF). */
export function useOpcoes(lista: string | undefined, uf: string | null): { opcoes: Opcao[]; carregando: boolean; erro: string } {
  const chave = lista ? chaveDoCache(lista, uf) : "";
  const [estado, setEstado] = useState<{
    chave: string;
    opcoes: Opcao[];
    erro: string;
  }>({ chave: "", opcoes: [], erro: "" });
  useEffect(() => {
    if (!lista) return;
    let vivo = true;
    carregar(lista, uf).then(
      (opcoes) => vivo && setEstado({ chave, opcoes, erro: "" }),
      (falha: unknown) =>
        vivo &&
        setEstado({
          chave,
          opcoes: [],
          erro: falha instanceof Error ? falha.message : "Não foi possível carregar as opções.",
        }),
    );
    return () => {
      vivo = false;
    };
  }, [chave, lista, uf]);
  const pronto = estado.chave === chave;
  return {
    opcoes: pronto ? estado.opcoes : [],
    carregando: Boolean(lista) && !pronto,
    erro: pronto ? estado.erro : "",
  };
}

function paraSeletor(opcoes: ReturnType<typeof opcoesParaCampo>): OpcaoSeletor[] {
  return opcoes.map((opcao) => ({
    valor: opcao.valor,
    rotulo: opcao.rotulo,
    descricao: opcao.descricao ?? null,
  }));
}

function textoDeEspera(lista: string, uf: string | null, carregando: boolean, erro: string): string | undefined {
  if (erro) return "Não foi possível carregar a lista";
  if (carregando) return "Carregando a lista…";
  if (definicaoDaLista(lista)?.porUf && !uf) return "Escolha a UF primeiro";
  return undefined;
}

/**
 * Campo de escolha, como no VIOS: só aceita opção do cadastro (busca por parte do nome). O valor atual fora da
 * lista continua visível, marcado "fora da lista", até alguém trocar. Nos campos de vários valores (etiquetas,
 * auxiliares), cada escolha vira uma etiqueta que pode ser removida.
 */
export function ControleDeLista({ item, valor, onChange, uf }: { item: CampoProcesso; valor: string; onChange: (valor: string) => void; uf: string | null }) {
  const lista = item.lista as string;
  const { opcoes, carregando, erro } = useOpcoes(lista, uf);
  const espera = textoDeEspera(lista, uf, carregando, erro);

  if (item.tipo === "lista") return <EscolhaMultipla rotulo={item.rotulo} valor={valor} onChange={onChange} opcoes={opcoes} uf={uf} espera={espera} />;

  return (
    <SeletorBusca
      valor={valor}
      onChange={onChange}
      opcoes={paraSeletor(opcoesParaCampo(opcoes, valor, uf))}
      todos={{ rotulo: "Não informado" }}
      placeholder={espera ?? "Escolha…"}
      buscaPlaceholder="Buscar na lista…"
      rotulo={item.rotulo}
    />
  );
}

function EscolhaMultipla({ rotulo, valor, onChange, opcoes, uf, espera }: { rotulo: string; valor: string; onChange: (valor: string) => void; opcoes: Opcao[]; uf: string | null; espera?: string }) {
  const escolhidos = useMemo(
    () =>
      valor
        .split("\n")
        .map((linha) => linha.trim())
        .filter(Boolean),
    [valor],
  );
  const validos = useMemo(() => new Set(opcoes.map((opcao) => opcao.valor)), [opcoes]);
  const restantes = useMemo(() => paraSeletor(opcoesParaCampo(opcoes, null, uf)).filter((opcao) => !escolhidos.includes(opcao.valor)), [opcoes, uf, escolhidos]);

  return (
    <div className="space-y-2">
      {escolhidos.length ? (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${rotulo} escolhidos`}>
          {escolhidos.map((escolhido) => {
            const fora = opcoes.length > 0 && !validos.has(escolhido);
            return (
              <li
                key={escolhido}
                className={cn(
                  "inline-flex max-w-full items-center gap-1 rounded-full border py-0.5 pl-2.5 pr-1 text-xs",
                  fora ? "border-amber-300 bg-amber-50 text-amber-900" : "border-[#c9dde6] bg-[#eef6f8] text-[#183f50]",
                )}
                title={fora ? "Fora da lista de Cadastros" : undefined}
              >
                <span className="truncate">{escolhido}</span>
                <button type="button" onClick={() => onChange(escolhidos.filter((item) => item !== escolhido).join("\n"))} className="rounded-full p-0.5 hover:bg-black/5" aria-label={`Tirar ${escolhido}`}>
                  <X className="size-3" aria-hidden />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
      <SeletorBusca
        valor=""
        onChange={(novo) => novo && onChange([...escolhidos, novo].join("\n"))}
        opcoes={restantes}
        placeholder={espera ?? "Incluir…"}
        buscaPlaceholder="Buscar na lista…"
        rotulo={`Incluir em ${rotulo.toLowerCase()}`}
      />
    </div>
  );
}
