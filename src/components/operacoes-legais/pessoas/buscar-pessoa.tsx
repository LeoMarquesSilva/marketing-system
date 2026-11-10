"use client";

import { useEffect, useState } from "react";
import { LoaderCircle, UserRoundSearch } from "lucide-react";
import type { PessoaResumo } from "@/lib/processos/types";
import { pessoasApi } from "../processos/processos-api";
import { Busca, Selo } from "../vistagem/ui";

/**
 * Busca no cadastro de pessoas por nome ou CPF/CNPJ, para reaproveitar quem já existe em vez de
 * cadastrar de novo. A lista aparece a partir de 3 caracteres; clicar escolhe.
 */
export function BuscarPessoa({ onEscolher, ignorar, placeholder = "Buscar pessoa já cadastrada por nome ou CPF/CNPJ" }: { onEscolher: (pessoa: PessoaResumo) => void; ignorar?: string[]; placeholder?: string }) {
  const [termo, setTermo] = useState("");
  const [resultado, setResultado] = useState<{ termo: string; pessoas: PessoaResumo[] } | null>(null);
  const ativo = termo.trim().length >= 3;

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    const espera = window.setTimeout(() => {
      pessoasApi.get<{ pessoas: PessoaResumo[] }>(`?q=${encodeURIComponent(termo.trim())}`).then(
        (resposta) => {
          if (vivo) setResultado({ termo, pessoas: resposta.pessoas });
        },
        () => {
          if (vivo) setResultado({ termo, pessoas: [] });
        }
      );
    }, 300);
    return () => {
      vivo = false;
      window.clearTimeout(espera);
    };
  }, [termo, ativo]);

  const buscando = ativo && resultado?.termo !== termo;
  const pessoas = ativo && resultado ? resultado.pessoas.filter((pessoa) => !ignorar?.includes(pessoa.id)).slice(0, 8) : [];

  return (
    <div className="space-y-2">
      <div className="relative">
        <Busca value={termo} onChange={(evento) => setTermo(evento.target.value)} placeholder={placeholder} aria-label={placeholder} className="sm:w-full" />
        {buscando ? <LoaderCircle className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      {ativo && !buscando ? (
        pessoas.length ? (
          <ul className="max-h-56 divide-y divide-[#e6eef0] overflow-y-auto rounded-md border border-[#dce9eb] bg-white">
            {pessoas.map((pessoa) => (
              <li key={pessoa.id}>
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-[#f6fafb] focus-visible:bg-[#f6fafb] focus-visible:outline-none"
                  onClick={() => {
                    onEscolher(pessoa);
                    setTermo("");
                  }}
                >
                  <UserRoundSearch className="size-4 shrink-0 text-[#3e84a8]" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-foreground">{pessoa.nome}</span>
                    <span className="block truncate text-xs tabular-nums text-muted-foreground">
                      {pessoa.documento ?? "sem CPF/CNPJ"} · {pessoa.processos} processo{pessoa.processos === 1 ? "" : "s"}
                    </span>
                  </span>
                  {pessoa.categoria ? <Selo tom="neutro">{pessoa.categoria}</Selo> : null}
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Ninguém com esse nome ou documento no cadastro.</p>
        )
      ) : null}
    </div>
  );
}
