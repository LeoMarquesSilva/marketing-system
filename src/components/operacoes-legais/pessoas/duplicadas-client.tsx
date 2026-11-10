"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CopyCheck, LoaderCircle, Merge, PartyPopper, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { GrupoDePessoas, PessoaDetalhe, PessoaResumo } from "@/lib/processos/types";
import { cn } from "@/lib/utils";
import { AcessoProcessos } from "../processos/acesso-processos";
import { mensagemDeErro, pessoasApi } from "../processos/processos-api";
import { Aviso, Carregando, Painel, PainelTopo, Selo, Vazio } from "../vistagem/ui";

export function DuplicadasClient() {
  return (
    <AcessoProcessos>
      <Duplicadas />
    </AcessoProcessos>
  );
}

/** Quem fica, de saída: a ligada ao VIOS, depois a com documento, depois a com mais processos. */
function sugerida(pessoas: PessoaResumo[]): string {
  return [...pessoas].sort((a, b) => Number(Boolean(b.viosCi)) - Number(Boolean(a.viosCi)) || Number(Boolean(b.documento)) - Number(Boolean(a.documento)) || b.processos - a.processos)[0].id;
}

function Grupo({ grupo, onUnificado }: { grupo: GrupoDePessoas; onUnificado: (mensagem: string) => void }) {
  const [fica, setFica] = useState(() => sugerida(grupo.pessoas));
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState("");
  const destino = grupo.pessoas.find((pessoa) => pessoa.id === fica) as PessoaResumo;

  async function unificar() {
    setOcupado(true);
    setErro("");
    try {
      await pessoasApi.post<{ pessoa: PessoaDetalhe }>(`/${fica}/unificar`, { origens: grupo.pessoas.filter((pessoa) => pessoa.id !== fica).map((pessoa) => pessoa.id) });
      onUnificado(`${grupo.pessoas.length} cadastros de ${destino.nome} viraram um.`);
    } catch (falha) {
      setErro(mensagemDeErro(falha));
      setOcupado(false);
    }
  }

  return (
    <Painel>
      <PainelTopo
        titulo={destino.nome}
        descricao={grupo.motivo === "documento" ? "Mesmo CPF/CNPJ: é a mesma pessoa." : "Mesmo nome, sem documento que diferencie. Confira antes de unificar: pode ser homônimo."}
      >
        <Selo tom={grupo.motivo === "documento" ? "perigo" : "alerta"} icone={CopyCheck}>
          {grupo.pessoas.length} cadastros
        </Selo>
        <Button size="sm" onClick={() => void unificar()} disabled={ocupado}>
          {ocupado ? <LoaderCircle className="animate-spin" /> : <Merge />} Unificar na escolhida
        </Button>
      </PainelTopo>
      {erro ? (
        <div className="border-b border-[#e6eef0] p-3">
          <Aviso tom="erro">{erro}</Aviso>
        </div>
      ) : null}
      <ul className="divide-y divide-[#e6eef0]">
        {grupo.pessoas.map((pessoa) => (
          <li key={pessoa.id}>
            <label className={cn("flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors hover:bg-[#f6fafb]", pessoa.id === fica && "bg-[#47cdd0]/10 hover:bg-[#47cdd0]/10")}>
              <input type="radio" name={`fica-${grupo.pessoas[0].id}`} className="size-4 accent-[#347796]" checked={pessoa.id === fica} onChange={() => setFica(pessoa.id)} disabled={ocupado} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-foreground">{pessoa.nome}</span>
                <span className="block truncate text-xs tabular-nums text-muted-foreground">
                  {pessoa.documento ?? "sem CPF/CNPJ"} · {pessoa.viosCi ? `CI ${pessoa.viosCi} no VIOS` : "sem ligação com o VIOS"} · {pessoa.processos} processo{pessoa.processos === 1 ? "" : "s"} · {pessoa.enderecos + pessoa.contatos} endereço(s) e contato(s)
                </span>
              </span>
              {pessoa.id === fica ? <Selo tom="marca">Fica</Selo> : null}
              <Link href={`/operacoes-legais/pessoas/${pessoa.id}`} className="shrink-0 text-xs text-[#347796] underline-offset-4 hover:underline">
                Abrir
              </Link>
            </label>
          </li>
        ))}
      </ul>
    </Painel>
  );
}

/** Pessoas que parecem a mesma, para alguém conferir e unificar. A carga do VIOS já resolve as que têm o mesmo CI. */
function Duplicadas() {
  const [grupos, setGrupos] = useState<GrupoDePessoas[] | null>(null);
  const [erro, setErro] = useState("");
  const [feito, setFeito] = useState("");
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let vivo = true;
    pessoasApi.get<{ grupos: GrupoDePessoas[] }>("/duplicadas").then(
      (resposta) => {
        if (!vivo) return;
        setGrupos(resposta.grupos);
        setErro("");
      },
      (falha: unknown) => {
        if (vivo) setErro(mensagemDeErro(falha));
      }
    );
    return () => {
      vivo = false;
    };
  }, [versao]);

  if (!grupos && !erro) return <Carregando rotulo="Procurando pessoas repetidas" />;

  return (
    <div className="space-y-4">
      {erro ? (
        <Aviso
          tom="erro"
          acao={
            <Button size="sm" variant="outline" className="-my-1 shrink-0" onClick={() => setVersao((atual) => atual + 1)}>
              <RefreshCw /> Tentar de novo
            </Button>
          }
        >
          {erro}
        </Aviso>
      ) : null}
      {feito ? <Aviso tom="sucesso">{feito}</Aviso> : null}
      {grupos && !grupos.length ? (
        <Painel>
          <Vazio icone={PartyPopper} titulo="Nenhuma pessoa repetida">
            Cada pessoa aparece uma vez no cadastro.
          </Vazio>
        </Painel>
      ) : null}
      {(grupos ?? []).map((grupo) => (
        <Grupo
          key={grupo.pessoas.map((pessoa) => pessoa.id).join("|")}
          grupo={grupo}
          onUnificado={(mensagem) => {
            setFeito(mensagem);
            setVersao((atual) => atual + 1);
          }}
        />
      ))}
    </div>
  );
}
