"use client";

import { useState } from "react";
import { LoaderCircle, Plus, Trash2, UserRoundPen, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PAPEIS, POLOS, TIPOS_CONTATO, type Contato, type Endereco, type Parte, type ParteEntrada, type ProcessoDetalhe } from "@/lib/processos/types";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Campo, Secao } from "../vistagem/ui";
import { mensagemDeErro, processosApi } from "./processos-api";

const OPCOES_POLO = POLOS.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));
const OPCOES_PAPEL = PAPEIS.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));
const OPCOES_CONTATO = TIPOS_CONTATO.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));

const ENDERECO_VAZIO: Endereco = { endereco: "", cidade: null, uf: null, cep: null, observacao: null };
const CONTATO_VAZIO: Contato = { tipo: "celular", valor: "", whatsapp: false, observacao: null };

function inicial(parte: Parte | null, poloPadrao: Parte["polo"]): ParteEntrada {
  if (!parte) {
    return { polo: poloPadrao, papel: "parte", vinculo: null, devedor: false, referenteA: null, nome: "", documento: null, oab: null, observacao: null, enderecos: [], contatos: [] };
  }
  return {
    polo: parte.polo,
    papel: parte.papel,
    vinculo: parte.vinculo,
    devedor: parte.devedor,
    referenteA: parte.referenteA,
    nome: parte.nome,
    documento: parte.documento,
    oab: parte.oab,
    observacao: parte.observacao,
    enderecos: parte.enderecos.map((item) => ({ ...item })),
    contatos: parte.contatos.map((item) => ({ ...item })),
  };
}

/**
 * Inclusão e edição de quem participa do processo: a parte, o sócio, o fiador ou o advogado, com os
 * endereços e os contatos da pessoa. É aqui que entram as informações novas da lista da equipe.
 */
