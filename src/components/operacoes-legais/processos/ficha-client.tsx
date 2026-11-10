"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Ban,
  Check,
  CircleDashed,
  CloudUpload,
  Globe,
  History,
  LoaderCircle,
  Mail,
  MapPin,
  PencilLine,
  Phone,
  Plus,
  RefreshCw,
  RotateCcw,
  Trash2,
  TriangleAlert,
  UserRoundSearch,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GRUPOS_CAMPO, camposDoGrupo, estaPreenchido, formatarValor, rotuloDoCampo, type CampoProcesso, type GrupoCampo } from "@/lib/processos/campos";
import { POLOS, rotuloDoPapel, type Contato, type EnvioVios, type Parte, type ProcessoDetalhe } from "@/lib/processos/types";
import { cn } from "@/lib/utils";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { BOTAO_FAIXA, FaixaDoProcesso } from "../vistagem/faixa-processo";
import { Celula, LinkPastaVios } from "../vistagem/ficha-pasta";
import { LogoGrupo, SeloArea } from "../vistagem/marcas";
import { Aviso, Carregando, Painel, PainelTopo, Selo, Vazio, type TomSelo } from "../vistagem/ui";
import { AcessoProcessos } from "./acesso-processos";
import { EditarCampos } from "./editar-campos";
import { EditarParte } from "./editar-parte";
import { BarraPreenchimento } from "./preenchimento-ui";
import { formatarDataHora, mensagemDeErro, processosApi } from "./processos-api";

const ENVIO_ABERTO = new Set(["pendente", "enviado", "erro"]);

const SELO_ENVIO: Record<EnvioVios["status"], { tom: TomSelo; rotulo: string }> = {
  pendente: { tom: "alerta", rotulo: "Na fila" },
  enviado: { tom: "marca", rotulo: "Enviado ao robô" },
  confirmado: { tom: "sucesso", rotulo: "Confirmado no VIOS" },
  erro: { tom: "perigo", rotulo: "Erro" },
  cancelado: { tom: "neutro", rotulo: "Cancelado" },
};

const ORIGEM: Record<string, string> = { manual: "na tela", vios: "sincronização do VIOS", ia: "sugestão da IA" };

const ICONE_CONTATO = { celular: Phone, telefone: Phone, email: Mail, site: Globe } as const;

export function FichaClient({ id }: { id: string }) {
  return (
    <AcessoProcessos>
      <Ficha id={id} />
    </AcessoProcessos>
  );
}

