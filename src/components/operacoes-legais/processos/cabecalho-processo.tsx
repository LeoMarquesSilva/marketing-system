"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, CloudUpload, FoldVertical, PencilLine, ShieldAlert, UnfoldVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { campoPorChave, estaPreenchido, formatarValor, type GrupoCampo } from "@/lib/processos/campos";
import type { Parte, ProcessoDetalhe } from "@/lib/processos/types";
import { cn } from "@/lib/utils";
import { chaveNome } from "@/lib/vistagem/agendamento";
import { AvatarPessoa } from "../vistagem/combobox-busca";
import { Celula, LinkPastaVios } from "../vistagem/ficha-pasta";
import { LogoGrupo, SeloArea } from "../vistagem/marcas";
import { Selo } from "../vistagem/ui";
import { BarraPreenchimento } from "./preenchimento-ui";

/** Grupos de campos que formam a capa do processo (ficam no cabeçalho; o resto fica no corpo da ficha). */
export const GRUPOS_DA_CAPA: GrupoCampo[] = ["identificacao", "classificacao", "responsaveis", "orgao", "datas", "andamento"];

const BOTAO = "border-[#b9d3dd] bg-white font-semibold text-[#285f7a] shadow-xs hover:border-[#47cdd0] hover:bg-[#e8f8f8] hover:text-[#183f50] [&_svg]:text-[#347796]";
const CHAVE_RECOLHIDA = "processos:capa-recolhida";

/** Capa aberta ou recolhida: começa aberta e a escolha vale para os próximos processos enquanto a aba estiver aberta. */
function useCapaRecolhida(): [boolean, () => void] {
  const [recolhida, setRecolhida] = useState(() => {
    try {
      return window.sessionStorage.getItem(CHAVE_RECOLHIDA) === "1";
    } catch {
      return false;
    }
  });
  function alternar() {
    setRecolhida((atual) => {
      try {
        window.sessionStorage.setItem(CHAVE_RECOLHIDA, atual ? "0" : "1");
      } catch {
        // Sem armazenamento (aba anônima): vale só para esta ficha.
      }
      return !atual;
    });
  }
  return [recolhida, alternar];
}

/** "Parte Passiva" → "Cliente no polo passivo". */
function frasePoloDoCliente(polo: string): string {
  if (/passiv/i.test(polo)) return "Cliente no polo passivo";
  if (/ativ/i.test(polo)) return "Cliente no polo ativo";
  return `Cliente: ${polo.toLowerCase()}`;
}

/** Texto longo da capa (objeto, síntese, andamento): 4 linhas e "Ver tudo". */
function TextoLongo({ texto }: { texto: string }) {
  const [inteiro, setInteiro] = useState(false);
  const longo = texto.length > 320 || texto.split("\n").length > 4;
  return (
    <div>
      <p className={cn("whitespace-pre-wrap break-words text-sm leading-6 text-foreground", !inteiro && longo && "line-clamp-4")}>{texto}</p>
      {longo ? (
        <button type="button" className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline" onClick={() => setInteiro((atual) => !atual)}>
          {inteiro ? "Mostrar menos" : "Ver tudo"}
        </button>
      ) : null}
    </div>
  );
}

const CHAVE_PAGINA = "processos:capa-pagina";

interface PaginaDaCapa {
  chave: string;
  titulo: string;
  /** Campos que o "Editar" da página abre. */
  grupos: GrupoCampo[];
  conteudo: ReactNode;
}

/**
 * A capa em páginas, para o cabeçalho não ficar comprido: abas com o nome de cada página, e as bolinhas e setas para
 * passar (como no VIOS). A página escolhida vale para os próximos processos enquanto a aba do navegador estiver aberta.
 */
