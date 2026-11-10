"use client";

import { useState } from "react";
import { LoaderCircle, UserRoundCheck, UserRoundPen, UserRoundPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { PAPEIS, POLOS, type Parte, type ParteEntrada, type PessoaResumo, type ProcessoDetalhe } from "@/lib/processos/types";
import { BuscarPessoa } from "../pessoas/buscar-pessoa";
import { CamposDeContatos, CamposDeEnderecos } from "../pessoas/contatos-form";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Campo } from "../vistagem/ui";
import { mensagemDeErro, processosApi } from "./processos-api";

const OPCOES_POLO = POLOS.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));
const OPCOES_PAPEL = PAPEIS.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));

function inicial(parte: Parte | null, poloPadrao: Parte["polo"]): ParteEntrada {
  if (!parte) {
    return { pessoaId: null, polo: poloPadrao, papel: "parte", vinculo: null, devedor: false, referenteA: null, nome: "", documento: null, oab: null, observacao: null, enderecos: [], contatos: [] };
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
 * Inclusão e edição de quem participa do processo: a parte, o sócio, o fiador ou o advogado. Os dados
 * da pessoa (documento, endereços, contatos) são do cadastro de Pessoas e valem para todos os
 * processos em que ela aparece. Na inclusão, a busca reaproveita quem já está cadastrado.
 */
export function EditarParte({
  processoId,
  parte,
  outras,
  poloPadrao = "passivo",
  sugestao,
  onFechar,
  onSalvo,
}: {
  processoId: string;
  /** null = nova. */
  parte: Parte | null;
  /** As partes do processo a que esta pode se referir (sócio de…, advogado de…). */
  outras: Parte[];
  poloPadrao?: Parte["polo"];
  /**
   * Conferência de uma sugestão da IA: o formulário abre com `dados` (a parte com o que a IA propôs) e
   * salvar chama `aprovar`, que grava pela rota da sugestão em vez da rota de partes.
   */
  sugestao?: { dados: ParteEntrada; aprovar: (corpo: ParteEntrada) => Promise<void> };
  onFechar: () => void;
  onSalvo: (processo: ProcessoDetalhe) => void;
}) {
  const [dados, setDados] = useState<ParteEntrada>(() => sugestao?.dados ?? inicial(parte, poloPadrao));
  const [escolhida, setEscolhida] = useState<PessoaResumo | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const mudar = (patch: Partial<ParteEntrada>) => setDados((atual) => ({ ...atual, ...patch }));
  const ehParte = dados.papel === "parte";
  const referencias = outras.filter((item) => item.papel === "parte" && item.id !== parte?.id).map((item) => ({ valor: item.id, rotulo: item.nome }));

  function escolher(pessoa: PessoaResumo) {
    setEscolhida(pessoa);
    mudar({ pessoaId: pessoa.id, nome: pessoa.nome, documento: pessoa.documento, oab: pessoa.oab });
  }

  function desfazerEscolha() {
    setEscolhida(null);
    mudar({ pessoaId: null, nome: "", documento: null, oab: null });
  }

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
      if (sugestao) {
        await sugestao.aprovar(corpo);
        return;
      }
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
      titulo={sugestao ? "Conferir a sugestão da IA" : parte ? "Editar parte" : "Incluir parte"}
      descricao={
        sugestao
          ? "Ajuste o que for preciso. Ao aprovar, a parte é gravada como está aqui; documento, endereços e contatos vão para o cadastro da pessoa."
          : "Parte, sócio, fiador ou advogado. Documento, endereços e contatos ficam no cadastro da pessoa e valem em todos os processos dela."
      }
      className="sm:max-w-3xl"
      aviso={parte ? "Mudou o CPF/CNPJ para o de alguém já cadastrado? As duas pessoas são unificadas." : escolhida ? "Os endereços e contatos que você incluir são acrescentados aos que a pessoa já tem." : undefined}
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || dados.nome.trim().length < 2}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} {sugestao ? "Aprovar e gravar" : "Salvar"}
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}

      {!parte ? (
        escolhida ? (
          <div className="flex items-center gap-3 rounded-md border border-[#47cdd0]/30 bg-[#f2fbfb] px-3 py-2.5">
            <UserRoundCheck className="size-5 shrink-0 text-[#285f7a]" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{escolhida.nome}</p>
              <p className="truncate text-xs tabular-nums text-muted-foreground">
                Já cadastrada · {escolhida.documento ?? "sem CPF/CNPJ"} · {escolhida.processos} processo{escolhida.processos === 1 ? "" : "s"}
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={desfazerEscolha}>
              <X /> Trocar
            </Button>
          </div>
        ) : (
          <BuscarPessoa onEscolher={escolher} ignorar={[]} />
        )
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Nome ou razão social" className="sm:col-span-2" dica={escolhida ? "O nome é o do cadastro; para mudar, edite a pessoa." : undefined}>
          <Input value={dados.nome} onChange={(evento) => mudar({ nome: evento.target.value })} disabled={Boolean(escolhida)} />
        </Campo>
        <Campo rotulo="CPF/CNPJ">
          <Input value={dados.documento ?? ""} onChange={(evento) => mudar({ documento: evento.target.value })} inputMode="numeric" className="tabular-nums" disabled={Boolean(escolhida?.documento)} />
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
          <Campo rotulo="Referente a" className="sm:col-span-2" dica="A parte de quem esta pessoa é sócia, fiadora ou advogada. O vínculo fica também no cadastro das duas pessoas.">
            <Seletor valor={dados.referenteA ?? ""} onChange={(valor) => mudar({ referenteA: valor || null })} opcoes={referencias} todos={{ rotulo: "Não indicado" }} rotulo="Referente a" />
          </Campo>
        )}
        {dados.papel === "advogado" ? (
          <Campo rotulo="OAB" dica="UF e número, ex.: SP 123.456.">
            <Input value={dados.oab ?? ""} onChange={(evento) => mudar({ oab: evento.target.value })} />
          </Campo>
        ) : null}
      </div>

      <CamposDeEnderecos enderecos={dados.enderecos} onChange={(enderecos) => mudar({ enderecos })} />
      <CamposDeContatos contatos={dados.contatos} onChange={(contatos) => mudar({ contatos })} />

      <Campo rotulo="Observação">
        <Textarea value={dados.observacao ?? ""} onChange={(evento) => mudar({ observacao: evento.target.value })} rows={2} className="text-sm" />
      </Campo>
    </DialogoAcao>
  );
}