function ValorDoCampo({ item, processo }: { item: CampoProcesso; processo: ProcessoDetalhe }) {
  const valor = processo.valores[item.chave];
  if (!estaPreenchido(valor)) return <p className="text-sm text-muted-foreground">—</p>;
  if (item.tipo === "lista" && Array.isArray(valor)) {
    return (
      <div className="flex flex-wrap gap-1">
        {valor.map((etiqueta) => (
          <Selo key={etiqueta} tom={/risco|cr[ií]tico/i.test(etiqueta) ? "perigo" : "neutro"}>
            {etiqueta}
          </Selo>
        ))}
      </div>
    );
  }
  const texto = formatarValor(item, valor);
  if (item.tipo === "texto_longo") return <p className="max-h-56 overflow-y-auto whitespace-pre-wrap break-words text-sm leading-6 text-foreground">{texto}</p>;
  if (/^https?:\/\//.test(texto)) {
    return (
      <a href={texto} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium text-[#347796] underline decoration-[#347796]/40 underline-offset-4 hover:text-[#285f7a]">
        Abrir o documento
      </a>
    );
  }
  return <p className={cn("break-words text-sm font-medium text-foreground", (item.tipo === "valor" || item.tipo === "data") && "tabular-nums")}>{texto}</p>;
}

function GrupoDeCampos({ grupo, titulo, processo, onEditar }: { grupo: GrupoCampo; titulo: string; processo: ProcessoDetalhe; onEditar: () => void }) {
  const id = useId();
  const campos = camposDoGrupo(grupo);
  const pendentes = new Set(processo.envios.filter((envio) => ENVIO_ABERTO.has(envio.status)).map((envio) => envio.campo));
  return (
    <Painel aria-labelledby={id}>
      <PainelTopo titulo={titulo} id={id}>
        <Button size="sm" variant="outline" onClick={onEditar}>
          <PencilLine /> Editar
        </Button>
      </PainelTopo>
      <div className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
        {campos.map((item) => (
          <Celula key={item.chave} rotulo={item.rotulo} className={item.tipo === "texto_longo" ? "sm:col-span-2 xl:col-span-3" : undefined}>
            <ValorDoCampo item={item} processo={processo} />
            {pendentes.has(item.chave) ? (
              <Selo tom="alerta" icone={CloudUpload} className="mt-1">
                A gravar no VIOS
              </Selo>
            ) : null}
          </Celula>
        ))}
      </div>
    </Painel>
  );
}

function LinhaDeContato({ contato }: { contato: Contato }) {
  const Icone = ICONE_CONTATO[contato.tipo];
  return (
    <li className="flex items-center gap-1.5 text-sm text-foreground">
      <Icone className="size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
      <span className="break-all">{contato.valor}</span>
      {contato.whatsapp ? <Selo tom="sucesso">WhatsApp</Selo> : null}
    </li>
  );
}

function CartaoDaParte({ parte, partes, onEditar, onExcluir }: { parte: Parte; partes: Parte[]; onEditar: () => void; onExcluir: () => void }) {
  const referente = parte.referenteA ? partes.find((item) => item.id === parte.referenteA)?.nome : null;
  return (
    <li className="px-4 py-3">
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
        <div className="min-w-0 flex-1 space-y-1">
          <Link href={`/operacoes-legais/pessoas/${parte.pessoaId}`} title="Abrir o cadastro da pessoa" className="block break-words text-sm font-semibold text-foreground underline-offset-4 hover:text-[#285f7a] hover:underline">
            {parte.nome}
          </Link>
          <div className="flex flex-wrap items-center gap-1">
            <Selo tom={parte.papel === "parte" ? "marca" : "ia"}>{parte.papel === "parte" ? (parte.vinculo ?? "Parte") : rotuloDoPapel(parte.papel)}</Selo>
            {parte.devedor ? <Selo tom="escuro">Devedor</Selo> : null}
            {parte.papel !== "parte" && parte.vinculo ? <span className="text-xs text-muted-foreground">{parte.vinculo}</span> : null}
            {referente ? <span className="text-xs text-muted-foreground">de {referente}</span> : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {parte.documento ? <span className="tabular-nums text-foreground">{parte.documento}</span> : "CPF/CNPJ não informado"}
            {parte.oab ? <span> · OAB {parte.oab}</span> : null}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon-sm" variant="ghost" aria-label={`Editar ${parte.nome}`} title="Editar" onClick={onEditar}>
            <PencilLine />
          </Button>
          <Button size="icon-sm" variant="ghost" aria-label={`Excluir ${parte.nome}`} title="Excluir" onClick={onExcluir}>
            <Trash2 />
          </Button>
        </div>
      </div>
      {parte.enderecos.length || parte.contatos.length ? (
        <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
          {parte.enderecos.length ? (
            <ul className="space-y-1">
              {parte.enderecos.map((endereco) => (
                <li key={endereco.id} className="flex items-start gap-1.5 text-sm text-foreground">
                  <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
                  <span className="break-words">{[endereco.endereco, endereco.cidade, endereco.uf, endereco.cep].filter(Boolean).join(" · ")}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {parte.contatos.length ? (
            <ul className="space-y-1">
              {parte.contatos.map((contato) => (
                <LinhaDeContato key={contato.id} contato={contato} />
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      {parte.observacao ? <p className="mt-2 whitespace-pre-wrap text-xs text-muted-foreground">{parte.observacao}</p> : null}
    </li>
  );
}

type Dialogo = { tipo: "campos"; grupo: GrupoCampo; titulo: string } | { tipo: "parte"; parte: Parte | null; polo: Parte["polo"] } | { tipo: "excluir"; parte: Parte } | null;

function Ficha({ id }: { id: string }) {
  const tituloId = useId();
  const [processo, setProcesso] = useState<ProcessoDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [ocupado, setOcupado] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await processosApi.get<{ processo: ProcessoDetalhe }>(`/${id}`);
      setProcesso(resposta.processo);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function salvo(atualizado: ProcessoDetalhe, mensagem: string) {
    setProcesso(atualizado);
    setDialogo(null);
    setFeito(mensagem);
  }

  async function excluirParte(parte: Parte) {
    setOcupado("excluir");
    try {
      const resposta = await processosApi.del<{ processo: ProcessoDetalhe }>(`/partes/${parte.id}`);
      salvo(resposta.processo, `${parte.nome} saiu do processo.`);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setDialogo(null);
    } finally {
      setOcupado("");
    }
  }

  async function marcarItem(chave: string, naoSeAplica: boolean) {
    setOcupado(chave);
    setErro("");
    try {
      const resposta = await processosApi.post<{ processo: ProcessoDetalhe }>(`/${id}/saneamento`, { chave, naoSeAplica });
      setProcesso(resposta.processo);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  if (!processo) {
    return erro ? (
      <Painel>
        <Vazio icone={TriangleAlert} titulo="Não foi possível abrir o processo">
          <p>{erro}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button variant="outline" onClick={() => void carregar()}>
              <RefreshCw /> Tentar de novo
            </Button>
            <Button asChild variant="outline">
              <Link href="/operacoes-legais/processos">
                <ArrowLeft /> Voltar à lista
              </Link>
            </Button>
          </div>
        </Vazio>
      </Painel>
    ) : (
      <Carregando rotulo="Abrindo o processo" />
    );
  }

  const { valores, partes, preenchimento } = processo;
  const texto = (chave: string) => (typeof valores[chave] === "string" ? (valores[chave] as string) : null);
  const etiquetas = Array.isArray(valores.etiquetas) ? valores.etiquetas : [];
  const risco = etiquetas.some((etiqueta) => /demanda de risco/i.test(etiqueta));
  const abertos = processo.envios.filter((envio) => ENVIO_ABERTO.has(envio.status));
  const semDevedor = !partes.some((parte) => parte.devedor);

  return (
    <div className="space-y-4">
      <Painel aria-labelledby={tituloId}>
        <FaixaDoProcesso
          numero={texto("cnj") ?? "Sem número CNJ"}
          tribunal={null}
          tituloId={tituloId}
          risco={risco}
          selos={
            <>
              {texto("situacao") ? (
                <Selo tom="escuro" className="bg-white/15 text-white ring-white/30">
                  {texto("situacao")}
                </Selo>
              ) : null}
              {texto("fase") ? (
                <Selo tom="escuro" className="bg-white/15 text-white ring-white/30">
                  {texto("fase")}
                </Selo>
              ) : null}
            </>
          }
        >
          <Button asChild size="sm" variant="outline" className={BOTAO_FAIXA}>
            <Link href="/operacoes-legais/processos">
              <ArrowLeft /> Processos
            </Link>
          </Button>
        </FaixaDoProcesso>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <LogoGrupo grupo={texto("grupo_cliente")} tamanho="lg" />
            <div className="min-w-0 space-y-1">
              <p className="truncate text-base font-semibold text-[#10293a]">{texto("grupo_cliente") ?? texto("cliente") ?? "Sem grupo"}</p>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                {texto("cliente") ? <span className="truncate">{texto("cliente")}</span> : null}
                {texto("area") ? <SeloArea area={texto("area") as string} /> : null}
                {texto("ci") ? <LinkPastaVios ci={texto("ci") as string} /> : null}
              </div>
            </div>
          </div>
          <Celula rotulo="Advogado responsável" className="min-w-40">
            <p className="text-sm font-medium text-foreground">{texto("advogado_responsavel") ?? "—"}</p>
          </Celula>
          <Celula rotulo="Ação" className="min-w-40 max-w-64">
            <p className="truncate text-sm font-medium text-foreground" title={texto("acao") ?? undefined}>
              {texto("acao") ?? "—"}
            </p>
          </Celula>
          <BarraPreenchimento feitos={preenchimento.feitos} total={preenchimento.total} percentual={preenchimento.percentual} className="w-40" />
        </div>
      </Painel>

      {feito ? <Aviso tom="sucesso">{feito}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_22rem] xl:items-start">
        <div className="min-w-0 space-y-4">
          {GRUPOS_CAMPO.filter((grupo) => grupo.id !== "credito" && grupo.id !== "andamento" && grupo.id !== "valores").map((grupo) => (
            <GrupoDeCampos key={grupo.id} grupo={grupo.id} titulo={grupo.rotulo} processo={processo} onEditar={() => setDialogo({ tipo: "campos", grupo: grupo.id, titulo: grupo.rotulo })} />
          ))}

          <Painel>
            <PainelTopo titulo="Partes e contatos" descricao="Quem participa do processo. Documento, endereços e contatos são do cadastro de Pessoas e valem em todos os processos de cada uma.">
              <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "parte", parte: null, polo: "passivo" })}>
                <Plus /> Incluir
              </Button>
            </PainelTopo>
            {semDevedor && partes.length ? (
              <div className="border-b border-[#e6eef0] p-3">
                <Aviso tom="alerta" titulo="Indique o devedor">
                  Nenhuma parte está marcada como devedor. Edite a parte certa e marque “É o devedor” para o saneamento cobrar os contatos dela.
                </Aviso>
              </div>
            ) : null}
            {partes.length ? (
              POLOS.map((polo) => {
                const doPolo = partes.filter((parte) => parte.polo === polo.valor);
                if (!doPolo.length) return null;
                return (
                  <section key={polo.valor}>
                    <h3 className="border-b border-[#e6eef0] bg-[#f7fbfc] px-4 py-2 text-xs font-semibold uppercase text-[#285f7a]">
                      {polo.rotulo} <span className="font-normal tabular-nums text-muted-foreground">({doPolo.length})</span>
                    </h3>
                    <ul className="divide-y divide-[#e6eef0] border-b border-[#e6eef0] last:border-b-0">
                      {doPolo.map((parte) => (
                        <CartaoDaParte key={parte.id} parte={parte} partes={partes} onEditar={() => setDialogo({ tipo: "parte", parte, polo: parte.polo })} onExcluir={() => setDialogo({ tipo: "excluir", parte })} />
                      ))}
                    </ul>
                  </section>
                );
              })
            ) : (
              <Vazio icone={Users} titulo="Nenhuma parte cadastrada">
                Inclua o devedor, os sócios, os fiadores e os advogados.
              </Vazio>
            )}
          </Painel>

          {(["credito", "valores", "andamento"] as const).map((grupo) => {
            const titulo = GRUPOS_CAMPO.find((item) => item.id === grupo)?.rotulo ?? grupo;
            return <GrupoDeCampos key={grupo} grupo={grupo} titulo={titulo} processo={processo} onEditar={() => setDialogo({ tipo: "campos", grupo, titulo })} />;
          })}
        </div>

        <div className="min-w-0 space-y-4">
          <Painel>
            <PainelTopo titulo="Saneamento" descricao="Lista de campos da equipe de Recuperação de Crédito." />
            <div className="border-b border-[#e6eef0] px-4 py-3">
              <BarraPreenchimento feitos={preenchimento.feitos} total={preenchimento.total} percentual={preenchimento.percentual} />
            </div>
            <ul className="divide-y divide-[#e6eef0]">
              {preenchimento.itens.map((item) => (
                <li key={item.chave} className="flex items-center gap-2 px-4 py-2">
                  {item.estado === "ok" ? (
                    <Check className="size-4 shrink-0 text-emerald-600" role="img" aria-label="Preenchido" />
                  ) : item.estado === "falta" ? (
                    <CircleDashed className="size-4 shrink-0 text-amber-600" role="img" aria-label="Falta" />
                  ) : (
                    <Ban className="size-4 shrink-0 text-slate-400" role="img" aria-label="Não se aplica" />
                  )}
                  <span className={cn("min-w-0 flex-1 text-sm", item.estado === "nao_se_aplica" ? "text-muted-foreground line-through" : "text-foreground")}>{item.rotulo}</span>
                  {item.automatico ? (
                    <span className="shrink-0 text-xs text-muted-foreground">Opcional</span>
                  ) : item.estado !== "ok" ? (
                    <Button
                      size="xs"
                      variant="ghost"
                      className="shrink-0 text-xs text-muted-foreground"
                      disabled={ocupado === item.chave}
                      title={item.estado === "falta" ? "Tirar este item da conta deste processo" : "Voltar a contar este item"}
                      onClick={() => void marcarItem(item.chave, item.estado === "falta")}
                    >
                      {ocupado === item.chave ? <LoaderCircle className="animate-spin" /> : item.estado === "falta" ? <Ban /> : <RotateCcw />}
                      {item.estado === "falta" ? "Não se aplica" : "Voltar"}
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          </Painel>

          <Painel>
            <PainelTopo titulo="Gravação no VIOS" descricao={processo.gravacaoSimulada ? "Modo simulado: a fila registra, o VIOS ainda não é alterado." : "As alterações da fila são gravadas no VIOS pelo robô."} />
            {abertos.length ? (
              <ul className="divide-y divide-[#e6eef0]">
                {abertos.map((envio) => (
                  <li key={envio.id} className="space-y-1 px-4 py-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground">{rotuloDoCampo(envio.campo)}</span>
                      <Selo tom={SELO_ENVIO[envio.status].tom}>{SELO_ENVIO[envio.status].rotulo}</Selo>
                    </div>
                    <p className="break-words text-xs text-muted-foreground">
                      <span className="line-through">{envio.valorVios || "vazio"}</span> → <span className="text-foreground">{envio.valorNovo || "vazio"}</span>
                    </p>
                    {envio.erro ? <p className="text-xs text-red-700">{envio.erro}</p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">Nada a gravar: o cadastro está igual ao do VIOS.</p>
            )}
            {processo.sincronizadoEm ? (
              <p className="border-t border-[#e6eef0] px-4 py-2.5 text-xs text-muted-foreground">
                Última sincronização: {formatarDataHora(processo.sincronizadoEm)}
                {processo.viosEditadoEm ? ` · editado no VIOS em ${processo.viosEditadoEm}` : ""}
              </p>
            ) : null}
          </Painel>

          <Painel>
            <PainelTopo titulo="Histórico" />
            {processo.historico.length ? (
              <ul className="max-h-[28rem] divide-y divide-[#e6eef0] overflow-y-auto">
                {processo.historico.map((item) => (
                  <li key={item.id} className="space-y-0.5 px-4 py-2.5">
                    <p className="text-sm font-medium text-foreground">{item.campo === "partes" ? "Partes" : item.campo === "saneamento" ? "Saneamento" : rotuloDoCampo(item.campo)}</p>
                    <p className="line-clamp-3 break-words text-xs text-muted-foreground">
                      {item.anterior ? <span className="line-through">{item.anterior}</span> : null}
                      {item.anterior && item.novo ? " → " : ""}
                      {item.novo ? <span className="text-foreground">{item.novo}</span> : item.anterior ? " → vazio" : ""}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatarDataHora(item.quando)} · {item.autor ?? ORIGEM[item.origem] ?? item.origem}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio icone={History} titulo="Sem alterações ainda" className="py-8" />
            )}
          </Painel>
        </div>
      </div>

      {dialogo?.tipo === "campos" ? (
        <EditarCampos
          processoId={processo.id}
          titulo={dialogo.titulo}
          campos={camposDoGrupo(dialogo.grupo)}
          valores={valores}
          gravacaoSimulada={processo.gravacaoSimulada}
          onFechar={() => setDialogo(null)}
          onSalvo={(atualizado) => salvo(atualizado, "Cadastro salvo.")}
        />
      ) : null}
      {dialogo?.tipo === "parte" ? (
        <EditarParte processoId={processo.id} parte={dialogo.parte} outras={partes} poloPadrao={dialogo.polo} onFechar={() => setDialogo(null)} onSalvo={(atualizado) => salvo(atualizado, "Parte salva.")} />
      ) : null}
      {dialogo?.tipo === "excluir" ? (
        <DialogoAcao
          aberto
          onFechar={() => setDialogo(null)}
          ocupado={ocupado === "excluir"}
          icone={UserRoundSearch}
          tom="perigo"
          titulo="Excluir a parte?"
          descricao={`${dialogo.parte.nome} sai deste processo, com os endereços e contatos cadastrados aqui.`}
          rodape={
            <>
              <Button variant="outline" onClick={() => setDialogo(null)} disabled={ocupado === "excluir"}>
                Manter
              </Button>
              <Button variant="destructive" onClick={() => void excluirParte(dialogo.parte)} disabled={ocupado === "excluir"}>
                {ocupado === "excluir" ? <LoaderCircle className="animate-spin" /> : <Trash2 />} Excluir
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">O VIOS não é alterado: lá a parte continua no processo.</p>
        </DialogoAcao>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {ocupado ? "Salvando" : ""}
      </span>
    </div>
  );
}
