"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  CircleHelp,
  CopyCheck,
  CopyX,
  FileSearch,
  Files,
  Landmark,
  Layers,
  LoaderCircle,
  PanelLeftClose,
  PanelLeftOpen,
  SearchX,
  Undo2,
  X,
} from "lucide-react";
import { Segmented } from "@/components/facilities/form-parts";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/auth-fetch";
import { camposDaPublicacao, combinaCampos } from "@/lib/vistagem/busca";
import { compararTeor, marcarDiferencas, type ComparacaoTeor } from "@/lib/vistagem/comparar-teor";
import { descricaoDoTribunal } from "@/lib/vistagem/tribunais";
import type { DuplicidadeItem, DuplicidadeResultado, PublicacaoResumo } from "@/lib/vistagem/types";
import { cn } from "@/lib/utils";
import { AcessoOperacoesLegais } from "../acesso-operacoes-legais";
import { BOTAO_FAIXA_PRINCIPAL, FaixaDoProcesso, SetasDaFila, type NavegacaoNaFila } from "./faixa-processo";
import { IconeTribunal, LogoGrupo, SeloArea } from "./marcas";
import { contarPor, formatarData, formatarDataHora, tribunalDe } from "./publicacao-ui";
import { IconeOpcao, Seletor } from "./seletor";
import { Aviso, BarraAba, Busca, Carregando, Painel, Selo, Vazio, linhaLista, type TomSelo } from "./ui";

type Situacao = "pendentes" | "revisadas";
/** Como o Id do documento do PJe se compara entre a principal e as cópias. */
type SituacaoId = "mesmo" | "diferente" | "sem";

interface Grupo {
  chave: string;
  principal: PublicacaoResumo | null;
  dataArquivo: string | null;
  copias: DuplicidadeItem[];
}

/** Agrupa as cópias pela publicação principal: um bloco por despacho. */
function agrupar(itens: DuplicidadeItem[]): Grupo[] {
  const grupos = new Map<string, Grupo>();
  for (const item of itens) {
    const chave = item.principal?.id ?? item.duplicidade.duplicidadeDe ?? item.duplicidade.id;
    const grupo = grupos.get(chave) ?? { chave, principal: item.principal, dataArquivo: item.dataArquivo, copias: [] };
    grupo.copias.push(item);
    grupos.set(chave, grupo);
  }
  return [...grupos.values()];
}

/** Id(s) de documento do PJe presentes na principal e em todas as cópias. */
function idsEmComum(grupo: Grupo): { comuns: string[]; situacao: SituacaoId } {
  const principal = grupo.principal?.documentoIds ?? [];
  const copias = grupo.copias.map((item) => item.duplicidade.documentoIds);
  const comuns = principal.filter((id) => copias.every((ids) => ids.includes(id)));
  if (comuns.length) return { comuns, situacao: "mesmo" };
  const divergem = principal.length > 0 && copias.some((ids) => ids.length > 0);
  return { comuns, situacao: divergem ? "diferente" : "sem" };
}

const SITUACAO_ID: Record<SituacaoId, { rotulo: string; descricao: string; icone: LucideIcon; tom: TomSelo }> = {
  mesmo: { rotulo: "Mesmo Id do documento", descricao: "A cópia repete o documento da principal", icone: CopyCheck, tom: "sucesso" },
  diferente: { rotulo: "Ids diferentes", descricao: "Confira o texto antes de confirmar", icone: FileSearch, tom: "alerta" },
  sem: { rotulo: "Sem Id do documento", descricao: "Marcada pelo texto; confira as diferenças", icone: CircleHelp, tom: "neutro" },
};

function SeloIds({ grupo }: { grupo: Grupo }) {
  const { comuns, situacao } = idsEmComum(grupo);
  const info = SITUACAO_ID[situacao];
  return (
    <Selo tom={info.tom} icone={info.icone}>
      {situacao === "mesmo" ? `Mesmo Id: ${comuns.slice(0, 2).join(", ")}` : info.rotulo}
    </Selo>
  );
}

