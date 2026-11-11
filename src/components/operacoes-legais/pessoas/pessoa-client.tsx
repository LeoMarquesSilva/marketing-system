"use client";

import { useCallback, useEffect, useId, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CopyCheck, Gavel, Globe, History, Link2, LoaderCircle, Mail, MapPin, Merge, PencilLine, Phone, Plus, RefreshCw, Trash2, TriangleAlert, UserRoundCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIPOS_VINCULO, rotuloDoVinculo } from "@/lib/processos/pessoas";
import { rotuloDoPapel, rotuloDoPolo, type PessoaDetalhe, type PessoaResumo } from "@/lib/processos/types";
import { AcessoProcessos } from "../processos/acesso-processos";
import { formatarDataHora, mensagemDeErro, pessoasApi } from "../processos/processos-api";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Celula } from "../vistagem/ficha-pasta";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Campo, Carregando, Painel, PainelTopo, Selo, Vazio } from "../vistagem/ui";
import { BuscarPessoa } from "./buscar-pessoa";
import { EditarPessoa } from "./editar-pessoa";
import { IconePessoa, tomDaCategoria } from "./pessoa-ui";

const ICONE_CONTATO = { celular: Phone, telefone: Phone, email: Mail, site: Globe } as const;
const OPCOES_VINCULO = TIPOS_VINCULO.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));
const DIRECOES = [
  { valor: "de", rotulo: "Esta pessoa é… da outra" },
  { valor: "para", rotulo: "A outra é… desta pessoa" },
];

export function PessoaClient({ id }: { id: string }) {
  return (
    <AcessoProcessos>
      <Ficha id={id} />
    </AcessoProcessos>
  );
}

type Dialogo = { tipo: "editar" } | { tipo: "vinculo" } | { tipo: "unificar"; outra: PessoaResumo } | null;

function NovoVinculo({ pessoa, onFechar, onSalvo }: { pessoa: PessoaDetalhe; onFechar: () => void; onSalvo: (pessoa: PessoaDetalhe) => void }) {
  const [outra, setOutra] = useState<PessoaResumo | null>(null);
  const [tipo, setTipo] = useState("socio");
  const [direcao, setDirecao] = useState("para");
  const [observacao, setObservacao] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  async function salvar() {
    if (!outra) return;
    setSalvando(true);
    setErro("");
    try {
      const resposta = await pessoasApi.post<{ pessoa: PessoaDetalhe }>(`/${pessoa.id}/vinculos`, { outraId: outra.id, tipo, direcao, observacao });
      onSalvo(resposta.pessoa);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setSalvando(false);
    }
  }

  const frase = outra
    ? direcao === "de"
      ? `${pessoa.nome} é ${rotuloDoVinculo(tipo).toLowerCase()} de ${outra.nome}.`
      : `${outra.nome} é ${rotuloDoVinculo(tipo).toLowerCase()} de ${pessoa.nome}.`
    : "Escolha a outra pessoa.";

  return (
    <DialogoAcao
      aberto
      onFechar={onFechar}
      ocupado={salvando}
      icone={Link2}
      titulo="Novo vínculo"
      descricao="Sócio, administrador, fiador ou advogado: o vínculo vale para as duas pessoas, em qualquer processo."
      aviso={frase}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || !outra}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      {outra ? (
        <div className="flex items-center gap-3 rounded-md border border-[#47cdd0]/30 bg-[#f2fbfb] px-3 py-2.5">
          <UserRoundCheck className="size-5 shrink-0 text-[#285f7a]" aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{outra.nome}</p>
            <p className="truncate text-xs tabular-nums text-muted-foreground">{outra.documento ?? "sem CPF/CNPJ"}</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => setOutra(null)}>
            <X /> Trocar
          </Button>
        </div>
      ) : (
        <BuscarPessoa onEscolher={setOutra} ignorar={[pessoa.id]} placeholder="Buscar a outra pessoa por nome ou CPF/CNPJ" />
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Vínculo">
          <Seletor valor={tipo} onChange={setTipo} opcoes={OPCOES_VINCULO} rotulo="Tipo de vínculo" />
        </Campo>
        <Campo rotulo="Quem é de quem">
          <Seletor valor={direcao} onChange={setDirecao} opcoes={DIRECOES} rotulo="Direção do vínculo" />
        </Campo>
        <Campo rotulo="Observação" className="sm:col-span-2">
          <Input value={observacao} onChange={(evento) => setObservacao(evento.target.value)} placeholder="Ex.: 50% das cotas, fiador do contrato 123" />
        </Campo>
      </div>
    </DialogoAcao>
  );
}

