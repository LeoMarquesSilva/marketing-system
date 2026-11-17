"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Banknote, FileText, Gavel, LoaderCircle, MapPin, PencilLine, Plus, Scale, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  MEIOS_CITACAO,
  RESULTADOS_CITACAO,
  ROTULO_DO_ITEM,
  ROTULO_SITUACAO_CITACAO,
  SITUACOES_PEDIDO,
  TIPOS_LANCAMENTO,
  TIPOS_PEDIDO,
  formatarData,
  formatarReal,
  situacaoDaCitacao,
  type RecCreditoDoProcesso,
  type TipoItem,
} from "@/lib/processos/rec-credito";
import { CampoData } from "../vistagem/campo-data";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Celula } from "../vistagem/ficha-pasta";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Campo, Painel, PainelTopo, Secao, Selo, type TomSelo } from "../vistagem/ui";
import { abrirAutos, mensagemDeErro, processosApi } from "./processos-api";

type Formulario = Record<string, string>;

interface CampoForm {
  chave: string;
  rotulo: string;
  tipo: "texto" | "longo" | "data" | "valor" | "opcao" | "sugestao";
  opcoes?: readonly { valor: string; rotulo: string }[];
  obrigatorio?: boolean;
  largo?: boolean;
}

function camposDoTipo(tipo: TipoItem, tiposTitulo: string[]): CampoForm[] {
  switch (tipo) {
    case "titulo":
      return [
        { chave: "tipo", rotulo: "Tipo do título", tipo: "opcao", opcoes: tiposTitulo.map((valor) => ({ valor, rotulo: valor })), obrigatorio: true },
        { chave: "numero", rotulo: "Número", tipo: "texto" },
        { chave: "valor", rotulo: "Valor (R$)", tipo: "valor", obrigatorio: true },
        { chave: "vencimento", rotulo: "Vencimento", tipo: "data", obrigatorio: true },
      ];
    case "citacao":
      return [
        { chave: "tentativaEm", rotulo: "Data da tentativa", tipo: "data" },
        { chave: "meio", rotulo: "Meio", tipo: "opcao", opcoes: MEIOS_CITACAO, obrigatorio: true },
        { chave: "resultado", rotulo: "Resultado", tipo: "opcao", opcoes: RESULTADOS_CITACAO, obrigatorio: true },
        { chave: "endereco", rotulo: "Endereço pleiteado", tipo: "longo", largo: true },
        { chave: "observacao", rotulo: "Observação", tipo: "longo", largo: true },
      ];
    case "pedido":
      return [
        { chave: "tipo", rotulo: "Pedido", tipo: "sugestao", opcoes: TIPOS_PEDIDO.map((valor) => ({ valor, rotulo: valor })), obrigatorio: true },
        { chave: "pedidoEm", rotulo: "Data do pedido", tipo: "data" },
        { chave: "situacao", rotulo: "Situação", tipo: "opcao", opcoes: SITUACOES_PEDIDO, obrigatorio: true },
        { chave: "decididoEm", rotulo: "Data da decisão", tipo: "data" },
        { chave: "valorObtido", rotulo: "Valor obtido (R$)", tipo: "valor" },
        { chave: "descricao", rotulo: "Descrição", tipo: "longo", largo: true },
        { chave: "resultado", rotulo: "Resultado", tipo: "longo", largo: true },
      ];
    case "lancamento":
      return [
        { chave: "tipo", rotulo: "Tipo", tipo: "opcao", opcoes: TIPOS_LANCAMENTO, obrigatorio: true },
        { chave: "data", rotulo: "Data", tipo: "data", obrigatorio: true },
        { chave: "valor", rotulo: "Valor (R$)", tipo: "valor", obrigatorio: true },
        { chave: "descricao", rotulo: "Descrição", tipo: "longo", largo: true },
      ];
  }
}

const PADRAO: Record<TipoItem, Formulario> = {
  titulo: {},
  citacao: { meio: "ar", resultado: "pendente" },
  pedido: { situacao: "requerido" },
  lancamento: { tipo: "guia_paga" },
};

const paraTexto = (valor: unknown) => (valor === null || valor === undefined ? "" : typeof valor === "number" ? valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : String(valor));

function formularioDoItem(item: object): Formulario {
  return Object.fromEntries(Object.entries(item).map(([chave, valor]) => [chave, paraTexto(valor)]));
}

