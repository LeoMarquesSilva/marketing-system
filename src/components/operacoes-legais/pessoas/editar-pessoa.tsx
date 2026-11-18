"use client";

import { useState } from "react";
import { LoaderCircle, UserRoundPen, UserRoundPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { TIPOS_PESSOA } from "@/lib/processos/pessoas";
import type { PessoaDetalhe, PessoaEntrada } from "@/lib/processos/types";
import { mensagemDeErro, pessoasApi } from "../processos/processos-api";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Campo } from "../vistagem/ui";
import { CamposDeContatos, CamposDeEnderecos } from "./contatos-form";

const OPCOES_TIPO = TIPOS_PESSOA.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));

function inicial(pessoa: PessoaDetalhe | null): PessoaEntrada {
  if (!pessoa) return { nome: "", documento: null, tipo: null, nomeFantasia: null, oab: null, observacao: null, enderecos: [], contatos: [] };
  return {
    nome: pessoa.nome,
    documento: pessoa.documento,
    tipo: pessoa.tipo,
    nomeFantasia: pessoa.nomeFantasia,
    oab: pessoa.oab,
    observacao: pessoa.observacao,
    enderecos: pessoa.listaEnderecos.map((item) => ({ ...item })),
    contatos: pessoa.listaContatos.map((item) => ({ ...item })),
  };
}

/** Cadastro da pessoa: dados, endereços e contatos. Categoria, grupo e CI do VIOS vêm de lá e não são editados aqui. */
export function EditarPessoa({ pessoa, onFechar, onSalvo }: { pessoa: PessoaDetalhe | null; onFechar: () => void; onSalvo: (pessoa: PessoaDetalhe) => void }) {
  const [dados, setDados] = useState<PessoaEntrada>(() => inicial(pessoa));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const mudar = (patch: Partial<PessoaEntrada>) => setDados((atual) => ({ ...atual, ...patch }));

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const corpo: PessoaEntrada = { ...dados, enderecos: dados.enderecos.filter((item) => item.endereco.trim()), contatos: dados.contatos.filter((item) => item.valor.trim()) };
      const resposta = pessoa ? await pessoasApi.put<{ pessoa: PessoaDetalhe }>(`/${pessoa.id}`, corpo) : await pessoasApi.post<{ pessoa: PessoaDetalhe }>("", corpo);
      onSalvo(resposta.pessoa);
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
      icone={pessoa ? UserRoundPen : UserRoundPlus}
      titulo={pessoa ? "Editar pessoa" : "Nova pessoa"}
      descricao="O que for salvo aqui vale em todos os processos em que a pessoa aparece."
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
          <Input value={dados.nome} onChange={(evento) => mudar({ nome: evento.target.value })} />
        </Campo>
        <Campo rotulo="CPF/CNPJ">
          <Input value={dados.documento ?? ""} onChange={(evento) => mudar({ documento: evento.target.value })} inputMode="numeric" className="tabular-nums" />
        </Campo>
        <Campo rotulo="Tipo" dica="Em branco, vale o do documento.">
          <Seletor valor={dados.tipo ?? ""} onChange={(valor) => mudar({ tipo: (valor || null) as PessoaEntrada["tipo"] })} opcoes={OPCOES_TIPO} todos={{ rotulo: "Pelo documento" }} rotulo="Tipo de pessoa" />
        </Campo>
        <Campo rotulo="Nome fantasia ou apelido">
          <Input value={dados.nomeFantasia ?? ""} onChange={(evento) => mudar({ nomeFantasia: evento.target.value })} />
        </Campo>
        <Campo rotulo="OAB" dica="Só para advogados: UF e número.">
          <Input value={dados.oab ?? ""} onChange={(evento) => mudar({ oab: evento.target.value })} />
        </Campo>
      </div>
      <CamposDeEnderecos enderecos={dados.enderecos} onChange={(enderecos) => mudar({ enderecos })} />
      <CamposDeContatos contatos={dados.contatos} onChange={(contatos) => mudar({ contatos })} />
      <Campo rotulo="Observação">
        <Textarea value={dados.observacao ?? ""} onChange={(evento) => mudar({ observacao: evento.target.value })} rows={2} className="text-sm" />
      </Campo>
    </DialogoAcao>
  );
}