function Ficha({ id }: { id: string }) {
  const tituloId = useId();
  const [pessoa, setPessoa] = useState<PessoaDetalhe | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  const [ocupado, setOcupado] = useState("");

  const carregar = useCallback(async () => {
    setErro("");
    try {
      const resposta = await pessoasApi.get<{ pessoa: PessoaDetalhe }>(`/${id}`);
      setPessoa(resposta.pessoa);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    }
  }, [id]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  function salvo(atualizada: PessoaDetalhe, mensagem: string) {
    setPessoa(atualizada);
    setDialogo(null);
    setFeito(mensagem);
  }

  async function removerVinculo(vinculoId: string) {
    setOcupado(vinculoId);
    setErro("");
    try {
      const resposta = await pessoasApi.del<{ pessoa: PessoaDetalhe }>(`/${id}/vinculos/${vinculoId}`);
      setPessoa(resposta.pessoa);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
    } finally {
      setOcupado("");
    }
  }

  async function unificar(outra: PessoaResumo) {
    setOcupado("unificar");
    setErro("");
    try {
      const resposta = await pessoasApi.post<{ pessoa: PessoaDetalhe }>(`/${id}/unificar`, { origens: [outra.id] });
      salvo(resposta.pessoa, `${outra.nome} foi unificada nesta pessoa.`);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setDialogo(null);
    } finally {
      setOcupado("");
    }
  }

  if (!pessoa) {
    return erro ? (
      <Painel>
        <Vazio icone={TriangleAlert} titulo="Não foi possível abrir a pessoa">
          <p>{erro}</p>
          <div className="mt-3 flex justify-center gap-2">
            <Button variant="outline" onClick={() => void carregar()}>
              <RefreshCw /> Tentar de novo
            </Button>
            <Button asChild variant="outline">
              <Link href="/operacoes-legais/pessoas">
                <ArrowLeft /> Voltar à lista
              </Link>
            </Button>
          </div>
        </Vazio>
      </Painel>
    ) : (
      <Carregando rotulo="Abrindo a pessoa" />
    );
  }

  return (
    <div className="space-y-4">
      <Painel aria-labelledby={tituloId}>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 px-4 py-4">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <IconePessoa tipo={pessoa.tipo} className="size-11 [&_svg]:size-5" />
            <div className="min-w-0 space-y-1">
              <h2 id={tituloId} className="break-words text-base font-semibold text-[#10293a]">
                {pessoa.nome}
              </h2>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="tabular-nums text-foreground">{pessoa.documento ?? "CPF/CNPJ não informado"}</span>
                {pessoa.categoria ? <Selo tom={tomDaCategoria(pessoa.categoria)}>{pessoa.categoria}</Selo> : null}
                {pessoa.viosCi ? <Selo tom="neutro">CI {pessoa.viosCi} no VIOS</Selo> : <Selo tom="alerta">Sem ligação com o VIOS</Selo>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/operacoes-legais/pessoas">
                <ArrowLeft /> Pessoas
              </Link>
            </Button>
            <Button onClick={() => setDialogo({ tipo: "editar" })}>
              <PencilLine /> Editar
            </Button>
          </div>
        </div>
        <div className="grid gap-x-6 gap-y-4 border-t border-[#e6eef0] p-4 sm:grid-cols-2 lg:grid-cols-4">
          <Celula rotulo="Tipo">
            <p className="text-sm font-medium text-foreground">{pessoa.tipo === "juridica" ? "Pessoa jurídica" : pessoa.tipo === "fisica" ? "Pessoa física" : "—"}</p>
          </Celula>
          <Celula rotulo="Nome fantasia ou apelido">
            <p className="text-sm font-medium text-foreground">{pessoa.nomeFantasia ?? "—"}</p>
          </Celula>
          <Celula rotulo="Grupo do cliente">
            <p className="text-sm font-medium text-foreground">{pessoa.grupoCliente ?? "—"}</p>
          </Celula>
          <Celula rotulo="OAB">
            <p className="text-sm font-medium text-foreground">{pessoa.oab ?? "—"}</p>
          </Celula>
          {pessoa.etiquetas.length ? (
            <Celula rotulo="Etiquetas no VIOS" className="sm:col-span-2">
              <div className="flex flex-wrap gap-1">
                {pessoa.etiquetas.map((etiqueta) => (
                  <Selo key={etiqueta}>{etiqueta}</Selo>
                ))}
              </div>
            </Celula>
          ) : null}
          {pessoa.observacao ? (
            <Celula rotulo="Observação" className="sm:col-span-2 lg:col-span-4">
              <p className="whitespace-pre-wrap text-sm text-foreground">{pessoa.observacao}</p>
            </Celula>
          ) : null}
        </div>
      </Painel>

      {feito ? <Aviso tom="sucesso">{feito}</Aviso> : null}
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {pessoa.parecidas.length ? (
        <Painel>
          <PainelTopo titulo="Parece a mesma pessoa" descricao="Mesmo CPF/CNPJ ou mesmo nome. Unificar passa os processos, endereços, contatos e vínculos da outra para esta." />
          <ul className="divide-y divide-[#e6eef0]">
            {pessoa.parecidas.map((outra) => (
              <li key={outra.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <CopyCheck className="size-4 shrink-0 text-amber-600" aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link href={`/operacoes-legais/pessoas/${outra.id}`} className="block truncate text-sm font-medium text-[#347796] underline-offset-4 hover:underline">
                    {outra.nome}
                  </Link>
                  <p className="truncate text-xs tabular-nums text-muted-foreground">
                    {outra.documento ?? "sem CPF/CNPJ"} · {outra.viosCi ? `CI ${outra.viosCi}` : "sem ligação com o VIOS"} · {outra.processos} processo{outra.processos === 1 ? "" : "s"}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "unificar", outra })}>
                  <Merge /> Unificar nesta
                </Button>
              </li>
            ))}
          </ul>
        </Painel>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2 xl:items-start">
        <div className="min-w-0 space-y-4">
          <Painel>
            <PainelTopo titulo="Endereços e contatos">
              <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "editar" })}>
                <PencilLine /> Editar
              </Button>
            </PainelTopo>
            {pessoa.listaEnderecos.length || pessoa.listaContatos.length ? (
              <div className="grid gap-x-6 gap-y-3 p-4 sm:grid-cols-2">
                <ul className="space-y-2">
                  {pessoa.listaEnderecos.map((endereco) => (
                    <li key={endereco.id} className="flex items-start gap-1.5 text-sm text-foreground">
                      <MapPin className="mt-0.5 size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
                      <span className="min-w-0 break-words">
                        {[endereco.endereco, endereco.cidade, endereco.uf, endereco.cep].filter(Boolean).join(" · ")}
                        {endereco.origem === "vios" ? <Selo className="ml-1.5 py-0 text-[11px]">VIOS</Selo> : null}
                      </span>
                    </li>
                  ))}
                  {!pessoa.listaEnderecos.length ? <li className="text-sm text-muted-foreground">Nenhum endereço.</li> : null}
                </ul>
                <ul className="space-y-2">
                  {pessoa.listaContatos.map((contato) => {
                    const Icone = ICONE_CONTATO[contato.tipo];
                    return (
                      <li key={contato.id} className="flex flex-wrap items-center gap-1.5 text-sm text-foreground">
                        <Icone className="size-3.5 shrink-0 text-[#3e84a8]" aria-hidden />
                        <span className="break-all">{contato.valor}</span>
                        {contato.whatsapp ? <Selo tom="sucesso">WhatsApp</Selo> : null}
                        {contato.origem === "vios" ? <Selo className="py-0 text-[11px]">VIOS</Selo> : null}
                      </li>
                    );
                  })}
                  {!pessoa.listaContatos.length ? <li className="text-sm text-muted-foreground">Nenhum contato.</li> : null}
                </ul>
              </div>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum endereço ou contato cadastrado.</p>
            )}
          </Painel>

          <Painel>
            <PainelTopo titulo="Vínculos" descricao="Sócios, administradores, fiadores e advogados desta pessoa, e de quem ela é.">
              <Button size="sm" variant="outline" onClick={() => setDialogo({ tipo: "vinculo" })}>
                <Plus /> Vínculo
              </Button>
            </PainelTopo>
            {pessoa.vinculos.length ? (
              <ul className="divide-y divide-[#e6eef0]">
                {pessoa.vinculos.map((vinculo) => (
                  <li key={vinculo.id} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground">
                        {vinculo.direcao === "de" ? (
                          <>
                            <Selo tom="ia">{rotuloDoVinculo(vinculo.tipo)}</Selo> de{" "}
                          </>
                        ) : null}
                        <Link href={`/operacoes-legais/pessoas/${vinculo.outraId}`} className="font-medium text-[#347796] underline-offset-4 hover:underline">
                          {vinculo.outraNome}
                        </Link>
                        {vinculo.direcao === "para" ? (
                          <>
                            {" "}
                            é <Selo tom="ia">{rotuloDoVinculo(vinculo.tipo)}</Selo> desta pessoa
                          </>
                        ) : null}
                      </p>
                      <p className="truncate text-xs tabular-nums text-muted-foreground">{[vinculo.outraDocumento, vinculo.observacao].filter(Boolean).join(" · ") || "sem CPF/CNPJ"}</p>
                    </div>
                    <Button size="icon-sm" variant="ghost" aria-label={`Remover o vínculo com ${vinculo.outraNome}`} title="Remover o vínculo" disabled={ocupado === vinculo.id} onClick={() => void removerVinculo(vinculo.id)}>
                      {ocupado === vinculo.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">Nenhum vínculo. Os que forem indicados nas partes de um processo aparecem aqui.</p>
            )}
          </Painel>
        </div>

        <div className="min-w-0 space-y-4">
          <Painel>
            <PainelTopo titulo={`Processos (${pessoa.listaProcessos.length})`} />
            {pessoa.listaProcessos.length ? (
              <ul className="max-h-[32rem] divide-y divide-[#e6eef0] overflow-y-auto">
                {pessoa.listaProcessos.map((processo) => (
                  <li key={processo.parteId}>
                    <Link href={`/operacoes-legais/processos/${processo.processoId}`} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none">
                      <Gavel className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium tabular-nums text-[#10293a]">{processo.cnj ?? "Sem número CNJ"}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          CI {processo.ci ?? "—"} · {processo.acao ?? "ação não informada"}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1">
                        <Selo tom="marca">{processo.papel === "parte" ? (processo.vinculo ?? rotuloDoPolo(processo.polo)) : rotuloDoPapel(processo.papel)}</Selo>
                        {processo.devedor ? <Selo tom="escuro">Devedor</Selo> : null}
                        {processo.situacao && !/^ativo/i.test(processo.situacao) ? <Selo>{processo.situacao}</Selo> : null}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-4 text-sm text-muted-foreground">Esta pessoa não está em nenhum processo do cadastro.</p>
            )}
          </Painel>

          <Painel>
            <PainelTopo titulo="Unificações" />
            {pessoa.unificacoes.length ? (
              <ul className="max-h-64 divide-y divide-[#e6eef0] overflow-y-auto">
                {pessoa.unificacoes.map((item) => (
                  <li key={item.id} className="px-4 py-2.5">
                    <p className="truncate text-sm text-foreground">{item.nome}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {formatarDataHora(item.quando)} · {item.automatica ? "pela carga do VIOS" : (item.autor ?? "manual")}
                      {item.documento ? ` · ${item.documento}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <Vazio icone={History} titulo="Nenhuma unificação" className="py-8" />
            )}
          </Painel>
        </div>
      </div>

      {dialogo?.tipo === "editar" ? <EditarPessoa pessoa={pessoa} onFechar={() => setDialogo(null)} onSalvo={(atualizada) => salvo(atualizada, "Pessoa salva.")} /> : null}
      {dialogo?.tipo === "vinculo" ? <NovoVinculo pessoa={pessoa} onFechar={() => setDialogo(null)} onSalvo={(atualizada) => salvo(atualizada, "Vínculo salvo.")} /> : null}
      {dialogo?.tipo === "unificar" ? (
        <DialogoAcao
          aberto
          onFechar={() => setDialogo(null)}
          ocupado={ocupado === "unificar"}
          icone={Merge}
          tom="alerta"
          titulo="Unificar as duas pessoas?"
          descricao={`${dialogo.outra.nome} deixa de existir: os ${dialogo.outra.processos} processo(s), endereços, contatos e vínculos dela passam para ${pessoa.nome}.`}
          aviso="Não dá para desfazer pela tela."
          rodape={
            <>
              <Button variant="outline" onClick={() => setDialogo(null)} disabled={ocupado === "unificar"}>
                Cancelar
              </Button>
              <Button onClick={() => void unificar(dialogo.outra)} disabled={ocupado === "unificar"}>
                {ocupado === "unificar" ? <LoaderCircle className="animate-spin" /> : <Merge />} Unificar
              </Button>
            </>
          }
        >
          <p className="text-sm text-muted-foreground">Fica valendo o cadastro desta pessoa; o que estiver vazio nela (CPF/CNPJ, OAB, ligação com o VIOS) é herdado da outra. O VIOS não é alterado.</p>
        </DialogoAcao>
      ) : null}
    </div>
  );
}