const TOM_RESULTADO: Record<string, TomSelo> = { positiva: "sucesso", negativa: "perigo", pendente: "alerta", sem_tentativa: "neutro" };
const TOM_PEDIDO: Record<string, TomSelo> = { deferido: "sucesso", indeferido: "perigo", prejudicado: "neutro", requerido: "alerta" };
const rotulo = (lista: readonly { valor: string; rotulo: string }[], valor: string) => lista.find((item) => item.valor === valor)?.rotulo ?? valor;
const data = (iso: string | null) => (iso ? formatarData(iso) : "sem data");

type Edicao = { tipo: TipoItem; id: string | null; formulario: Formulario } | { tipo: TipoItem; id: string; excluir: true; descricao: string };

/** Saneamento da Recuperação de Crédito na ficha: títulos e cálculo, citações, pedidos e dinheiro. */
export function PainelRecCredito({ processoId, onFeito, onErro }: { processoId: string; onFeito: (mensagem: string) => void; onErro: (mensagem: string) => void }) {
  const [dados, setDados] = useState<RecCreditoDoProcesso | null>(null);
  const [tiposTitulo, setTiposTitulo] = useState<string[]>([]);
  const [falha, setFalha] = useState("");
  const [edicao, setEdicao] = useState<Edicao | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erroDialogo, setErroDialogo] = useState("");

  const carregar = useCallback(async () => {
    try {
      const resposta = await processosApi.get<{ recCredito: RecCreditoDoProcesso; tiposTitulo: string[] }>(`/${processoId}/rec-credito`);
      setDados(resposta.recCredito);
      setTiposTitulo(resposta.tiposTitulo);
      setFalha("");
    } catch (erro) {
      setFalha(mensagemDeErro(erro));
    }
  }, [processoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function abrir(tipo: TipoItem, item?: { id: string }) {
    setErroDialogo("");
    setEdicao({ tipo, id: item?.id ?? null, formulario: item ? formularioDoItem(item) : { ...PADRAO[tipo] } });
  }

  async function salvar() {
    if (!edicao) return;
    setSalvando(true);
    setErroDialogo("");
    try {
      let resposta: { recCredito: RecCreditoDoProcesso };
      let mensagem: string;
      if ("excluir" in edicao) {
        resposta = await processosApi.del(`/rec-credito/${edicao.tipo}/${edicao.id}`);
        mensagem = `${ROTULO_DO_ITEM[edicao.tipo]} excluído.`;
      } else {
        const corpo = Object.fromEntries(camposDoTipo(edicao.tipo, tiposTitulo).map((campo) => [campo.chave, edicao.formulario[campo.chave]?.trim() || null]));
        resposta = edicao.id ? await processosApi.put(`/rec-credito/${edicao.tipo}/${edicao.id}`, { dados: corpo }) : await processosApi.post(`/${processoId}/rec-credito`, { tipo: edicao.tipo, dados: corpo });
        mensagem = `${ROTULO_DO_ITEM[edicao.tipo]} ${edicao.id ? "salvo" : "incluído"}.`;
      }
      setDados(resposta.recCredito);
      setEdicao(null);
      onFeito(mensagem);
    } catch (erro) {
      setErroDialogo(mensagemDeErro(erro));
    } finally {
      setSalvando(false);
    }
  }

  if (falha && !dados) {
    return (
      <Painel>
        <PainelTopo titulo="Recuperação de Crédito" />
        <div className="p-4">
          <Aviso tom="erro" acao={<Button size="sm" variant="outline" className="-my-1" onClick={() => void carregar()}>Tentar de novo</Button>}>
            {falha}
          </Aviso>
        </div>
      </Painel>
    );
  }
  if (!dados) {
    return (
      <Painel>
        <PainelTopo titulo="Recuperação de Crédito" />
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden /> Carregando títulos e cálculo
        </p>
      </Painel>
    );
  }

  const { calculo } = dados;
  const guias = dados.lancamentos.filter((item) => item.tipo === "guia_paga").reduce((soma, item) => soma + item.valor, 0);
  const levantado = dados.lancamentos.filter((item) => item.tipo === "levantamento").reduce((soma, item) => soma + item.valor, 0);
  const saving = calculo.atual?.total ? (levantado / calculo.atual.total) * 100 : null;
  const situacaoCitacao = situacaoDaCitacao(dados.citacoes);
  const incluir = (tipo: TipoItem) => (
    <Button size="sm" variant="outline" onClick={() => abrir(tipo)}>
      <Plus /> Incluir
    </Button>
  );
  const acoes = (tipo: TipoItem, item: { id: string }, descricao: string) => (
    <div className="flex shrink-0 gap-1">
      <Button size="icon" variant="ghost" className="size-8" aria-label={`Editar ${descricao}`} onClick={() => abrir(tipo, item)}>
        <PencilLine />
      </Button>
      <Button size="icon" variant="ghost" className="size-8 text-red-700 hover:text-red-800" aria-label={`Excluir ${descricao}`} onClick={() => setEdicao({ tipo, id: item.id, excluir: true, descricao })}>
        <Trash2 />
      </Button>
    </div>
  );
  const fonte = (item: { documentoId: string | null; pagina: number | null; origem: string }) =>
    item.origem === "autos" && item.documentoId ? (
      <button type="button" className="text-xs text-[#285f7a] underline-offset-2 hover:underline" onClick={() => void abrirAutos(item.documentoId!, item.pagina).catch((erro: unknown) => onErro(mensagemDeErro(erro)))}>
        <FileText className="mr-1 inline size-3" aria-hidden />
        autos{item.pagina ? `, p. ${item.pagina}` : ""}
      </button>
    ) : null;

  return (
    <Painel>
      <PainelTopo
        titulo="Recuperação de Crédito"
        descricao={`Títulos, citações, pedidos de execução e dinheiro do processo. Cálculo pela Tabela Prática do TJSP (Lei 14.905/2024)${dados.indicesAte ? `, índices até ${dados.indicesAte.slice(5, 7)}/${dados.indicesAte.slice(0, 4)}` : ""}.`}
      />

      <div className="grid gap-x-6 gap-y-4 border-b border-[#e6eef0] p-4 sm:grid-cols-2 xl:grid-cols-4">
        <Celula rotulo="Valor original">
          <p className="text-sm font-semibold tabular-nums">{calculo.atual ? formatarReal(calculo.atual.original) : dados.titulos.length ? formatarReal(dados.titulos.reduce((soma, titulo) => soma + titulo.valor, 0)) : "—"}</p>
        </Celula>
        <Celula rotulo={`No ajuizamento${dados.dataAjuizamento ? ` (${formatarData(dados.dataAjuizamento)})` : ""}`}>
          <p className="text-sm font-semibold tabular-nums">{calculo.ajuizamento ? formatarReal(calculo.ajuizamento.total) : "—"}</p>
        </Celula>
        <Celula rotulo={`Atualizado (${formatarData(calculo.atual?.dataFinal ?? dados.dataFinal)})`}>
          <p className="text-sm font-semibold tabular-nums text-[#10293a]">{calculo.atual ? formatarReal(calculo.atual.total) : "—"}</p>
          {calculo.atual ? (
            <p className="text-xs text-muted-foreground tabular-nums">
              corrigido {formatarReal(calculo.atual.corrigido)} + juros {formatarReal(calculo.atual.juros)}
            </p>
          ) : null}
        </Celula>
        <Celula rotulo="Recuperado · saving">
          <p className="text-sm font-semibold tabular-nums">
            {formatarReal(levantado)}
            {saving !== null ? <span className="ml-1.5 font-normal text-muted-foreground">({saving.toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%)</span> : null}
          </p>
          <p className="text-xs text-muted-foreground tabular-nums">guias pagas {formatarReal(guias)}</p>
        </Celula>
        {calculo.avisos.length ? (
          <div className="sm:col-span-2 xl:col-span-4">
            <Aviso tom="alerta">{calculo.avisos.join("\n")}</Aviso>
          </div>
        ) : null}
      </div>

      <Secao titulo={`Títulos (${dados.titulos.length})`} acao={incluir("titulo")}>
        {dados.titulos.length ? (
          <ul className="divide-y divide-[#e6eef0] rounded-md border border-[#e6eef0]">
            {dados.titulos.map((titulo, indice) => {
              const atualizado = calculo.atual?.titulos[indice];
              const descricao = `${titulo.tipo}${titulo.numero ? ` nº ${titulo.numero}` : ""}`;
              return (
                <Linha key={titulo.id} icone={Scale} acoes={acoes("titulo", titulo, descricao)}>
                  <p className="text-sm font-medium">
                    {descricao} · <span className="tabular-nums">{formatarReal(titulo.valor)}</span>
                  </p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    vence {formatarData(titulo.vencimento)}
                    {atualizado ? ` · atualizado ${formatarReal(atualizado.total)} (correção ×${atualizado.fatorCorrecao.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}, juros ${atualizado.jurosPercentual.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%)` : ""} {fonte(titulo)}
                  </p>
                </Linha>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum título lançado. Inclua as notas promissórias, duplicatas ou CCBs executadas para o cálculo sair.</p>
        )}
      </Secao>

      <Secao
        titulo={
          <span className="inline-flex items-center gap-2">
            Citação ({dados.citacoes.length}) <Selo tom={TOM_RESULTADO[situacaoCitacao]} className="normal-case">{ROTULO_SITUACAO_CITACAO[situacaoCitacao]}</Selo>
          </span>
        }
        acao={incluir("citacao")}
      >
        {dados.citacoes.length ? (
          <ul className="divide-y divide-[#e6eef0] rounded-md border border-[#e6eef0]">
            {dados.citacoes.map((citacao) => {
              const descricao = `${rotulo(MEIOS_CITACAO, citacao.meio)} de ${data(citacao.tentativaEm)}`;
              return (
                <Linha key={citacao.id} icone={MapPin} acoes={acoes("citacao", citacao, `citação por ${descricao}`)}>
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {descricao}
                    <Selo tom={TOM_RESULTADO[citacao.resultado]}>{rotulo(RESULTADOS_CITACAO, citacao.resultado)}</Selo>
                  </p>
                  {citacao.endereco ? <p className="text-xs text-muted-foreground">{citacao.endereco}</p> : null}
                  {citacao.observacao ? <p className="text-xs text-muted-foreground">{citacao.observacao}</p> : null}
                  {fonte(citacao)}
                </Linha>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma tentativa de citação lançada.</p>
        )}
      </Secao>

      <Secao titulo={`Pedidos de execução (${dados.pedidos.length})`} acao={incluir("pedido")}>
        {dados.pedidos.length ? (
          <ul className="divide-y divide-[#e6eef0] rounded-md border border-[#e6eef0]">
            {dados.pedidos.map((pedido) => (
              <Linha key={pedido.id} icone={Gavel} acoes={acoes("pedido", pedido, `pedido ${pedido.tipo}`)}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {pedido.tipo} <span className="font-normal text-muted-foreground">{data(pedido.pedidoEm)}</span>
                  <Selo tom={TOM_PEDIDO[pedido.situacao]}>
                    {rotulo(SITUACOES_PEDIDO, pedido.situacao)}
                    {pedido.decididoEm ? ` em ${formatarData(pedido.decididoEm)}` : ""}
                  </Selo>
                </p>
                {pedido.descricao ? <p className="text-xs text-muted-foreground">{pedido.descricao}</p> : null}
                {pedido.resultado || pedido.valorObtido ? (
                  <p className="text-xs text-[#10293a]">
                    Resultado: {pedido.resultado ?? ""}
                    {pedido.valorObtido ? ` (${formatarReal(pedido.valorObtido)})` : ""}
                  </p>
                ) : null}
                {fonte(pedido)}
              </Linha>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum pedido lançado (SISBAJUD, RENAJUD, penhora…).</p>
        )}
      </Secao>

      <Secao titulo={`Guias pagas e valores levantados (${dados.lancamentos.length})`} acao={incluir("lancamento")}>
        {dados.lancamentos.length ? (
          <ul className="divide-y divide-[#e6eef0] rounded-md border border-[#e6eef0]">
            {dados.lancamentos.map((lancamento) => (
              <Linha key={lancamento.id} icone={Banknote} acoes={acoes("lancamento", lancamento, `${rotulo(TIPOS_LANCAMENTO, lancamento.tipo).toLowerCase()} de ${formatarData(lancamento.data)}`)}>
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <Selo tom={lancamento.tipo === "levantamento" ? "sucesso" : "neutro"}>{rotulo(TIPOS_LANCAMENTO, lancamento.tipo)}</Selo>
                  <span className="tabular-nums">{formatarReal(lancamento.valor)}</span>
                  <span className="font-normal text-muted-foreground tabular-nums">{formatarData(lancamento.data)}</span>
                </p>
                {lancamento.descricao ? <p className="text-xs text-muted-foreground">{lancamento.descricao}</p> : null}
                {fonte(lancamento)}
              </Linha>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhuma guia paga nem valor levantado.</p>
        )}
      </Secao>

      {edicao ? (
        "excluir" in edicao ? (
          <DialogoAcao
            aberto
            onFechar={() => setEdicao(null)}
            ocupado={salvando}
            icone={Trash2}
            tom="perigo"
            titulo={`Excluir ${ROTULO_DO_ITEM[edicao.tipo].toLowerCase()}`}
            descricao={`${edicao.descricao}. A exclusão fica no histórico do processo.`}
            rodape={
              <>
                <Button variant="outline" onClick={() => setEdicao(null)} disabled={salvando}>
                  Cancelar
                </Button>
                <Button variant="destructive" onClick={() => void salvar()} disabled={salvando}>
                  {salvando ? <LoaderCircle className="animate-spin" /> : null} Excluir
                </Button>
              </>
            }
          >
            {erroDialogo ? <Aviso tom="erro">{erroDialogo}</Aviso> : <span />}
          </DialogoAcao>
        ) : (
          <FormularioItem
            edicao={edicao}
            campos={camposDoTipo(edicao.tipo, tiposTitulo)}
            salvando={salvando}
            erro={erroDialogo}
            onMudar={(chave, valor) => setEdicao((atual) => (atual && !("excluir" in atual) ? { ...atual, formulario: { ...atual.formulario, [chave]: valor } } : atual))}
            onFechar={() => setEdicao(null)}
            onSalvar={() => void salvar()}
          />
        )
      ) : null}
    </Painel>
  );
}

function Linha({ icone: Icone, acoes, children }: { icone: typeof Scale; acoes: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3 px-3 py-2.5">
      <Icone className="mt-0.5 size-4 shrink-0 text-[#3e84a8]" aria-hidden />
      <div className="min-w-0 flex-1 space-y-0.5">{children}</div>
      {acoes}
    </li>
  );
}

function FormularioItem({
  edicao,
  campos,
  salvando,
  erro,
  onMudar,
  onFechar,
  onSalvar,
}: {
  edicao: { tipo: TipoItem; id: string | null; formulario: Formulario };
  campos: CampoForm[];
  salvando: boolean;
  erro: string;
  onMudar: (chave: string, valor: string) => void;
  onFechar: () => void;
  onSalvar: () => void;
}) {
  const faltando = campos.filter((campo) => campo.obrigatorio && !edicao.formulario[campo.chave]?.trim()).map((campo) => campo.rotulo.replace(" (R$)", "").toLowerCase());
  const nome = ROTULO_DO_ITEM[edicao.tipo].toLowerCase();
  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={salvando}
      icone={edicao.id ? PencilLine : Plus}
      titulo={edicao.id ? `Editar ${nome}` : `Incluir ${nome}`}
      descricao="Lançamento à mão: fica no histórico do processo com o seu nome."
      className="sm:max-w-2xl"
      aviso={faltando.length ? `Falta: ${faltando.join(", ")}.` : undefined}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={onSalvar} disabled={salvando || faltando.length > 0}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        {campos.map((campo) => {
          const valor = edicao.formulario[campo.chave] ?? "";
          const mudar = (novo: string) => onMudar(campo.chave, novo);
          return (
            <Campo key={campo.chave} rotulo={`${campo.rotulo}${campo.obrigatorio ? " *" : ""}`} className={campo.largo ? "sm:col-span-2" : undefined}>
              {campo.tipo === "data" ? (
                <CampoData valor={valor} onChange={mudar} rotulo={campo.rotulo} permitirVazio={!campo.obrigatorio} />
              ) : campo.tipo === "opcao" ? (
                <Seletor valor={valor} onChange={mudar} opcoes={(campo.opcoes ?? []).map((opcao) => ({ valor: opcao.valor, rotulo: opcao.rotulo }))} rotulo={campo.rotulo} placeholder="Escolha…" />
              ) : campo.tipo === "longo" ? (
                <Textarea value={valor} onChange={(evento) => mudar(evento.target.value)} rows={2} />
              ) : campo.tipo === "sugestao" ? (
                <>
                  <Input value={valor} onChange={(evento) => mudar(evento.target.value)} list={`sugestoes-${campo.chave}`} placeholder="Escolha ou escreva" />
                  <datalist id={`sugestoes-${campo.chave}`}>
                    {(campo.opcoes ?? []).map((opcao) => (
                      <option key={opcao.valor} value={opcao.valor} />
                    ))}
                  </datalist>
                </>
              ) : (
                <Input value={valor} onChange={(evento) => mudar(evento.target.value)} inputMode={campo.tipo === "valor" ? "decimal" : undefined} placeholder={campo.tipo === "valor" ? "0,00" : undefined} />
              )}
            </Campo>
          );
        })}
      </div>
    </DialogoAcao>
  );
}
