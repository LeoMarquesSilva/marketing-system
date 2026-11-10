"use client";

import { useId, useState } from "react";
import { Check, CheckCheck, ExternalLink, Landmark, LoaderCircle, MapPin, PencilLine, Sparkles, TriangleAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AutosDoProcesso, Confianca, ContatoSugerido, EnderecoSugerido, PessoaSugerida, Sugestao, ValorDeCampo } from "@/lib/processos/autos-types";
import { GRUPOS_CAMPO, campoPorChave, estaPreenchido, formatarValor, rotuloDoCampo } from "@/lib/processos/campos";
import { ITENS_SANEAMENTO } from "@/lib/processos/preenchimento";
import { aplicarNaParte, entradaDaPessoa, linhaDoEndereco } from "@/lib/processos/sugestoes";
import { TIPOS_CONTATO, rotuloDoPapel, type ParteEntrada, type ProcessoDetalhe } from "@/lib/processos/types";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Aviso, Campo, Painel, PainelTopo, Selo, type TomSelo } from "../vistagem/ui";
import { Controle, doFormulario, paraFormulario } from "./editar-campos";
import { EditarParte } from "./editar-parte";
import { abrirAutos, formatarDataHora, mensagemDeErro, processosApi } from "./processos-api";

type Decisao = { processo: ProcessoDetalhe; autos: AutosDoProcesso };

const CONFIANCA: Record<Confianca, { tom: TomSelo; rotulo: string }> = {
  alta: { tom: "sucesso", rotulo: "Confiança alta" },
  media: { tom: "neutro", rotulo: "Confiança média" },
  baixa: { tom: "alerta", rotulo: "Confiança baixa" },
};

const ROTULO_ITEM = new Map(ITENS_SANEAMENTO.map((item) => [item.chave, item.rotulo]));
const ROTULO_GRUPO = new Map<string, string>(GRUPOS_CAMPO.map((grupo) => [grupo.id, grupo.rotulo]));
const ROTULO_CONTATO = new Map<string, string>(TIPOS_CONTATO.map((item) => [item.valor, item.rotulo]));