const plural = (n: number, singular: string, varios: string) => `${n} ${n === 1 ? singular : varios}`;
const processoDe = (publicacao: PublicacaoResumo) => publicacao.numeroProcesso ?? publicacao.numeroProcessoOriginal;

/** O que a cópia já recebeu na conferência (aba Conferidas). */
function ResultadoRevisao({ item }: { item: DuplicidadeItem }) {
  const confirmada = item.duplicidade.duplicidadeResultado === "confirmada";
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
      <Selo tom={confirmada ? "alerta" : "sucesso"} icone={confirmada ? CopyCheck : Undo2}>
        {confirmada ? "Duplicidade confirmada" : "Não era duplicidade"}
      </Selo>
      <span>
        {item.revisadaPor ? `${item.revisadaPor} · ` : ""}
        {formatarDataHora(item.revisadaEm)}
      </span>
    </span>
  );
}

/** Texto em parágrafos, com as frases que não estão no outro texto pintadas de âmbar. */
function TextoComparado({ texto, outro }: { texto: string; outro: string }) {
  const paragrafos = useMemo(() => marcarDiferencas(texto, outro), [texto, outro]);
  return (
    <div className="space-y-2.5 text-[max(0.875rem,13px)] leading-6 text-foreground">
      {paragrafos.map((trechos, indice) => (
        <p key={indice}>
          {trechos.map((trecho, posicao) =>
            trecho.diferente ? (
              <mark key={posicao} className="rounded-sm bg-amber-100 text-amber-950">
                {trecho.texto}
              </mark>
            ) : (
              <span key={posicao}>{trecho.texto}</span>
            )
          )}
        </p>
      ))}
    </div>
  );
}

/** Uma linha da comparação: o rótulo, o valor da principal, o da cópia e se batem. */
function LinhaComparacao({ rotulo, principal, copia, bate }: { rotulo: string; principal: string; copia: string; bate: boolean | null }) {
  return (
    <tr className="border-t border-[#eef3f5] align-top first:border-t-0">
      <th scope="row" className="w-36 py-2 pr-3 text-left text-xs font-medium text-muted-foreground">
        {rotulo}
      </th>
      <td className="py-2 pr-3 text-sm text-foreground">{principal || <span className="text-muted-foreground">—</span>}</td>
      <td className="py-2 pr-3 text-sm text-foreground">{copia || <span className="text-muted-foreground">—</span>}</td>
      <td className="w-8 py-2 text-right">
        {bate === null ? null : bate ? (
          <Check className="ml-auto size-4 text-emerald-600" aria-label="Igual" />
        ) : (
          <span className="ml-auto inline-block size-2.5 rounded-full bg-amber-500" aria-label="Diferente" title="Diferente" />
        )}
      </td>
    </tr>
  );
}

const lista = (valores: (string | number)[]) => valores.join(", ");

