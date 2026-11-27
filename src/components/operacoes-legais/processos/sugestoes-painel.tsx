"use client";

import { Fragment, useId, useState, type ReactNode } from "react";
import { Check, CheckCheck, ExternalLink, Landmark, LoaderCircle, MapPin, PencilLine, Sparkles, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AutosDoProcesso, Confianca, ContatoSugerido, EnderecoSugerido, PessoaSugerida, Sugestao, ValorDeCampo } from "@/lib/processos/autos-types";
import { ehTrabalhista } from "@/lib/processos/trabalhista";
import { GRUPOS_CAMPO, campoPorChave, estaPreenchido, formatarValor, rotuloDoCampo } from "@/lib/processos/campos";
import { ITENS_SANEAMENTO } from "@/lib/processos/preenchimento";
import { MEIOS_CITACAO, RESULTADOS_CITACAO, ROTULO_DO_ITEM, SITUACOES_PEDIDO, formatarData, formatarReal } from "@/lib/processos/rec-credito";
import type { ItemSugerido } from "@/lib/processos/rec-credito-leitura";
import { aplicarNaParte, entradaDaPessoa, linhaDoEndereco } from "@/lib/processos/sugestoes";
import { TIPOS_CONTATO, rotuloDoPapel, type ParteEntrada, type ProcessoDetalhe } from "@/lib/processos/types";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Aviso, Campo, Painel, PainelTopo, Selo, type TomSelo } from "../vistagem/ui";
import { Controle, doFormulario, paraFormulario } from "./editar-campos";
import { EditarParte } from "./editar-parte";
import { abrirAutos, formatarDataHora, mensagemDeErro, processosApi } from "./processos-api";
import { ConferirItemSugerido } from "./rec-credito-painel";
import { TextoSintese } from "./texto-sintese";

type Decisao = { processo: ProcessoDetalhe; autos: AutosDoProcesso };

const CONFIANCA: Record<Confianca, { tom: TomSelo; rotulo: string }> = {
  alta: { tom: "sucesso", rotulo: "Confiança alta" },
  media: { tom: "neutro", rotulo: "Confiança média" },
  baixa: { tom: "alerta", rotulo: "Confiança baixa" },
};

const ROTULO_ITEM = new Map([
  ...ITENS_SANEAMENTO.map((item) => [item.chave, item.rotulo] as const),
  ...Object.entries(ROTULO_DO_ITEM).map(([item, rotulo]) => [`rec_credito_${item}`, `Rec. Crédito: ${rotulo.toLowerCase()}`] as const),
  ["acordo_acordo", "Acordo"],
  ["acordo_pagamento", "Acordo: pagamento"],
  ["acordo_descumprimento", "Acordo: descumprimento"],
  ["trabalhista_afastamento", "Afastamento INSS"],
  ["trabalhista_pedido", "Pedido trabalhista"],
]);
const ORDEM_ACORDO: Record<string, number> = { acordo: 0, pagamento: 1, descumprimento: 2 };
const ROTULO_GRUPO = new Map<string, string>(GRUPOS_CAMPO.map((grupo) => [grupo.id, grupo.rotulo]));
const ROTULO_CONTATO = new Map<string, string>(TIPOS_CONTATO.map((item) => [item.valor, item.rotulo]));