/** O que a sugestão propõe, em destaque: o valor do campo, o dado da parte ou a pessoa nova. */
function Proposta({ sugestao, processo }: { sugestao: Sugestao; processo: ProcessoDetalhe }) {
  const parte = sugestao.parteId ? processo.partes.find((item) => item.id === sugestao.parteId) : null;
  const deQuem = parte ? <span className="font-normal text-muted-foreground"> de {parte.nome}</span> : null;

  if (sugestao.tipo === "campo" && sugestao.campo) {
    const item = campoPorChave(sugestao.campo);
    const atual = processo.valores[sugestao.campo];
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

const FONTE: Record<Exclude<Sugestao["fonte"], undefined>, string> = { autos: "Autos (IA)", datajud: "DataJud", cnj: "Número CNJ" };
const ehDaCapa = (sugestao: Sugestao) => sugestao.fonte === "datajud" || sugestao.fonte === "cnj";

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
  // As de capa primeiro (são as que completam o cabeçalho do processo), depois as dos autos.
  pendentes.sort((a, b) => Number(ehDaCapa(b)) - Number(ehDaCapa(a)));
  const daCapa = pendentes.filter(ehDaCapa);
  const decididas = autos.sugestoes.filter((item) => item.situacao !== "pendente").sort((a, b) => (b.decididoEm ?? "").localeCompare(a.decididoEm ?? ""));
  if (!pendentes.length && !decididas.length) return null;

  async function decidir(sugestao: Sugestao, corpo: Record<string, unknown>, mensagem: string) {
    const decisao = await processosApi.post<Decisao>(`/autos/sugestoes/${sugestao.id}`, corpo);
    setEditando(null);
    onDecidido(decisao, mensagem);
  }

  /** Aprova, uma a uma, as sugestões de capa das fontes oficiais (DataJud e número CNJ). */
  async function aprovarCapa() {
    setOcupado("capa");
    onErro("");
    let aprovadas = 0;
    let ultima: Decisao | null = null;
    try {
      for (const sugestao of daCapa) {
        ultima = await processosApi.post<Decisao>(`/autos/sugestoes/${sugestao.id}`, { acao: "aprovar" });
        aprovadas += 1;
      }
    } catch (falha) {
      onErro(`${aprovadas ? `${aprovadas} aprovada${aprovadas === 1 ? "" : "s"}; ` : ""}${mensagemDeErro(falha)}`);
    } finally {
      setOcupado("");
      if (ultima) onDecidido(ultima, `${aprovadas} sugest${aprovadas === 1 ? "ão" : "ões"} de capa aprovada${aprovadas === 1 ? "" : "s"} e gravada${aprovadas === 1 ? "" : "s"} no cadastro.`);
    }
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
  const parteEmEdicao = editando && editando.tipo !== "campo" ? (processo.partes.find((item) => item.id === editando.parteId) ?? null) : null;
  const dadosDaParte: ParteEntrada | null =
    editando && editando.tipo !== "campo"
      ? editando.tipo === "parte_nova"
        ? entradaDaPessoa(editando.valor as PessoaSugerida, processo.partes)
        : parteEmEdicao
          ? aplicarNaParte(parteEmEdicao, editando.tipo, editando.valor)
          : null
      : null;

  return (
    <Painel aria-labelledby={tituloId}>
      <PainelTopo titulo="Sugestões" id={tituloId} descricao="Da IA lendo os autos e das fontes oficiais (DataJud e número CNJ). Nada entra no cadastro antes da sua decisão: confira, aprove, edite ou recuse.">
        {daCapa.length > 1 ? (
          <Button size="sm" variant="outline" disabled={Boolean(ocupado)} onClick={() => void aprovarCapa()} title="Aprova de uma vez as sugestões do DataJud e do número CNJ">
            {ocupado === "capa" ? <LoaderCircle className="animate-spin" /> : <CheckCheck />} Aprovar a capa ({daCapa.length})
          </Button>
        ) : null}
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

      {pendentes.length ? (
        <ul className="divide-y divide-[#e6eef0]">
          {pendentes.map((sugestao) => {
            const aprovando = ocupado === `aprovar:${sugestao.id}`;
            const recusando = ocupado === `recusar:${sugestao.id}`;
            const parteSumiu = sugestao.tipo !== "campo" && sugestao.tipo !== "parte_nova" && !processo.partes.some((item) => item.id === sugestao.parteId);
            return (
              <li key={sugestao.id} className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
                <div className="min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {/* No campo simples o nome do campo já vem logo abaixo: o selo diz a seção da ficha. */}
                    {sugestao.fonte && sugestao.fonte !== "autos" ? (
                      <Selo tom="marca" icone={Landmark}>
                        {FONTE[sugestao.fonte]}
                      </Selo>
                    ) : null}
                    <Selo tom="ia">{sugestao.tipo === "campo" ? (ROTULO_GRUPO.get(campoPorChave(sugestao.campo ?? "")?.grupo ?? "") ?? "Cadastro") : (ROTULO_ITEM.get(sugestao.item) ?? "Cadastro")}</Selo>
                    <Selo tom={CONFIANCA[sugestao.confianca].tom}>{CONFIANCA[sugestao.confianca].rotulo}</Selo>
                    {!sugestao.trechoConferido ? (
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
                  <Button size="sm" variant="outline" disabled={Boolean(ocupado) || parteSumiu} onClick={() => setEditando(sugestao)}>
                    <PencilLine /> Editar
                  </Button>
                  <Button size="sm" variant="ghost" disabled={Boolean(ocupado)} onClick={() => void decidirNaLista(sugestao, "recusar")}>
                    {recusando ? <LoaderCircle className="animate-spin" /> : <X />} Recusar
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

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