export function EditarParte({
  processoId,
  parte,
  outras,
  poloPadrao = "passivo",
  onFechar,
  onSalvo,
}: {
  processoId: string;
  /** null = nova. */
  parte: Parte | null;
  /** As partes do processo a que esta pode se referir (sócio de…, advogado de…). */
  outras: Parte[];
  poloPadrao?: Parte["polo"];
  onFechar: () => void;
  onSalvo: (processo: ProcessoDetalhe) => void;
}) {
  const [dados, setDados] = useState<ParteEntrada>(() => inicial(parte, poloPadrao));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const mudar = (patch: Partial<ParteEntrada>) => setDados((atual) => ({ ...atual, ...patch }));
  const ehParte = dados.papel === "parte";
  const referencias = outras.filter((item) => item.papel === "parte" && item.id !== parte?.id).map((item) => ({ valor: item.id, rotulo: item.nome }));

  const mudarEndereco = (indice: number, patch: Partial<Endereco>) => mudar({ enderecos: dados.enderecos.map((item, i) => (i === indice ? { ...item, ...patch } : item)) });
  const mudarContato = (indice: number, patch: Partial<Contato>) => mudar({ contatos: dados.contatos.map((item, i) => (i === indice ? { ...item, ...patch } : item)) });

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const corpo: ParteEntrada = {
        ...dados,
        referenteA: ehParte ? null : dados.referenteA,
        devedor: ehParte && dados.devedor,
        // Linha deixada em branco não é erro: só não é gravada.
        enderecos: dados.enderecos.filter((item) => item.endereco.trim()),
        contatos: dados.contatos.filter((item) => item.valor.trim()),
      };
      const resposta = parte
        ? await processosApi.put<{ processo: ProcessoDetalhe }>(`/partes/${parte.id}`, corpo)
        : await processosApi.post<{ processo: ProcessoDetalhe }>(`/${processoId}/partes`, corpo);
      onSalvo(resposta.processo);
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
      icone={parte ? UserRoundPen : UserRoundPlus}
      titulo={parte ? "Editar parte" : "Incluir parte"}
      descricao="Parte, sócio, fiador ou advogado, com documento, endereços e contatos."
      className="sm:max-w-3xl"
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || dados.nome.trim().length < 2}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome ou razão social" className="sm:col-span-2">
          <Input value={dados.nome} onChange={(evento) => mudar({ nome: evento.target.value })} autoFocus />
        </Campo>
        <Campo rotulo="CPF/CNPJ">
          <Input value={dados.documento ?? ""} onChange={(evento) => mudar({ documento: evento.target.value })} inputMode="numeric" className="tabular-nums" />
        </Campo>
        <Campo rotulo="Papel no processo">
          <Seletor valor={dados.papel} onChange={(valor) => mudar({ papel: valor as ParteEntrada["papel"] })} opcoes={OPCOES_PAPEL} rotulo="Papel no processo" />
        </Campo>
        <Campo rotulo="Polo">
          <Seletor valor={dados.polo} onChange={(valor) => mudar({ polo: valor as ParteEntrada["polo"] })} opcoes={OPCOES_POLO} rotulo="Polo" />
        </Campo>
        <Campo rotulo={ehParte ? "Tipo de parte" : "Vínculo"} dica={ehParte ? "Como está no VIOS: Exequente, Executado, Requerido…" : "Ex.: sócio administrador, fiador do contrato."}>
          <Input value={dados.vinculo ?? ""} onChange={(evento) => mudar({ vinculo: evento.target.value })} />
        </Campo>
        {ehParte ? (
          <label className="flex items-start gap-2.5 rounded-md border border-[#dce9eb] bg-[#f7fbfc] px-3 py-2.5 text-sm sm:col-span-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-[#347796]" checked={dados.devedor} onChange={(evento) => mudar({ devedor: evento.target.checked })} />
            <span>
              <span className="font-medium text-foreground">É o devedor (executado)</span>
              <span className="block text-xs text-muted-foreground">O saneamento cobra endereços, contatos e advogado desta parte.</span>
            </span>
          </label>
        ) : (
          <Campo rotulo="Referente a" className="sm:col-span-2" dica="A parte de quem esta pessoa é sócia, fiadora ou advogada.">
            <Seletor valor={dados.referenteA ?? ""} onChange={(valor) => mudar({ referenteA: valor || null })} opcoes={referencias} todos={{ rotulo: "Não indicado" }} rotulo="Referente a" />
          </Campo>
        )}
        {dados.papel === "advogado" ? (
          <Campo rotulo="OAB" dica="UF e número, ex.: SP 123.456.">
            <Input value={dados.oab ?? ""} onChange={(evento) => mudar({ oab: evento.target.value })} />
          </Campo>
        ) : null}
      </div>

      <Secao
        titulo="Endereços"
        className="-mx-6 px-6"
        acao={
          <Button size="sm" variant="outline" onClick={() => mudar({ enderecos: [...dados.enderecos, { ...ENDERECO_VAZIO }] })}>
            <Plus /> Endereço
          </Button>
        }
      >
        {dados.enderecos.length ? (
          <ul className="space-y-3">
            {dados.enderecos.map((item, indice) => (
              <li key={indice} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_4.5rem_7.5rem_auto] sm:items-center">
                <Input value={item.endereco} onChange={(evento) => mudarEndereco(indice, { endereco: evento.target.value })} placeholder="Rua, número, complemento, bairro" aria-label={`Endereço ${indice + 1}`} />
                <Input value={item.cidade ?? ""} onChange={(evento) => mudarEndereco(indice, { cidade: evento.target.value })} placeholder="Cidade" aria-label={`Cidade do endereço ${indice + 1}`} />
                <Input value={item.uf ?? ""} onChange={(evento) => mudarEndereco(indice, { uf: evento.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" aria-label={`UF do endereço ${indice + 1}`} />
                <Input value={item.cep ?? ""} onChange={(evento) => mudarEndereco(indice, { cep: evento.target.value })} placeholder="CEP" inputMode="numeric" aria-label={`CEP do endereço ${indice + 1}`} />
                <Button size="icon-sm" variant="ghost" aria-label={`Remover o endereço ${indice + 1}`} onClick={() => mudar({ enderecos: dados.enderecos.filter((_, i) => i !== indice) })}>
                  <Trash2 />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum endereço. Inclua todos os que forem identificados.</p>
        )}
      </Secao>

      <Secao
        titulo="Contatos"
        className="-mx-6 px-6"
        acao={
          <Button size="sm" variant="outline" onClick={() => mudar({ contatos: [...dados.contatos, { ...CONTATO_VAZIO }] })}>
            <Plus /> Contato
          </Button>
        }
      >
        {dados.contatos.length ? (
          <ul className="space-y-3">
            {dados.contatos.map((item, indice) => {
              const telefone = item.tipo === "celular" || item.tipo === "telefone";
              return (
                <li key={indice} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto_auto] sm:items-center">
                  <Seletor valor={item.tipo} onChange={(valor) => mudarContato(indice, { tipo: valor as Contato["tipo"] })} opcoes={OPCOES_CONTATO} rotulo={`Tipo do contato ${indice + 1}`} />
                  <Input
                    value={item.valor}
                    onChange={(evento) => mudarContato(indice, { valor: evento.target.value })}
                    placeholder={item.tipo === "email" ? "nome@empresa.com.br" : item.tipo === "site" ? "www.empresa.com.br" : "(11) 90000-0000"}
                    inputMode={telefone ? "tel" : item.tipo === "email" ? "email" : "url"}
                    aria-label={`Contato ${indice + 1}`}
                  />
                  <label className={`flex items-center gap-1.5 text-sm ${telefone ? "text-foreground" : "invisible"}`}>
                    <input type="checkbox" className="size-4 accent-[#347796]" checked={item.whatsapp} disabled={!telefone} onChange={(evento) => mudarContato(indice, { whatsapp: evento.target.checked })} />
                    WhatsApp
                  </label>
                  <Button size="icon-sm" variant="ghost" aria-label={`Remover o contato ${indice + 1}`} onClick={() => mudar({ contatos: dados.contatos.filter((_, i) => i !== indice) })}>
                    <Trash2 />
                  </Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum contato. Celular, telefone, e-mail ou site.</p>
        )}
      </Secao>

      <Campo rotulo="Observação">
        <Textarea value={dados.observacao ?? ""} onChange={(evento) => mudar({ observacao: evento.target.value })} rows={2} className="text-sm" />
      </Campo>
    </DialogoAcao>
  );
}