/** O que a sugestão propõe, em destaque: o valor do campo, o dado da parte ou a pessoa nova. */
function Proposta({ sugestao, processo }: { sugestao: Sugestao; processo: ProcessoDetalhe }) {
  const parte = sugestao.parteId ? processo.partes.find((item) => item.id === sugestao.parteId) : null;
  const deQuem = parte ? <span className="font-normal text-muted-foreground"> de {parte.nome}</span> : null;

  if (sugestao.tipo === "campo" && sugestao.campo) {
    const item = campoPorChave(sugestao.campo);
    const atual = processo.valores[sugestao.campo];
    // Texto longo (a síntese do processo): o texto inteiro, para ler antes de decidir.
    if (item?.tipo === "texto_longo") {
      return (
        <>
          <p className="text-xs font-medium text-muted-foreground">{rotuloDoCampo(sugestao.campo)}</p>
          <TextoSintese
            texto={String((sugestao.valor as ValorDeCampo).valor)}
            className="max-h-[32rem] overflow-y-auto rounded-md border border-[#dce9eb] bg-[#f7fbfc] px-3 py-2.5"
          />
          {estaPreenchido(atual) ? <p className="text-xs text-amber-800">O cadastro já tem texto neste campo: a proposta acima mantém o que existe e acrescenta a parte da IA no fim.</p> : null}
        </>
      );
    }
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">{rotuloDoCampo(sugestao.campo)}</p>
        <p className="break-words text-base font-semibold tabular-nums text-[#10293a]">{formatarValor(item, (sugestao.valor as ValorDeCampo).valor)}</p>
        {Object.entries((sugestao.valor as ValorDeCampo).junto ?? {}).map(([campo, valor]) => (
          <p key={campo} className="text-xs text-muted-foreground">
            {rotuloDoCampo(campo)}: <span className="tabular-nums text-foreground">{formatarValor(campoPorChave(campo), valor)}</span>
          </p>
        ))}
        {estaPreenchido(atual) ? <p className="text-xs text-amber-800">Hoje no cadastro: {formatarValor(item, atual)}. Aprovar troca o valor.</p> : null}
      </>
    );
  }
  if (sugestao.tipo === "acordo") {
    const [rotulo, ...resto] = sugestao.resumo.split(": ");
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
        <p className="break-words text-sm font-semibold text-[#10293a]">{resto.join(": ")}</p>
        {sugestao.campo === "acordo" ? <p className="text-xs text-muted-foreground">Aprovado, entra em Acordos com as parcelas geradas; ajuste depois no controle de parcelas, se precisar.</p> : null}
        {sugestao.campo === "pagamento" ? <p className="text-xs text-muted-foreground">Aprovado, marca paga a parcela informada (ou a primeira em aberto) do acordo mais recente.</p> : null}
      </>
    );
  }
  if (sugestao.tipo === "rec_credito" || sugestao.tipo === "trabalhista") {
    // O resumo já diz o item inteiro ("Título: Duplicata nº 10, R$ 1.000,00, vencimento 10/01/2024").
    const [rotulo, ...resto] = sugestao.resumo.split(": ");
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">{rotulo}</p>
        <p className="break-words text-sm font-semibold text-[#10293a]">{resto.join(": ")}</p>
      </>
    );
  }
  if (sugestao.tipo === "parte_documento") {
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">CPF/CNPJ{deQuem}</p>
        <p className="text-base font-semibold tabular-nums text-[#10293a]">{(sugestao.valor as { documento: string }).documento}</p>
      </>
    );
  }
  if (sugestao.tipo === "parte_oab") {
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">OAB{deQuem}</p>
        <p className="text-base font-semibold tabular-nums text-[#10293a]">{(sugestao.valor as { oab: string }).oab}</p>
      </>
    );
  }
  if (sugestao.tipo === "parte_endereco") {
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">Endereço{deQuem}</p>
        <p className="break-words text-sm font-semibold text-[#10293a]">{linhaDoEndereco(sugestao.valor as EnderecoSugerido)}</p>
      </>
    );
  }
  if (sugestao.tipo === "parte_contato") {
    const contato = sugestao.valor as ContatoSugerido;
    return (
      <>
        <p className="text-xs font-medium text-muted-foreground">
          {ROTULO_CONTATO.get(contato.tipo) ?? "Contato"}
          {deQuem}
        </p>
        <p className="flex flex-wrap items-center gap-2 break-all text-sm font-semibold text-[#10293a]">
          {contato.valor}
          {contato.whatsapp ? <Selo tom="sucesso">WhatsApp</Selo> : null}
        </p>
      </>
    );
  }
  const pessoa = sugestao.valor as PessoaSugerida;
  const papel = pessoa.papel === "parte" ? `Parte do polo ${pessoa.polo}` : rotuloDoPapel(pessoa.papel);
  return (
    <>
      <p className="text-xs font-medium text-muted-foreground">
        Pessoa nova: {papel}
        {pessoa.referenteNome ? ` de ${pessoa.referenteNome}` : ""}
      </p>
      <p className="break-words text-base font-semibold text-[#10293a]">{pessoa.nome}</p>
      <p className="text-xs text-muted-foreground">
        {pessoa.documento ? <span className="tabular-nums text-foreground">{pessoa.documento}</span> : "CPF/CNPJ não encontrado"}
        {pessoa.oab ? <span> · OAB {pessoa.oab}</span> : null}
      </p>
      {pessoa.enderecos.length || pessoa.contatos.length ? (
        <ul className="mt-1 space-y-0.5 text-sm text-foreground">
          {pessoa.enderecos.map((endereco, indice) => (
            <li key={`e${indice}`} className="flex items-start gap-1.5">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
              <span className="break-words">{linhaDoEndereco(endereco)}</span>
            </li>
          ))}
          {pessoa.contatos.map((contato, indice) => (
            <li key={`c${indice}`} className="break-all pl-5">
              {ROTULO_CONTATO.get(contato.tipo)}: {contato.valor}
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

/** Edição do valor de um campo antes de aprovar. */
function ConferirCampo({ sugestao, uf, onFechar, aprovar }: { sugestao: Sugestao; uf: string | null; onFechar: () => void; aprovar: (corpo: { valor: unknown }) => Promise<void> }) {
  const item = campoPorChave(sugestao.campo ?? "");
  const [texto, setTexto] = useState(() => (item ? paraFormulario(item, (sugestao.valor as ValorDeCampo).valor) : ""));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  if (!item) return null;

  async function confirmar() {
    if (!item) return;
    setSalvando(true);
    setErro("");
    try {
      await aprovar({ valor: doFormulario(item, texto) });
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  }

  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={salvando}
      icone={Sparkles}
      titulo="Conferir a sugestão da IA"
      descricao="Ajuste o valor se for preciso. Ao aprovar, ele é gravado no cadastro com origem “IA” no histórico."
      className={item.tipo === "texto_longo" ? "sm:max-w-3xl" : undefined}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void confirmar()} disabled={salvando || !texto.trim()}>
            {salvando ? <LoaderCircle className="animate-spin" /> : <Check />} Aprovar e gravar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <Campo rotulo={item.rotulo}>
        <Controle item={item} valor={texto} onChange={setTexto} uf={uf} />
      </Campo>
      {sugestao.trecho ? <Trecho sugestao={sugestao} /> : null}
    </DialogoAcao>
  );
}

const FONTE: Record<Exclude<Sugestao["fonte"], undefined>, string> = { autos: "Autos (IA)", datajud: "DataJud", jusbr: "Jus.br", cnj: "Número CNJ" };
const ehDaCapa = (sugestao: Sugestao) => sugestao.fonte === "datajud" || sugestao.fonte === "cnj" || sugestao.fonte === "jusbr";
const ehSintese = (sugestao: Sugestao) => sugestao.tipo === "campo" && sugestao.campo === "sintese";
/** Textos que a IA redige com o conjunto dos autos (não são cópia de uma página): síntese e parecer do risco. */
const ehRedigida = (sugestao: Sugestao) => sugestao.tipo === "campo" && (sugestao.campo === "sintese" || sugestao.campo === "parecer_risco") && !sugestao.trecho;

function Trecho({ sugestao, onAbrir }: { sugestao: Sugestao; onAbrir?: () => void }) {
  // Capa das fontes oficiais: o "trecho" é a descrição do dado na fonte, sem página de autos.
  if (ehDaCapa(sugestao)) {
    return (
      <figure className="rounded-md border-l-2 border-[#347796]/40 bg-[#f2f8fa] px-3 py-2">
        <p className="break-words text-sm leading-6 text-foreground">{sugestao.trecho}</p>
      </figure>
    );
  }
  return (
    <figure className="rounded-md border-l-2 border-[#48466e]/40 bg-[#f6f5fa] px-3 py-2">
      <blockquote className="whitespace-pre-wrap break-words text-sm leading-6 text-foreground">“{sugestao.trecho}”</blockquote>
      <figcaption className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span className="tabular-nums">{sugestao.pagina ? `Página ${sugestao.pagina} dos autos` : "Página não identificada"}</span>
        {onAbrir ? (
          <button type="button" className="inline-flex items-center gap-1 font-medium text-[#347796] underline decoration-[#347796]/40 underline-offset-4 hover:text-[#285f7a]" onClick={onAbrir}>
            <ExternalLink className="size-3" aria-hidden /> Abrir o PDF {sugestao.pagina ? "nesta página" : ""}
          </button>
        ) : null}
      </figcaption>
    </figure>
  );
}

/** Campos que a IA redige com o conjunto dos autos: um bloco próprio, no topo. */
const CAMPOS_REDIGIDOS = new Set(["sintese", "parecer_risco", "proximos_passos", "ultimo_andamento_texto", "fase"]);

type TipoTabela = "titulo" | "citacao" | "pedido" | "guia" | "levantamento";

interface GrupoDeSugestoes {
  chave: string;
  titulo: string;
  descricao?: string;
  lista: Sugestao[];
  lote: boolean;
  nome?: string;
  tabela?: TipoTabela;
}

const COLUNAS_TABELA: Record<TipoTabela, { titulo: string; valor: (dados: ItemSugerido["dados"]) => ReactNode; numero?: boolean }[]> = {
  titulo: [
    { titulo: "Tipo", valor: (d) => d.tipo },
    { titulo: "Número", valor: (d) => d.numero ?? "—" },
    { titulo: "Valor", valor: (d) => (typeof d.valor === "number" ? formatarReal(d.valor) : "—"), numero: true },
    { titulo: "Vencimento", valor: (d) => (typeof d.vencimento === "string" ? formatarData(d.vencimento) : "—"), numero: true },
  ],
  citacao: [
    { titulo: "Data", valor: (d) => (typeof d.tentativaEm === "string" ? formatarData(d.tentativaEm) : "—"), numero: true },
    { titulo: "Meio", valor: (d) => MEIOS_CITACAO.find((item) => item.valor === d.meio)?.rotulo ?? d.meio },
    { titulo: "Resultado", valor: (d) => <SeloResultado valor={String(d.resultado ?? "")} /> },
    { titulo: "Endereço", valor: (d) => d.endereco ?? "—" },
  ],
  pedido: [
    { titulo: "Pedido em", valor: (d) => (typeof d.pedidoEm === "string" ? formatarData(d.pedidoEm) : "—"), numero: true },
    { titulo: "Pedido", valor: (d) => d.tipo },
    { titulo: "Situação", valor: (d) => <SeloSituacao valor={String(d.situacao ?? "")} decididoEm={typeof d.decididoEm === "string" ? d.decididoEm : null} /> },
    { titulo: "Resultado", valor: (d) => [d.resultado, typeof d.valorObtido === "number" ? formatarReal(d.valorObtido) : null].filter(Boolean).join(" · ") || "—" },
  ],
  guia: [
    { titulo: "Data", valor: (d) => (typeof d.data === "string" ? formatarData(d.data) : "—"), numero: true },
    { titulo: "Valor", valor: (d) => (typeof d.valor === "number" ? formatarReal(d.valor) : "—"), numero: true },
    { titulo: "Descrição", valor: (d) => d.descricao ?? "—" },
  ],
  levantamento: [
    { titulo: "Data", valor: (d) => (typeof d.data === "string" ? formatarData(d.data) : "—"), numero: true },
    { titulo: "Valor", valor: (d) => (typeof d.valor === "number" ? formatarReal(d.valor) : "—"), numero: true },
    { titulo: "Descrição", valor: (d) => d.descricao ?? "—" },
  ],
};

const TOM_RESULTADO: Record<string, TomSelo> = { positiva: "sucesso", negativa: "perigo", pendente: "alerta" };
const TOM_SITUACAO: Record<string, TomSelo> = { deferido: "sucesso", indeferido: "perigo", requerido: "alerta", prejudicado: "neutro" };

function SeloResultado({ valor }: { valor: string }) {
  return <Selo tom={TOM_RESULTADO[valor] ?? "neutro"}>{RESULTADOS_CITACAO.find((item) => item.valor === valor)?.rotulo ?? valor}</Selo>;
}

function SeloSituacao({ valor, decididoEm }: { valor: string; decididoEm: string | null }) {
  return (
    <Selo tom={TOM_SITUACAO[valor] ?? "neutro"}>
      {SITUACOES_PEDIDO.find((item) => item.valor === valor)?.rotulo ?? valor}
      {decididoEm ? ` em ${formatarData(decididoEm)}` : ""}
    </Selo>
  );
}

/**
 * Itens da Rec. Crédito em tabela: uma linha por item, com a página e a conferência do trecho; clicar na linha
 * mostra o trecho dos autos. Aprovar, editar e recusar ficam na própria linha.
 */
function TabelaRecCredito({
  tipo,
  lista,
  ocupado,
  comPdf,
  onAprovar,
  onRecusar,
  onEditar,
  onAbrir,
}: {
  tipo: TipoTabela;
  lista: Sugestao[];
  ocupado: string;
  comPdf: Set<string>;
  onAprovar: (sugestao: Sugestao) => void;
  onRecusar: (sugestao: Sugestao) => void;
  onEditar: (sugestao: Sugestao) => void;
  onAbrir: (sugestao: Sugestao) => void;
}) {
  const [aberta, setAberta] = useState<string | null>(null);
  const colunas = COLUNAS_TABELA[tipo];
  const ordenada = [...lista].sort((a, b) => (a.pagina ?? Infinity) - (b.pagina ?? Infinity));
  return (
    <div className="overflow-x-auto border-t border-[#e6eef0]">
      <table className="w-full min-w-[44rem] text-sm">
        <thead className="text-left text-xs text-muted-foreground">
          <tr className="border-b border-[#e6eef0]">
            {colunas.map((coluna) => (
              <th key={coluna.titulo} scope="col" className={cn("px-3 py-2 font-medium", coluna.numero && "whitespace-nowrap")}>
                {coluna.titulo}
              </th>
            ))}
            <th scope="col" className="px-3 py-2 font-medium">
              Autos
            </th>
            <th scope="col" className="px-3 py-2 text-right font-medium">
              Decisão
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#e6eef0]">
          {ordenada.map((sugestao) => {
            const dados = (sugestao.valor as ItemSugerido).dados;
            const expandida = aberta === sugestao.id;
            return (
              <Fragment key={sugestao.id}>
                <tr className={cn("align-top hover:bg-[#f7fbfc]", expandida && "bg-[#f7fbfc]")}>
                  {colunas.map((coluna, indice) => (
                    <td key={coluna.titulo} className={cn("px-3 py-2", coluna.numero && "whitespace-nowrap tabular-nums", indice === 0 && "font-medium text-[#10293a]")}>
                      {coluna.valor(dados)}
                    </td>
                  ))}
                  <td className="whitespace-nowrap px-3 py-2">
                    <button
                      type="button"
                      onClick={() => setAberta(expandida ? null : sugestao.id)}
                      className="inline-flex items-center gap-1 text-xs text-[#347796] underline-offset-4 hover:underline"
                      title="Ver o trecho dos autos"
                    >
                      {sugestao.pagina ? `p. ${sugestao.pagina}` : "trecho"}
                      {sugestao.trechoConferido ? <Check className="size-3 text-emerald-700" aria-label="trecho conferido no PDF" /> : <TriangleAlert className="size-3 text-amber-700" aria-label="trecho não localizado no PDF" />}
                    </button>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right">
                    <div className="inline-flex gap-1">
                      <Button size="icon" className="size-8" disabled={Boolean(ocupado)} onClick={() => onAprovar(sugestao)} aria-label="Aprovar" title="Aprovar">
                        {ocupado === `aprovar:${sugestao.id}` ? <LoaderCircle className="animate-spin" /> : <Check />}
                      </Button>
                      <Button size="icon" variant="outline" className="size-8" disabled={Boolean(ocupado)} onClick={() => onEditar(sugestao)} aria-label="Editar e aprovar" title="Editar e aprovar">
                        <PencilLine />
                      </Button>
                      <Button size="icon" variant="ghost" className="size-8" disabled={Boolean(ocupado)} onClick={() => onRecusar(sugestao)} aria-label="Recusar" title="Recusar">
                        {ocupado === `recusar:${sugestao.id}` ? <LoaderCircle className="animate-spin" /> : <X />}
                      </Button>
                    </div>
                  </td>
                </tr>
                {expandida && sugestao.trecho ? (
                  <tr>
                    <td colSpan={colunas.length + 2} className="px-3 pb-3">
                      <Trecho sugestao={sugestao} onAbrir={sugestao.documentoId && comPdf.has(sugestao.documentoId) ? () => onAbrir(sugestao) : undefined} />
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Fila de aprovação das sugestões da IA. Cada sugestão mostra o que propõe, o trecho dos autos e a
 * página; a pessoa aprova, edita antes de aprovar ou recusa. Só a aprovação grava no cadastro.
 */
export function PainelSugestoes({
  processo,
  autos,
  onDecidido,
  onErro,
}: {
  processo: ProcessoDetalhe;
  autos: AutosDoProcesso;
  onDecidido: (decisao: Decisao, mensagem: string) => void;
  onErro: (mensagem: string) => void;
}) {
  const tituloId = useId();
  const [ocupado, setOcupado] = useState("");
  const [editando, setEditando] = useState<Sugestao | null>(null);

  const pendentes = autos.sugestoes.filter((item) => item.situacao === "pendente");
  // A síntese do processo vem no topo (é o que a pessoa lê primeiro); depois as de capa, que completam o
  // cabeçalho, e por fim as demais dos autos.
  const ordem = (sugestao: Sugestao) => (ehSintese(sugestao) ? 0 : ehRedigida(sugestao) ? 1 : ehDaCapa(sugestao) ? 2 : 3);
  pendentes.sort((a, b) => ordem(a) - ordem(b));
  // A fila em blocos, cada um com o seu "aprovar todos": textos redigidos, capa oficial, cadastro, partes e,
  // em tabela, os itens da Rec. Crédito (títulos, citações, pedidos, guias, levantamentos).
  const usadas = new Set<string>();
  const pegar = (filtro: (sugestao: Sugestao) => boolean) => {
    const lista = pendentes.filter((item) => !usadas.has(item.id) && filtro(item));
    for (const item of lista) usadas.add(item.id);
    return lista;
  };
  const dadoRec = (item: Sugestao) => (item.valor as ItemSugerido).dados;
  const todosOsGrupos: GrupoDeSugestoes[] = [
    { chave: "redigidas", titulo: "Síntese e situação do processo", descricao: "Redigidas pela IA com o conjunto dos autos.", lista: pegar((item) => item.tipo === "campo" && CAMPOS_REDIGIDOS.has(item.campo ?? "")), lote: false },
    { chave: "capa", titulo: "Capa pelas fontes oficiais", descricao: "DataJud e número CNJ.", lista: pegar(ehDaCapa), lote: true, nome: "sugestões de capa" },
    { chave: "titulos", titulo: "Títulos", descricao: "Títulos executados lidos nos autos.", lista: pegar((item) => item.tipo === "rec_credito" && item.campo === "titulo"), lote: true, nome: "títulos", tabela: "titulo" as const },
    { chave: "citacoes", titulo: "Tentativas de citação", lista: pegar((item) => item.tipo === "rec_credito" && item.campo === "citacao"), lote: true, nome: "citações", tabela: "citacao" as const },
    { chave: "pedidos", titulo: "Pedidos de execução", lista: pegar((item) => item.tipo === "rec_credito" && item.campo === "pedido"), lote: true, nome: "pedidos", tabela: "pedido" as const },
    { chave: "guias", titulo: "Guias pagas", descricao: "Entram no valor atualizado, a cobrar do devedor.", lista: pegar((item) => item.tipo === "rec_credito" && item.campo === "lancamento" && dadoRec(item).tipo === "guia_paga"), lote: true, nome: "guias pagas", tabela: "guia" as const },
    { chave: "levantamentos", titulo: "Valores levantados", descricao: "Abatidos do valor atualizado.", lista: pegar((item) => item.tipo === "rec_credito" && item.campo === "lancamento"), lote: true, nome: "levantamentos", tabela: "levantamento" as const },
    {
      chave: "trab_afastamentos",
      titulo: "Afastamentos pelo INSS",
      descricao: "Saem do período do adicional no cálculo do risco.",
      lista: pegar((item) => item.tipo === "trabalhista" && item.campo === "afastamento"),
      lote: true,
      nome: "afastamentos",
    },
    {
      chave: "trab_pedidos",
      titulo: "Pedidos e decisões",
      descricao: "Pedidos da inicial com o resultado na sentença, no acórdão e no recurso de revista.",
      lista: pegar((item) => item.tipo === "trabalhista" && item.campo === "pedido"),
      lote: true,
      nome: "pedidos",
    },
    {
      chave: "acordos",
      titulo: "Acordos",
      descricao: "Acordo, pagamentos das parcelas e descumprimento lidos nos autos. O acordo entra antes dos pagamentos.",
      // Em lote, o acordo é gravado antes dos pagamentos e do descumprimento, que dependem dele.
      lista: pegar((item) => item.tipo === "acordo").sort((a, b) => ORDEM_ACORDO[a.campo ?? ""] - ORDEM_ACORDO[b.campo ?? ""]),
      lote: true,
      nome: "acordos",
    },
    { chave: "partes", titulo: "Partes e contatos", lista: pegar((item) => item.tipo !== "campo" && item.tipo !== "rec_credito" && item.tipo !== "acordo" && item.tipo !== "trabalhista"), lote: false },
    { chave: "cadastro", titulo: "Cadastro", descricao: "Valores, datas e dados do processo lidos nos autos.", lista: pegar(() => true), lote: true, nome: "dados do cadastro" },
  ];
  const grupos = todosOsGrupos.filter((grupo) => grupo.lista.length > 0);
  const decididas = autos.sugestoes.filter((item) => item.situacao !== "pendente").sort((a, b) => (b.decididoEm ?? "").localeCompare(a.decididoEm ?? ""));
  if (!pendentes.length && !decididas.length) return null;

  async function decidir(sugestao: Sugestao, corpo: Record<string, unknown>, mensagem: string) {
    const decisao = await processosApi.post<Decisao>(`/autos/sugestoes/${sugestao.id}`, corpo);
    setEditando(null);
    onDecidido(decisao, mensagem);
  }

  /** Aprova, uma a uma, as sugestões de capa das fontes oficiais (DataJud e número CNJ). */
  /** Aprova, uma a uma, as sugestões de um grupo (a capa das fontes oficiais, os títulos lidos nos autos…). */
  async function aprovarEmLote(lista: Sugestao[], chave: string, nome: string) {
    setOcupado(chave);
    onErro("");
    let aprovadas = 0;
    let ultima: Decisao | null = null;
    const falhas: string[] = [];
    for (const sugestao of lista) {
      try {
        ultima = await processosApi.post<Decisao>(`/autos/sugestoes/${sugestao.id}`, { acao: "aprovar" });
        aprovadas += 1;
      } catch (falha) {
        falhas.push(`${sugestao.resumo.slice(0, 80)}: ${mensagemDeErro(falha)}`);
      }
    }
    setOcupado("");
    if (falhas.length) onErro(`${aprovadas ? `${aprovadas} aprovada${aprovadas === 1 ? "" : "s"}. ` : ""}${falhas.length} não ${falhas.length === 1 ? "entrou" : "entraram"} (edite ou recuse):\n${falhas.slice(0, 5).join("\n")}`);
    if (ultima) onDecidido(ultima, `Aprovação em lote (${nome}): ${aprovadas} de ${lista.length} gravad${lista.length === 1 ? "a" : "as"}.`);
  }

  async function decidirNaLista(sugestao: Sugestao, acao: "aprovar" | "recusar") {
    setOcupado(`${acao}:${sugestao.id}`);
    onErro("");
    try {
      await decidir(sugestao, { acao }, acao === "aprovar" ? "Sugestão aprovada e gravada no cadastro." : "Sugestão recusada.");
    } catch (falha) {
      onErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  // O PDF é temporário: depois de descartado, a conferência é pelo trecho (o link some).
  const comPdf = new Set(autos.documentos.filter((documento) => !documento.arquivoRemovidoEm).map((documento) => documento.id));
  const abrir = (sugestao: Sugestao) => {
    if (sugestao.documentoId) void abrirAutos(sugestao.documentoId, sugestao.pagina).catch((falha) => onErro(mensagemDeErro(falha)));
  };

  // Formulário de parte para conferir: a pessoa nova, ou a parte já cadastrada com o dado proposto.
  const deParte = editando && editando.tipo !== "campo" && editando.tipo !== "rec_credito" && editando.tipo !== "acordo" && editando.tipo !== "trabalhista" ? editando : null;
  const parteEmEdicao = deParte ? (processo.partes.find((item) => item.id === deParte.parteId) ?? null) : null;
  const dadosDaParte: ParteEntrada | null = deParte
    ? deParte.tipo === "parte_nova"
      ? entradaDaPessoa(deParte.valor as PessoaSugerida, processo.partes)
      : parteEmEdicao
        ? aplicarNaParte(parteEmEdicao, deParte.tipo, deParte.valor)
        : null
    : null;
  const itemEmEdicao = editando?.tipo === "rec_credito" ? (editando.valor as ItemSugerido) : null;

  // Na reclamação trabalhista, o "devedor" das regras de partes é o reclamante, e o advogado dele.
  const trabalhista = ehTrabalhista(processo.valores.area);
  const rotuloDoItem = (item: string) => {
    if (trabalhista && item.startsWith("advogado_executado")) return item.endsWith("contatos") ? "Advogado do reclamante: contatos" : "Advogado do reclamante";
    if (trabalhista && item.startsWith("executado_")) return "Reclamante";
    return ROTULO_ITEM.get(item) ?? "Cadastro";
  };

  function cartao(sugestao: Sugestao) {
    const aprovando = ocupado === `aprovar:${sugestao.id}`;
    const recusando = ocupado === `recusar:${sugestao.id}`;
    const parteSumiu =
      sugestao.tipo !== "campo" &&
      sugestao.tipo !== "parte_nova" &&
      sugestao.tipo !== "rec_credito" &&
      sugestao.tipo !== "acordo" &&
      sugestao.tipo !== "trabalhista" &&
      !processo.partes.some((item) => item.id === sugestao.parteId);
    return (
      <li key={sugestao.id} className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
        <div className="min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {sugestao.fonte && sugestao.fonte !== "autos" ? (
              <Selo tom="marca" icone={Landmark}>
                {FONTE[sugestao.fonte]}
              </Selo>
            ) : null}
            <Selo tom="ia">{sugestao.tipo === "campo" ? (ROTULO_GRUPO.get(campoPorChave(sugestao.campo ?? "")?.grupo ?? "") ?? "Cadastro") : rotuloDoItem(sugestao.item)}</Selo>
            {ehRedigida(sugestao) || !sugestao.trecho ? <Selo tom="neutro">{ehRedigida(sugestao) ? "Redigida pela IA a partir dos autos" : "Calculada"}</Selo> : <Selo tom={CONFIANCA[sugestao.confianca].tom}>{CONFIANCA[sugestao.confianca].rotulo}</Selo>}
            {sugestao.trecho && !sugestao.trechoConferido ? (
              <Selo tom="alerta" icone={TriangleAlert}>
                Trecho não localizado no PDF
              </Selo>
            ) : null}
          </div>
          <div className="space-y-0.5">
            <Proposta sugestao={sugestao} processo={processo} />
          </div>
          {sugestao.trecho ? <Trecho sugestao={sugestao} onAbrir={sugestao.documentoId && comPdf.has(sugestao.documentoId) ? () => abrir(sugestao) : undefined} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:flex-col lg:items-stretch">
          <Button size="sm" disabled={Boolean(ocupado) || parteSumiu} onClick={() => void decidirNaLista(sugestao, "aprovar")}>
            {aprovando ? <LoaderCircle className="animate-spin" /> : <Check />} Aprovar
          </Button>
          {sugestao.tipo === "acordo" || sugestao.tipo === "trabalhista" ? null : (
            <Button size="sm" variant="outline" disabled={Boolean(ocupado) || parteSumiu} onClick={() => setEditando(sugestao)}>
              <PencilLine /> Editar
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={Boolean(ocupado)} onClick={() => void decidirNaLista(sugestao, "recusar")}>
            {recusando ? <LoaderCircle className="animate-spin" /> : <X />} Recusar
          </Button>
        </div>
      </li>
    );
  }

  return (
    <Painel aria-labelledby={tituloId}>
      <PainelTopo titulo="Sugestões" id={tituloId} descricao="Da IA lendo os autos e das fontes oficiais (DataJud e número CNJ). Nada entra no cadastro antes da sua decisão: confira, aprove, edite ou recuse.">
        {pendentes.length ? (
          <Selo tom="ia" icone={Sparkles}>
            {pendentes.length} a conferir
          </Selo>
        ) : (
          <Selo tom="sucesso" icone={Check}>
            Tudo conferido
          </Selo>
        )}
      </PainelTopo>

      {grupos.map((grupo) => (
        <section key={grupo.chave} aria-label={grupo.titulo} className="border-t border-[#e6eef0] first:border-t-0">
          <header className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-[#f7fbfc] px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-semibold uppercase text-[#285f7a]">
                {grupo.titulo} <span className="font-normal tabular-nums text-muted-foreground">({grupo.lista.length})</span>
              </h3>
              {grupo.descricao ? <p className="text-xs text-muted-foreground">{grupo.descricao}</p> : null}
            </div>
            {grupo.lote && grupo.lista.length > 1 ? (
              <Button size="sm" variant="outline" disabled={Boolean(ocupado)} onClick={() => void aprovarEmLote(grupo.lista, `lote:${grupo.chave}`, grupo.nome ?? grupo.titulo.toLowerCase())} title="Aprova de uma vez as sugestões deste bloco; as que derem erro ficam na fila">
                {ocupado === `lote:${grupo.chave}` ? <LoaderCircle className="animate-spin" /> : <CheckCheck />} Aprovar todos ({grupo.lista.length})
              </Button>
            ) : null}
          </header>
          {grupo.tabela ? (
            <TabelaRecCredito
              tipo={grupo.tabela}
              lista={grupo.lista}
              ocupado={ocupado}
              comPdf={comPdf}
              onAprovar={(sugestao) => void decidirNaLista(sugestao, "aprovar")}
              onRecusar={(sugestao) => void decidirNaLista(sugestao, "recusar")}
              onEditar={setEditando}
              onAbrir={abrir}
            />
          ) : (
            <ul className="divide-y divide-[#e6eef0] border-t border-[#e6eef0]">{grupo.lista.map((sugestao) => cartao(sugestao))}</ul>
          )}
        </section>
      ))}

      {decididas.length ? (
        <details className="border-t border-[#e6eef0] first:border-t-0">
          <summary className="cursor-pointer px-4 py-2.5 text-xs font-medium text-[#285f7a] hover:bg-[#f7fbfc]">
            {decididas.length} sugest{decididas.length === 1 ? "ão decidida" : "ões decididas"}
          </summary>
          <ul className="divide-y divide-[#e6eef0] border-t border-[#e6eef0]">
            {decididas.map((sugestao) => (
              <li key={sugestao.id} className="flex flex-wrap items-start gap-x-3 gap-y-1 px-4 py-2.5">
                <p className="min-w-0 flex-1 break-words text-sm text-foreground">{sugestao.resumo}</p>
                <Selo tom={sugestao.situacao === "aprovada" ? "sucesso" : "neutro"}>{sugestao.situacao === "aprovada" ? "Aprovada" : "Recusada"}</Selo>
                <p className="w-full text-[11px] text-muted-foreground">
                  {formatarDataHora(sugestao.decididoEm)}
                  {sugestao.decididoPor ? ` · ${sugestao.decididoPor}` : ""}
                  {sugestao.pagina ? ` · página ${sugestao.pagina}` : ""}
                </p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}

      {editando?.tipo === "campo" ? (
        <ConferirCampo
          key={editando.id}
          sugestao={editando}
          uf={typeof processo.valores.uf === "string" && processo.valores.uf ? processo.valores.uf : null}
          onFechar={() => setEditando(null)}
          aprovar={(corpo) => decidir(editando, { acao: "aprovar", ...corpo }, "Sugestão aprovada com o seu ajuste e gravada no cadastro.")}
        />
      ) : null}
      {editando && itemEmEdicao ? (
        <ConferirItemSugerido
          key={editando.id}
          item={itemEmEdicao.item}
          dados={itemEmEdicao.dados}
          tipos={itemEmEdicao.tipos ?? []}
          trecho={editando.trecho ? <Trecho sugestao={editando} /> : null}
          onFechar={() => setEditando(null)}
          aprovar={(dados) => decidir(editando, { acao: "aprovar", valor: dados }, "Sugestão aprovada com o seu ajuste e incluída na Rec. Crédito.")}
        />
      ) : null}
      {editando && dadosDaParte ? (
        <EditarParte
          key={editando.id}
          processoId={processo.id}
          parte={parteEmEdicao}
          outras={processo.partes}
          sugestao={{ dados: dadosDaParte, aprovar: (parte) => decidir(editando, { acao: "aprovar", parte }, "Sugestão aprovada e gravada nas partes do processo.") }}
          onFechar={() => setEditando(null)}
          onSalvo={() => setEditando(null)}
        />
      ) : null}
    </Painel>
  );
}