function Duplicidades() {
  const [situacao, setSituacao] = useState<Situacao>("pendentes");
  const [itens, setItens] = useState<DuplicidadeItem[] | null>(null);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState<string | null>(null);
  const [erroGrupo, setErroGrupo] = useState<{ chave: string; texto: string } | null>(null);
  const [feito, setFeito] = useState("");
  const [selecionado, setSelecionado] = useState<string | null>(null);
  const [filaRecolhida, setFilaRecolhida] = useState(true);
  const [listaNoCelular, setListaNoCelular] = useState(false);
  const [busca, setBusca] = useState("");
  const [filtroId, setFiltroId] = useState<"" | SituacaoId>("");
  const [tribunal, setTribunal] = useState("");
  const [copiaAtiva, setCopiaAtiva] = useState(0);
  /** Texto completo de cada publicação (a lista traz só o começo dos textos grandes). */
  const [textos, setTextos] = useState<Record<string, string>>({});
  const [erroTexto, setErroTexto] = useState("");

  const carregar = useCallback(async (alvo: Situacao) => {
    setItens(null);
    setErro("");
    try {
      const resposta = await authFetch(`/api/operacoes-legais/vistagem/duplicidades?situacao=${alvo}`);
      const corpo = await resposta.json();
      if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar as duplicidades.");
      setItens(corpo.duplicidades);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Falha ao carregar as duplicidades.");
      setItens([]);
    }
  }, []);

  useEffect(() => {
    void carregar(situacao);
  }, [carregar, situacao]);

  const grupos = useMemo(() => agrupar(itens ?? []), [itens]);
  // A busca olha a principal e as cópias (intimados, partes, processo, grupo…): montada uma vez por carga.
  const camposDeBusca = useMemo(
    () =>
      new Map(
        grupos.map((grupo) => [
          grupo.chave,
          [...(grupo.principal ? camposDaPublicacao(grupo.principal) : []), ...grupo.copias.flatMap((item) => camposDaPublicacao(item.duplicidade))],
        ])
      ),
    [grupos]
  );
  const referencia = (grupo: Grupo) => grupo.principal ?? grupo.copias[0].duplicidade;
  const tribunais = useMemo(() => contarPor(grupos, (grupo) => tribunalDe(referencia(grupo))), [grupos]);
  const tribunalAtivo = tribunais.some(([nome]) => nome === tribunal) ? tribunal : "";
  const daBusca = useMemo(
    () =>
      grupos.filter(
        (grupo) => combinaCampos(camposDeBusca.get(grupo.chave) ?? [], busca) && (!tribunalAtivo || tribunalDe(referencia(grupo)) === tribunalAtivo)
      ),
    [grupos, camposDeBusca, busca, tribunalAtivo]
  );
  const porId = useMemo(() => {
    const total: Record<SituacaoId, number> = { mesmo: 0, diferente: 0, sem: 0 };
    for (const grupo of daBusca) total[idsEmComum(grupo).situacao] += 1;
    return total;
  }, [daBusca]);
  const filtrados = useMemo(() => (filtroId ? daBusca.filter((grupo) => idsEmComum(grupo).situacao === filtroId) : daBusca), [daBusca, filtroId]);

  const ids = filtrados.map((grupo) => grupo.chave);
  const indiceAberto = selecionado && ids.includes(selecionado) ? ids.indexOf(selecionado) : ids.length ? 0 : -1;
  const aberto = indiceAberto >= 0 ? filtrados[indiceAberto] : null;
  const navegacao: NavegacaoNaFila | null =
    indiceAberto >= 0 ? { posicao: indiceAberto + 1, total: ids.length, anterior: ids[indiceAberto - 1] ?? null, proxima: ids[indiceAberto + 1] ?? null } : null;
  const copia = aberto ? (aberto.copias[Math.min(copiaAtiva, aberto.copias.length - 1)] ?? null) : null;

  // Ao abrir um despacho, busca o texto completo da principal e das cópias que vieram cortadas.
  const chaveAberta = aberto?.chave ?? null;
  useEffect(() => {
    if (!aberto) return;
    const faltam = [aberto.principal, ...aberto.copias.map((item) => item.duplicidade)].filter(
      (publicacao): publicacao is PublicacaoResumo => Boolean(publicacao?.teorResumido) && !(publicacao!.id in textos)
    );
    if (!faltam.length) return;
    let cancelado = false;
    Promise.all(
      faltam.map(async (publicacao) => {
        const resposta = await authFetch(`/api/operacoes-legais/vistagem/publicacoes/${publicacao.id}`);
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao carregar o texto.");
        return [publicacao.id, corpo.publicacao.teor as string] as const;
      })
    )
      .then((pares) => {
        if (!cancelado) setTextos((atual) => ({ ...atual, ...Object.fromEntries(pares) }));
      })
      .catch((e) => {
        if (!cancelado) setErroTexto(e instanceof Error ? e.message : "Falha ao carregar o texto.");
      });
    return () => {
      cancelado = true;
    };
    // Só quando outro despacho abre; `textos` muda com o próprio carregamento.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chaveAberta]);

  const textoDe = (publicacao: PublicacaoResumo | null) => (publicacao ? (textos[publicacao.id] ?? (publicacao.teorResumido ? null : publicacao.teor)) : null);
  const textoPrincipal = textoDe(aberto?.principal ?? null);
  const textoCopia = textoDe(copia?.duplicidade ?? null);
  const comparacao: ComparacaoTeor | null = useMemo(
    () => (textoPrincipal !== null && textoCopia !== null ? compararTeor(textoPrincipal, textoCopia) : null),
    [textoPrincipal, textoCopia]
  );

  function abrir(chave: string) {
    setSelecionado(chave);
    setCopiaAtiva(0);
    setErroTexto("");
    setListaNoCelular(false);
  }

  function trocarSituacao(valor: Situacao) {
    setFeito("");
    setErroGrupo(null);
    setSelecionado(null);
    setCopiaAtiva(0);
    setSituacao(valor);
  }

  async function revisar(grupo: Grupo, copias: DuplicidadeItem[], resultado: DuplicidadeResultado) {
    setSalvando(grupo.chave);
    setErroGrupo(null);
    setFeito("");
    const feitas: string[] = [];
    try {
      for (const item of copias) {
        const resposta = await authFetch(`/api/operacoes-legais/vistagem/duplicidades/${item.duplicidade.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resultado }),
        });
        const corpo = await resposta.json();
        if (!resposta.ok) throw new Error(corpo.error ?? "Falha ao salvar.");
        feitas.push(item.duplicidade.id);
      }
      setFeito(
        resultado === "confirmada"
          ? `${plural(feitas.length, "cópia confirmada", "cópias confirmadas")} como duplicidade.`
          : `${plural(feitas.length, "cópia marcada", "cópias marcadas")} como não duplicidade; ${feitas.length === 1 ? "ela volta" : "elas voltam"} para a triagem.`
      );
      // Despacho resolvido por inteiro: segue para o próximo da fila.
      if (feitas.length === grupo.copias.length) {
        const posicao = ids.indexOf(grupo.chave);
        setSelecionado(ids[posicao + 1] ?? ids[posicao - 1] ?? null);
      }
      setCopiaAtiva(0);
    } catch (e) {
      setErroGrupo({ chave: grupo.chave, texto: e instanceof Error ? e.message : "Falha ao salvar." });
    } finally {
      setItens((atuais) => (atuais ?? []).filter((atual) => !feitas.includes(atual.duplicidade.id)));
      setSalvando(null);
    }
  }

  const pendentes = situacao === "pendentes";
  const filtrando = Boolean(busca.trim() || filtroId || tribunalAtivo);

  function limparFiltros() {
    setBusca("");
    setFiltroId("");
    setTribunal("");
  }

  return (
    <div className="space-y-4">
      <BarraAba
        resumo={
          <Segmented
            label="Situação da conferência"
            value={situacao}
            options={(["pendentes", "revisadas"] as Situacao[]).map((valor) => ({
              value: valor,
              label: `${valor === "pendentes" ? "A conferir" : "Conferidas"}${valor === situacao && itens ? ` ${grupos.length}` : ""}`,
              icon: valor === "pendentes" ? Files : CheckCheck,
            }))}
            onChange={trocarSituacao}
          />
        }
      >
        {filaRecolhida ? (
          <Button type="button" variant="outline" className="hidden lg:inline-flex" onClick={() => setFilaRecolhida(false)}>
            <PanelLeftOpen />
            Mostrar fila
          </Button>
        ) : null}
        <Busca value={busca} onChange={(evento) => setBusca(evento.target.value)} placeholder="Processo, grupo, parte ou intimado" aria-label="Buscar duplicidade" />
        <Seletor
          rotulo="Id do documento"
          className="sm:w-60"
          valor={filtroId}
          onChange={(valor) => setFiltroId(valor as "" | SituacaoId)}
          todos={{ rotulo: "Todos os Ids", contagem: daBusca.length, icone: <IconeOpcao icone={Layers} /> }}
          opcoes={(Object.keys(SITUACAO_ID) as SituacaoId[]).map((valor) => ({
            valor,
            rotulo: SITUACAO_ID[valor].rotulo,
            descricao: SITUACAO_ID[valor].descricao,
            contagem: porId[valor],
            icone: <IconeOpcao icone={SITUACAO_ID[valor].icone} />,
          }))}
        />
        <Seletor
          rotulo="Tribunal"
          className="sm:w-52"
          valor={tribunalAtivo}
          onChange={setTribunal}
          todos={{ rotulo: "Todos os tribunais", contagem: grupos.length, icone: <IconeOpcao icone={Landmark} /> }}
          opcoes={tribunais.map(([nome, quantidade]) => ({ valor: nome, rotulo: nome, descricao: descricaoDoTribunal(nome), contagem: quantidade, icone: <IconeTribunal sigla={nome} /> }))}
        />
      </BarraAba>

      {feito ? (
        <Aviso
          tom="sucesso"
          acao={
            <Button variant="ghost" size="icon-xs" className="-my-1 text-current" aria-label="Fechar aviso" onClick={() => setFeito("")}>
              <X />
            </Button>
          }
        >
          {feito}
        </Aviso>
      ) : null}

      {itens === null ? (
        <Painel>
          <Carregando rotulo="Carregando duplicidades" />
        </Painel>
      ) : erro ? (
        <Aviso
          tom="erro"
          titulo="Não foi possível carregar as duplicidades"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => void carregar(situacao)}>
              Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : grupos.length === 0 ? (
        <Painel>
          <Vazio icone={CopyX} titulo={pendentes ? "Nenhuma duplicidade para conferir." : "Nenhuma duplicidade conferida ainda."}>
            {pendentes ? "Quando a captura marcar uma cópia de despacho, ela aparece aqui para você comparar." : null}
          </Vazio>
        </Painel>
      ) : filtrados.length === 0 ? (
        <Painel>
          <Vazio icone={SearchX} titulo="Nenhuma duplicidade com esses filtros.">
            <Button variant="link" className="h-auto p-0" onClick={limparFiltros}>
              Limpar filtros
            </Button>
          </Vazio>
        </Painel>
      ) : (
        // Um despacho por vez, como a Conferência: a fila fica recolhida e as setas da faixa andam entre os despachos.
        <div
          className={cn(
            "grid gap-4 lg:h-[calc(100dvh-10.5rem)] lg:min-h-[30rem] lg:grid-rows-[minmax(0,1fr)]",
            filaRecolhida ? "lg:grid-cols-1" : "lg:grid-cols-[minmax(280px,340px)_minmax(0,1fr)]"
          )}
        >
          <Painel
            aria-label="Despachos com duplicidade"
            className={cn("lg:flex lg:h-full lg:flex-col", aberto && !listaNoCelular && "hidden lg:flex", filaRecolhida && "lg:hidden")}
          >
            <div className="hidden items-center gap-2 border-b border-[#e6eef0] px-4 py-2 lg:flex">
              <span className="flex-1 text-xs font-medium text-muted-foreground">
                Fila <span className="tabular-nums">· {filtrados.length}</span>
                {filtrando ? (
                  <button type="button" className="ml-2 font-medium text-[#347796] underline-offset-4 hover:underline" onClick={limparFiltros}>
                    limpar filtros
                  </button>
                ) : null}
              </span>
              <Button type="button" size="icon-xs" variant="ghost" onClick={() => setFilaRecolhida(true)} aria-label="Recolher a fila" title="Recolher a fila">
                <PanelLeftClose />
              </Button>
            </div>
            <ul className="max-h-[70vh] divide-y divide-[#eef3f5] overflow-auto lg:max-h-none lg:flex-1">
              {filtrados.map((grupo) => {
                const ref = referencia(grupo);
                const info = SITUACAO_ID[idsEmComum(grupo).situacao];
                return (
                  <li key={grupo.chave}>
                    <button
                      type="button"
                      onClick={() => abrir(grupo.chave)}
                      aria-current={grupo.chave === aberto?.chave ? "true" : undefined}
                      className={cn(linhaLista(grupo.chave === aberto?.chave), "flex items-start gap-3")}
                    >
                      <LogoGrupo grupo={grupo.principal?.grupoCliente ?? null} tamanho="sm" />
                      <span className="min-w-0 flex-1 space-y-0.5">
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="text-xs font-semibold tabular-nums text-foreground">{processoDe(ref)}</span>
                          {ref.tribunal ? <IconeTribunal sigla={ref.tribunal} /> : null}
                        </span>
                        <span className="block truncate text-sm text-foreground">{grupo.principal?.grupoCliente ?? grupo.principal?.cliente ?? "Sem grupo"}</span>
                        <span className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <Selo tom={info.tom} icone={info.icone}>
                            {plural(grupo.copias.length + 1, "envio", "envios")}
                          </Selo>
                          publ. {formatarData(ref.dataPublicacao)}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </Painel>

          <div className={cn("min-w-0 lg:h-full lg:min-h-0", (!aberto || listaNoCelular) && "hidden lg:block")}>
            {aberto ? (
              <Painel aria-labelledby={`dup-${aberto.chave}-titulo`} className="@container lg:flex lg:h-full lg:flex-col">
                <Button variant="ghost" size="sm" className="m-2 self-start lg:hidden" onClick={() => setListaNoCelular(true)}>
                  <ArrowLeft />
                  Voltar à lista
                </Button>
                <FaixaDoProcesso
                  numero={processoDe(referencia(aberto))}
                  tribunal={referencia(aberto).tribunal}
                  tituloId={`dup-${aberto.chave}-titulo`}
                  selos={
                    <>
                      <Selo tom="escuro" className="bg-white/15 text-white ring-white/30" icone={Files}>
                        {plural(aberto.copias.length + 1, "envio", "envios")}
                      </Selo>
                      <SeloIds grupo={aberto} />
                    </>
                  }
                >
                  {pendentes ? (
                    <Button size="sm" className={BOTAO_FAIXA_PRINCIPAL} onClick={() => revisar(aberto, aberto.copias, "confirmada")} disabled={salvando !== null}>
                      {salvando === aberto.chave ? <LoaderCircle className="animate-spin" /> : aberto.copias.length > 1 ? <CheckCheck /> : <Check />}
                      {aberto.copias.length > 1 ? `Confirmar todas (${aberto.copias.length})` : "Confirmar duplicidade"}
                    </Button>
                  ) : null}
                  {navegacao ? <SetasDaFila navegacao={navegacao} onAbrir={abrir} separada={pendentes} /> : null}
                </FaixaDoProcesso>

                <div className="min-h-0 flex-1 overflow-y-auto">
                  {/* De quem é o despacho e de que arquivo veio. */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-[#e6eef0] bg-[#fafcfc] px-4 py-3">
                    <LogoGrupo grupo={aberto.principal?.grupoCliente ?? null} tamanho="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">{aberto.principal?.grupoCliente ?? "Sem grupo"}</p>
                      <p className="truncate text-xs text-muted-foreground">{aberto.principal?.cliente ?? "Cliente não informado"}</p>
                    </div>
                    {aberto.principal?.escritorioResponsavel ? <SeloArea area={aberto.principal.escritorioResponsavel} /> : null}
                    <span className="text-xs text-muted-foreground">
                      arquivo de <span className="tabular-nums text-foreground">{formatarData(aberto.dataArquivo)}</span> · publicação{" "}
                      <span className="tabular-nums text-foreground">{formatarData(referencia(aberto).dataPublicacao)}</span>
                    </span>
                  </div>

                  {erroGrupo?.chave === aberto.chave ? (
                    <div className="px-4 pt-3">
                      <Aviso tom="erro">{erroGrupo.texto}</Aviso>
                    </div>
                  ) : null}

                  <div className="space-y-4 px-4 py-4">
                    {/* Com várias cópias (uma por parte intimada), escolhe qual comparar com a principal. */}
                    {aberto.copias.length > 1 ? (
                      <div role="tablist" aria-label="Cópias do despacho" className="flex flex-wrap gap-1.5">
                        {aberto.copias.map((item, indice) => {
                          const ativa = indice === Math.min(copiaAtiva, aberto.copias.length - 1);
                          return (
                            <button
                              key={item.duplicidade.id}
                              type="button"
                              role="tab"
                              aria-selected={ativa}
                              onClick={() => setCopiaAtiva(indice)}
                              className={cn(
                                "inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm transition-colors",
                                ativa ? "border-[#347796] bg-[#347796] font-medium text-white" : "border-[#dce9eb] bg-white text-muted-foreground hover:text-foreground"
                              )}
                            >
                              Cópia {indice + 1}
                              <span className={cn("text-xs tabular-nums", ativa ? "text-white/80" : "text-muted-foreground")}>· linha {item.duplicidade.linhaArquivo ?? "?"}</span>
                            </button>
                          );
                        })}
                      </div>
                    ) : null}

                    {copia ? (
                      <section aria-label="Comparação" className="overflow-hidden rounded-lg border border-[#dce9eb]">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-[#e6eef0] bg-[#f7fbfc] px-3.5 py-2.5">
                          <h3 className="text-xs font-semibold uppercase text-[#285f7a]">Principal × cópia</h3>
                          <span className="text-xs text-muted-foreground">
                            marcada {copia.duplicidade.duplicidadeCriterio === "id_documento" ? "pelo Id do documento" : "pelo texto"}
                          </span>
                          <span className="ml-auto flex flex-wrap items-center gap-2">
                            {pendentes ? (
                              <Button size="sm" variant="outline" disabled={salvando !== null} onClick={() => revisar(aberto, [copia], "nao_duplicidade")}>
                                <Undo2 />
                                Não é duplicidade
                              </Button>
                            ) : (
                              <>
                                <ResultadoRevisao item={copia} />
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={salvando !== null}
                                  onClick={() => revisar(aberto, [copia], copia.duplicidade.duplicidadeResultado === "confirmada" ? "nao_duplicidade" : "confirmada")}
                                >
                                  <Undo2 />
                                  {copia.duplicidade.duplicidadeResultado === "confirmada" ? "Mudar para: não é duplicidade" : "Mudar para: duplicidade"}
                                </Button>
                              </>
                            )}
                          </span>
                        </div>
                        <div className="overflow-x-auto px-3.5 py-1">
                          <table className="w-full min-w-[32rem]">
                            <thead>
                              <tr className="text-left text-[11px] font-semibold uppercase text-[#285f7a]">
                                <th className="py-2 pr-3" />
                                <th className="py-2 pr-3">Principal · linha {aberto.principal?.linhaArquivo ?? "?"}</th>
                                <th className="py-2 pr-3">Cópia · linha {copia.duplicidade.linhaArquivo ?? "?"}</th>
                                <th className="w-8" />
                              </tr>
                            </thead>
                            <tbody>
                              <LinhaComparacao
                                rotulo="Id do documento"
                                principal={lista(aberto.principal?.documentoIds ?? [])}
                                copia={lista(copia.duplicidade.documentoIds)}
                                bate={
                                  (aberto.principal?.documentoIds.length ?? 0) || copia.duplicidade.documentoIds.length
                                    ? (aberto.principal?.documentoIds ?? []).some((id) => copia.duplicidade.documentoIds.includes(id))
                                    : null
                                }
                              />
                              <LinhaComparacao
                                rotulo="Intimado(s)"
                                principal={lista(aberto.principal?.djenIntimados ?? [])}
                                copia={lista(copia.duplicidade.djenIntimados)}
                                bate={lista(aberto.principal?.djenIntimados ?? []) === lista(copia.duplicidade.djenIntimados)}
                              />
                              <LinhaComparacao
                                rotulo="Órgão"
                                principal={aberto.principal?.djenOrgao ?? ""}
                                copia={copia.duplicidade.djenOrgao ?? ""}
                                bate={(aberto.principal?.djenOrgao ?? "") === (copia.duplicidade.djenOrgao ?? "")}
                              />
                              <LinhaComparacao
                                rotulo="Divulgação"
                                principal={formatarData(aberto.principal?.dataDivulgacao ?? null)}
                                copia={formatarData(copia.duplicidade.dataDivulgacao)}
                                bate={aberto.principal?.dataDivulgacao === copia.duplicidade.dataDivulgacao}
                              />
                              <LinhaComparacao
                                rotulo="Texto"
                                principal={textoPrincipal === null ? "Carregando…" : `${textoPrincipal.length.toLocaleString("pt-BR")} caracteres`}
                                copia={textoCopia === null ? "Carregando…" : `${textoCopia.length.toLocaleString("pt-BR")} caracteres`}
                                bate={comparacao ? comparacao.iguais : null}
                              />
                            </tbody>
                          </table>
                        </div>
                        {comparacao ? (
                          <p className="border-t border-[#eef3f5] bg-[#fafcfc] px-3.5 py-2 text-xs text-muted-foreground">
                            {comparacao.iguais ? (
                              <span className="font-medium text-emerald-700">Os textos são iguais.</span>
                            ) : (
                              <>
                                <span className="font-medium text-amber-800">{plural(comparacao.trechosDiferentes, "trecho diferente", "trechos diferentes")}</span>{" "}
                                · {Math.round(comparacao.semelhanca * 100)}% das palavras em comum · em âmbar nos textos abaixo
                              </>
                            )}
                          </p>
                        ) : null}
                      </section>
                    ) : null}

                    {erroTexto ? <Aviso tom="erro">{erroTexto}</Aviso> : null}

                    {/* Os dois textos lado a lado, cada um rolando sozinho, com o que muda em âmbar. */}
                    {copia ? (
                      <div className="grid gap-3 @3xl:grid-cols-2">
                        {[
                          { titulo: `Principal · linha ${aberto.principal?.linhaArquivo ?? "?"}`, texto: textoPrincipal, outro: textoCopia },
                          { titulo: `Cópia · linha ${copia.duplicidade.linhaArquivo ?? "?"}`, texto: textoCopia, outro: textoPrincipal },
                        ].map((coluna) => (
                          <section key={coluna.titulo} aria-label={coluna.titulo} className="min-w-0 overflow-hidden rounded-lg border border-[#dce9eb] bg-white">
                            <h3 className="border-b border-[#e6eef0] bg-[#f7fbfc] px-3.5 py-2 text-xs font-semibold uppercase text-[#285f7a]">{coluna.titulo}</h3>
                            <div className="max-h-[28rem] overflow-y-auto px-3.5 py-3">
                              {coluna.texto === null || coluna.outro === null ? (
                                <Carregando rotulo="Carregando o texto" className="p-6" />
                              ) : aberto.principal || coluna.titulo.startsWith("Cópia") ? (
                                <TextoComparado texto={coluna.texto} outro={coluna.outro} />
                              ) : (
                                <p className="text-sm text-muted-foreground">Publicação principal não encontrada.</p>
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
              </Painel>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

export function DuplicidadesClient() {
  return (
    <AcessoOperacoesLegais>
      <Duplicidades />
    </AcessoOperacoesLegais>
  );
}