function PaginasDaCapa({ paginas, onEditar }: { paginas: PaginaDaCapa[]; onEditar: (grupos: GrupoCampo[], titulo: string) => void }) {
  const id = useId();
  const [escolhida, setEscolhida] = useState(() => {
    try {
      return window.sessionStorage.getItem(CHAVE_PAGINA) ?? paginas[0].chave;
    } catch {
      return paginas[0].chave;
    }
  });
  const indice = Math.max(
    0,
    paginas.findIndex((pagina) => pagina.chave === escolhida),
  );
  const ir = (novo: number) => {
    const pagina = paginas[(novo + paginas.length) % paginas.length];
    setEscolhida(pagina.chave);
    try {
      window.sessionStorage.setItem(CHAVE_PAGINA, pagina.chave);
    } catch {
      // Sem armazenamento: vale só para esta ficha.
    }
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Páginas da capa" className="inline-flex rounded-md border border-[#c9dde6] bg-white p-0.5">
          {paginas.map((pagina, posicao) => (
            <button
              key={pagina.chave}
              type="button"
              role="tab"
              id={`${id}-aba-${pagina.chave}`}
              aria-selected={posicao === indice}
              aria-controls={`${id}-pagina`}
              tabIndex={posicao === indice ? 0 : -1}
              onClick={() => ir(posicao)}
              onKeyDown={(evento) => {
                if (evento.key === "ArrowRight") ir(indice + 1);
                if (evento.key === "ArrowLeft") ir(indice - 1);
              }}
              className={cn(
                "rounded px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#47cdd0]/50",
                posicao === indice ? "bg-[#183f50] text-white" : "text-[#285f7a] hover:bg-[#e8f8f8]",
              )}
            >
              {pagina.titulo}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <Button type="button" size="icon-sm" variant="ghost" className="text-[#347796]" onClick={() => ir(indice - 1)} aria-label="Página anterior da capa">
            <ChevronLeft />
          </Button>
          {paginas.map((pagina, posicao) => (
            <button
              key={pagina.chave}
              type="button"
              onClick={() => ir(posicao)}
              aria-label={`Ir para ${pagina.titulo}`}
              className={cn("size-2 rounded-full transition-colors", posicao === indice ? "bg-[#347796]" : "bg-[#b9d3dd] hover:bg-[#7fb0c4]")}
            />
          ))}
          <Button type="button" size="icon-sm" variant="ghost" className="text-[#347796]" onClick={() => ir(indice + 1)} aria-label="Próxima página da capa">
            <ChevronRight />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="ml-1 border-[#b9d3dd] bg-white font-semibold text-[#285f7a] hover:border-[#47cdd0] hover:bg-[#e8f8f8] [&_svg]:text-[#347796]"
            onClick={() => onEditar(paginas[indice].grupos, paginas[indice].titulo)}
          >
            <PencilLine /> Editar
          </Button>
        </div>
      </div>
      <div id={`${id}-pagina`} role="tabpanel" aria-labelledby={`${id}-aba-${paginas[indice].chave}`}>
        {paginas[indice].conteudo}
      </div>
    </div>
  );
}

/** "Maria Souza Lima" → "Maria Souza": cabe no cabeçalho; o nome inteiro fica no title. */
function nomeCurto(nome: string): string {
  const partes = nome.trim().split(/\s+/);
  return partes.length > 2 ? `${partes[0]} ${partes[1]}` : nome.trim();
}

function Pessoa({ papel, nomes, fotos }: { papel: string; nomes: string[]; fotos: Record<string, string> }) {
  const [primeiro, ...outros] = nomes;
  return (
    <div className="flex min-w-0 items-center gap-2">
      {primeiro ? (
        <span className="flex shrink-0 -space-x-1.5">
          {nomes.slice(0, 3).map((nome) => (
            <AvatarPessoa key={nome} nome={nome} foto={fotos[chaveNome(nome)]} className="size-8 ring-2 ring-[#e9f2f6]" />
          ))}
        </span>
      ) : (
        <AvatarPessoa nome="?" className="size-8 shrink-0 ring-1 ring-black/5" />
      )}
      <div className="min-w-0">
        <p className="text-[11px] font-medium text-[#285f7a]">{papel}</p>
        <p className="truncate text-sm font-medium text-foreground" title={nomes.join("; ") || undefined}>
          {primeiro ? nomeCurto(primeiro) : "—"}
          {outros.length ? <span className="font-normal text-muted-foreground"> e mais {outros.length}</span> : null}
        </p>
      </div>
    </div>
  );
}

/** Um polo com os nomes das partes (as que são "parte" no processo), o primeiro em destaque. */
function Polo({ rotulo, partes }: { rotulo: string; partes: Parte[] }) {
  const [todas, setTodas] = useState(false);
  const mostradas = todas ? partes : partes.slice(0, 2);
  const resto = partes.length - mostradas.length;
  return (
    <Celula rotulo={rotulo}>
      {partes.length ? (
        <ul className="space-y-0.5">
          {mostradas.map((parte) => (
            <li key={parte.id} className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-foreground">
              <span className="truncate" title={parte.nome}>
                {parte.nome}
              </span>
              {parte.devedor ? (
                <Selo tom="escuro" className="shrink-0">
                  devedor
                </Selo>
              ) : null}
            </li>
          ))}
          {resto > 0 ? (
            <li>
              <button type="button" className="text-xs font-medium text-[#347796] underline-offset-4 hover:underline" onClick={() => setTodas(true)}>
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

/**
 * Capa do processo no cabeçalho, no padrão da ficha da publicação na Vistagem: grupo e cliente com a área, a pasta
 * no VIOS e a equipe (com foto), e embaixo, em caixas, o processo (ação, fase, valor, partes) e o órgão com as datas.
 * Todos os campos da capa aparecem aqui, em páginas; cada bloco tem o seu "Editar" e "Editar capa" abre todos de uma vez. Recolhida, fica uma linha de resumo.
 */
export function CabecalhoDoProcesso({ processo, onEditar }: { processo: ProcessoDetalhe; onEditar: (grupos: GrupoCampo[], titulo: string) => void }) {
  /** Título de uma parte do quadro (Processo, Órgão e datas). */
  const subtitulo = (titulo: string) => <h3 className="col-span-full text-[11px] font-semibold uppercase tracking-wide text-[#285f7a]">{titulo}</h3>;
  const { valores, partes, preenchimento, fotos } = processo;
  const [recolhidaEscolha, alternar] = useCapaRecolhida();
  const recolhida = recolhidaEscolha;
  const id = useId();
  const pendentes = new Set(processo.envios.filter((envio) => envio.status === "pendente" || envio.status === "enviado" || envio.status === "erro").map((envio) => envio.campo));

  const texto = (chave: string) => (typeof valores[chave] === "string" && valores[chave] ? (valores[chave] as string) : null);
  /** O valor do campo como a ficha mostra (data, valor em reais, lista), ou null. */
  const mostrar = (chave: string) => {
    const item = campoPorChave(chave);
    const valor = valores[chave];
    return item && estaPreenchido(valor) ? formatarValor(item, valor) : null;
  };
  /** Célula de um campo da capa: rótulo, valor (ou —), linha de apoio e o aviso de gravação no VIOS. */
  const dado = (
    chave: string,
    opcoes: {
      rotulo?: string;
      apoio?: ReactNode;
      destaque?: boolean;
      className?: string;
    } = {},
  ) => {
    const valor = mostrar(chave);
    return (
      <Celula rotulo={opcoes.rotulo ?? campoPorChave(chave)?.rotulo ?? chave} className={opcoes.className}>
        <p className={cn("truncate text-sm tabular-nums", valor ? "font-medium text-foreground" : "text-muted-foreground", opcoes.destaque && valor && "font-semibold")} title={valor ?? undefined}>
          {valor ?? "—"}
        </p>
        {opcoes.apoio ? <div className="truncate text-[11px] text-muted-foreground">{opcoes.apoio}</div> : null}
        {pendentes.has(chave) ? (
          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-800" title="Alterado aqui; na fila para gravar no VIOS">
            <CloudUpload className="size-3" aria-hidden /> a gravar no VIOS
          </span>
        ) : null}
      </Celula>
    );
  };

  const grupo = texto("grupo_cliente");
  const cliente = texto("cliente");
  const area = texto("area");
  const etiquetas = Array.isArray(valores.etiquetas) ? valores.etiquetas : [];
  const risco = etiquetas.some((etiqueta) => /demanda de risco/i.test(etiqueta));
  // O VIOS guarda o auxiliar pela sigla: no cabeçalho, o nome completo (quando o catálogo do VIOS o identifica).
  const auxiliares = (Array.isArray(valores.auxiliares) ? valores.auxiliares : []).map((nome) => processo.nomesDaEquipe?.[nome] ?? nome);
  const advogado = texto("advogado_responsavel");
  const daParte = partes.filter((parte) => parte.papel === "parte");
  const ativo = daParte.filter((parte) => parte.polo === "ativo");
  const passivo = daParte.filter((parte) => parte.polo === "passivo");
  const local = [texto("cidade"), texto("uf")].filter(Boolean).join(" · ");
  const vara = [texto("orgao_julgador"), texto("tipo_orgao_julgador")].filter(Boolean).join(" ");
  const pasta = [texto("vinculo"), texto("situacao")].filter(Boolean).join(" · ");

  const resumo = [
    { chave: "acao", texto: texto("acao"), dica: "Tipo de ação" },
    { chave: "fase", texto: texto("fase"), dica: "Fase" },
    { chave: "valor", texto: mostrar("valor_acao"), dica: "Valor da ação" },
    {
      chave: "orgao",
      texto: texto("comarca_tribunal"),
      dica: "Comarca / Tribunal",
    },
  ].filter((parte): parte is { chave: string; texto: string; dica: string } => Boolean(parte.texto));

  return (
    <div className="@container space-y-3 px-4 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <LogoGrupo grupo={grupo} tamanho="lg" />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-muted-foreground">
            {area ? <SeloArea area={area} /> : <Selo tom="neutro">Sem área</Selo>}
            {risco ? (
              <Selo tom="perigo" icone={ShieldAlert}>
                Demanda de risco
              </Selo>
            ) : null}
            {texto("polo_cliente") ? <span>{frasePoloDoCliente(texto("polo_cliente") as string)}</span> : null}
          </p>
          <p className="truncate text-base font-semibold text-foreground" title={grupo ?? undefined}>
            {grupo ?? cliente ?? "Sem grupo"}
          </p>
          {cliente && cliente !== grupo ? (
            <p className="truncate text-xs text-muted-foreground" title={cliente}>
              {cliente}
            </p>
          ) : null}
        </div>
        <BarraPreenchimento feitos={preenchimento.feitos} total={preenchimento.total} percentual={preenchimento.percentual} className="w-40" />
        <Button type="button" variant="outline" size="sm" onClick={() => onEditar(GRUPOS_DA_CAPA, "Capa do processo")} className={BOTAO}>
          <PencilLine /> Editar capa
        </Button>
        <Button type="button" variant="outline" size="sm" aria-expanded={!recolhida} aria-controls={id} onClick={alternar} title={recolhida ? "Mostrar a capa inteira" : "Deixar só o resumo da capa"} className={BOTAO}>
          {recolhida ? <UnfoldVertical /> : <FoldVertical />}
          {recolhida ? "Expandir capa" : "Recolher capa"}
        </Button>
      </div>

      {recolhida ? (
        <div id={id} className="space-y-2 rounded-md border border-[#c9dde6] bg-[#e9f2f6] px-3 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {texto("ci") ? <LinkPastaVios ci={texto("ci") as string} /> : <span className="text-sm text-muted-foreground">Sem pasta</span>}
            {resumo.map((parte) => (
              <span key={parte.chave} className="flex min-w-0 items-center gap-2 text-sm">
                <span className="text-[#9fb8c2]" aria-hidden>
                  ·
                </span>
                <span className="truncate font-medium tabular-nums text-foreground" title={parte.dica}>
                  {parte.texto}
                </span>
              </span>
            ))}
            {advogado || auxiliares.length ? (
              <span className="ml-auto flex shrink-0 -space-x-1.5">
                {[advogado, ...auxiliares]
                  .filter((nome): nome is string => Boolean(nome))
                  .slice(0, 4)
                  .map((nome) => (
                    <span key={nome} title={nome}>
                      <AvatarPessoa nome={nome} foto={fotos[chaveNome(nome)]} className="size-7 ring-2 ring-[#e9f2f6]" />
                    </span>
                  ))}
              </span>
            ) : null}
          </div>
          {ativo.length || passivo.length ? (
            <p className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-x-2 border-t border-[#c9dde6] pt-2 text-xs">
              <span className="truncate font-medium text-foreground" title={ativo.map((parte) => parte.nome).join("; ")}>
                {ativo[0]?.nome ?? "—"}
                {ativo.length > 1 ? <span className="font-normal text-muted-foreground"> +{ativo.length - 1}</span> : null}
              </span>
              <span className="text-[11px] font-semibold text-[#285f7a]">×</span>
              <span className="truncate font-medium text-foreground" title={passivo.map((parte) => parte.nome).join("; ")}>
                {passivo[0]?.nome ?? "—"}
                {passivo.length > 1 ? <span className="font-normal text-muted-foreground"> +{passivo.length - 1}</span> : null}
              </span>
            </p>
          ) : null}
        </div>
      ) : (
        <div id={id} className="space-y-3 rounded-md border border-[#c9dde6] bg-[#e9f2f6] px-3 py-2.5">
          {/* Pasta e equipe: sempre à vista no alto do quadro. */}
          <div className="grid gap-x-4 gap-y-3 border-b border-[#c9dde6] pb-2.5 @md:grid-cols-[minmax(0,0.9fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <Celula rotulo="Pasta no VIOS">
              {texto("ci") ? (
                <>
                  <LinkPastaVios ci={texto("ci") as string} />
                  <p className="truncate text-[11px] text-muted-foreground" title={pasta || undefined}>
                    {pasta || "—"}
                    {texto("pasta_interna") ? ` · pasta interna ${texto("pasta_interna")}` : ""}
                  </p>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Sem pasta</p>
              )}
            </Celula>
            <Pessoa papel="Advogado responsável" nomes={advogado ? [advogado] : []} fotos={fotos} />
            <Pessoa papel={auxiliares.length > 1 ? "Auxiliares" : "Auxiliar"} nomes={auxiliares} fotos={fotos} />
          </div>

          {/* A capa em páginas (como os pontinhos do VIOS, com o nome de cada página): processo e órgão lado a lado; síntese e andamento. */}
          <PaginasDaCapa
            onEditar={onEditar}
            paginas={[
              {
                chave: "capa",
                titulo: "Processo e órgão",
                grupos: ["identificacao", "classificacao", "responsaveis", "orgao", "datas"],
                conteudo: (
                  <div className="grid gap-x-6 gap-y-4 @4xl:grid-cols-2 @4xl:divide-x @4xl:divide-[#c9dde6]">
                    <div className="grid content-start gap-x-4 gap-y-3 @md:grid-cols-2">
                      {subtitulo("Processo")}
                      {dado("acao", {
                        rotulo: "Tipo de ação",
                        destaque: true,
                        apoio: texto("materia") ? `Matéria: ${texto("materia")}` : null,
                      })}
                      {dado("fase", { apoio: texto("jurisdicao_atual") })}
                      {dado("valor_acao", {
                        apoio: mostrar("valor_acao_atualizado") ? `Atualizado: ${mostrar("valor_acao_atualizado")}` : null,
                      })}
                      {dado("departamento", {
                        apoio: texto("contrato_cliente") ? `Contrato: ${texto("contrato_cliente")}` : null,
                      })}
                      <Polo rotulo="Polo ativo" partes={ativo} />
                      <Polo rotulo="Polo passivo" partes={passivo} />
                      {etiquetas.length || mostrar("outros_numeros") ? (
                        <>
                          <Celula rotulo="Etiquetas">
                            {etiquetas.length ? (
                              <div className="flex flex-wrap gap-1">
                                {etiquetas.map((etiqueta) => (
                                  <Selo key={etiqueta} tom={/risco|cr[ií]tico/i.test(etiqueta) ? "perigo" : "neutro"}>
                                    {etiqueta}
                                  </Selo>
                                ))}
                              </div>
                            ) : (
                              <p className="text-sm text-muted-foreground">—</p>
                            )}
                          </Celula>
                          {dado("outros_numeros", { rotulo: "Outros números" })}
                        </>
                      ) : null}
                    </div>

                    <div className="grid content-start gap-x-4 gap-y-3 @md:grid-cols-2 @4xl:pl-6">
                      {subtitulo("Órgão e datas")}
                      {dado("comarca_tribunal", {
                        rotulo: "Comarca / Tribunal",
                        destaque: true,
                        apoio: local || null,
                      })}
                      <Celula rotulo="Vara / câmara">
                        <p className={cn("truncate text-sm", vara ? "font-medium text-foreground" : "text-muted-foreground")} title={vara || undefined}>
                          {vara || "—"}
                        </p>
                        {texto("magistrado") ? <p className="truncate text-[11px] text-muted-foreground">Magistrado: {texto("magistrado")}</p> : null}
                        {pendentes.has("orgao_julgador") || pendentes.has("tipo_orgao_julgador") ? (
                          <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                            <CloudUpload className="size-3" aria-hidden /> a gravar no VIOS
                          </span>
                        ) : null}
                      </Celula>
                      {dado("justica", { apoio: texto("jurisdicao_atual") })}
                      {dado("sistema_tribunal", { rotulo: "Sistema" })}
                      {dado("data_distribuicao", { rotulo: "Distribuição" })}
                      {dado("data_citacao", { rotulo: "Citação" })}
                      {dado("data_recebimento", { rotulo: "Recebimento da demanda" })}
                      {dado("data_cadastro", { rotulo: "Cadastro" })}
                      {mostrar("data_arquivamento") ? dado("data_arquivamento", { rotulo: "Arquivamento" }) : null}
                      {mostrar("data_encerramento") || mostrar("motivo_encerramento")
                        ? dado("data_encerramento", {
                            rotulo: "Encerramento",
                            apoio: texto("motivo_encerramento"),
                          })
                        : null}
                    </div>
                  </div>
                ),
              },
              {
                chave: "sintese",
                titulo: "Síntese e andamento",
                grupos: ["andamento"],
                conteudo: (
                  <div className="grid gap-x-6 gap-y-3 @md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                    <Celula rotulo={campoPorChave("sintese")?.rotulo ?? "Síntese"}>
                      {texto("sintese") ? <TextoLongo texto={texto("sintese") as string} /> : <p className="text-sm text-muted-foreground">—</p>}
                      {texto("objeto") ? (
                        <div className="mt-2">
                          <p className="text-[11px] font-medium text-[#285f7a]">Objeto</p>
                          <TextoLongo texto={texto("objeto") as string} />
                        </div>
                      ) : null}
                    </Celula>
                    <Celula rotulo={mostrar("ultimo_andamento_data") ? `Último andamento · ${mostrar("ultimo_andamento_data")}` : "Último andamento"}>
                      {texto("ultimo_andamento_texto") ? <TextoLongo texto={texto("ultimo_andamento_texto") as string} /> : <p className="text-sm text-muted-foreground">—</p>}
                      {["sintese", "objeto", "ultimo_andamento_texto", "ultimo_andamento_data"].some((chave) => pendentes.has(chave)) ? (
                        <span className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-800">
                          <CloudUpload className="size-3" aria-hidden /> a gravar no VIOS
                        </span>
                      ) : null}
                    </Celula>
                  </div>
                ),
              },
            ]}
          />
        </div>
      )}
    </div>
  );
}
