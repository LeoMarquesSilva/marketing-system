"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TIPOS_CONTATO, type Contato, type Endereco } from "@/lib/processos/types";
import { Seletor } from "../vistagem/seletor";
import { Secao, Selo } from "../vistagem/ui";

const OPCOES_CONTATO = TIPOS_CONTATO.map((item) => ({ valor: item.valor, rotulo: item.rotulo }));
const ENDERECO_VAZIO: Endereco = { endereco: "", cidade: null, uf: null, cep: null, observacao: null };
const CONTATO_VAZIO: Contato = { tipo: "celular", valor: "", whatsapp: false, observacao: null };

/** Endereços da pessoa no formulário (todos os identificados, não só o atual). O que veio do VIOS leva o selo. */
export function CamposDeEnderecos({ enderecos, onChange }: { enderecos: Endereco[]; onChange: (enderecos: Endereco[]) => void }) {
  // Editar um endereço que veio do VIOS ou da IA passa a origem para "manual": deixou de ser o dado de lá.
  const mudar = (indice: number, patch: Partial<Endereco>) => onChange(enderecos.map((item, i) => (i === indice ? { ...item, ...patch, origem: "manual" } : item)));
  return (
    <Secao
      titulo="Endereços"
      className="-mx-6 px-6"
      acao={
        <Button size="sm" variant="outline" onClick={() => onChange([...enderecos, { ...ENDERECO_VAZIO }])}>
          <Plus /> Endereço
        </Button>
      }
    >
      {enderecos.length ? (
        <ul className="space-y-3">
          {enderecos.map((item, indice) => (
            <li key={indice} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_9rem_4.5rem_7.5rem_auto] sm:items-center">
              <div className="relative min-w-0">
                <Input value={item.endereco} onChange={(evento) => mudar(indice, { endereco: evento.target.value })} placeholder="Rua, número, complemento, bairro" aria-label={`Endereço ${indice + 1}`} className={item.origem === "vios" ? "pr-14" : undefined} />
                {item.origem === "vios" ? (
                  <Selo tom="neutro" className="absolute right-2 top-1/2 -translate-y-1/2 py-0 text-[11px]">
                    VIOS
                  </Selo>
                ) : null}
              </div>
              <Input value={item.cidade ?? ""} onChange={(evento) => mudar(indice, { cidade: evento.target.value })} placeholder="Cidade" aria-label={`Cidade do endereço ${indice + 1}`} />
              <Input value={item.uf ?? ""} onChange={(evento) => mudar(indice, { uf: evento.target.value.toUpperCase().slice(0, 2) })} placeholder="UF" aria-label={`UF do endereço ${indice + 1}`} />
              <Input value={item.cep ?? ""} onChange={(evento) => mudar(indice, { cep: evento.target.value })} placeholder="CEP" inputMode="numeric" aria-label={`CEP do endereço ${indice + 1}`} />
              <Button size="icon-sm" variant="ghost" aria-label={`Remover o endereço ${indice + 1}`} onClick={() => onChange(enderecos.filter((_, i) => i !== indice))}>
                <Trash2 />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Nenhum endereço. Inclua todos os que forem identificados.</p>
      )}
    </Secao>
  );
}

/** Contatos da pessoa no formulário: celular, telefone, e-mail e site, com a marca de WhatsApp. */
export function CamposDeContatos({ contatos, onChange }: { contatos: Contato[]; onChange: (contatos: Contato[]) => void }) {
  const mudar = (indice: number, patch: Partial<Contato>) => onChange(contatos.map((item, i) => (i === indice ? { ...item, ...patch, origem: "valor" in patch || "tipo" in patch ? "manual" : item.origem } : item)));
  return (
    <Secao
      titulo="Contatos"
      className="-mx-6 px-6"
      acao={
        <Button size="sm" variant="outline" onClick={() => onChange([...contatos, { ...CONTATO_VAZIO }])}>
          <Plus /> Contato
        </Button>
      }
    >
      {contatos.length ? (
        <ul className="space-y-3">
          {contatos.map((item, indice) => {
            const telefone = item.tipo === "celular" || item.tipo === "telefone";
            return (
              <li key={indice} className="grid gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_auto_auto] sm:items-center">
                <Seletor valor={item.tipo} onChange={(valor) => mudar(indice, { tipo: valor as Contato["tipo"] })} opcoes={OPCOES_CONTATO} rotulo={`Tipo do contato ${indice + 1}`} />
                <div className="relative min-w-0">
                  <Input
                    value={item.valor}
                    onChange={(evento) => mudar(indice, { valor: evento.target.value })}
                    placeholder={item.tipo === "email" ? "nome@empresa.com.br" : item.tipo === "site" ? "www.empresa.com.br" : "(11) 90000-0000"}
                    inputMode={telefone ? "tel" : item.tipo === "email" ? "email" : "url"}
                    aria-label={`Contato ${indice + 1}`}
                    className={item.origem === "vios" ? "pr-14" : undefined}
                  />
                  {item.origem === "vios" ? (
                    <Selo tom="neutro" className="absolute right-2 top-1/2 -translate-y-1/2 py-0 text-[11px]">
                      VIOS
                    </Selo>
                  ) : null}
                </div>
                <label className={`flex items-center gap-1.5 text-sm ${telefone ? "text-foreground" : "invisible"}`}>
                  <input type="checkbox" className="size-4 accent-[#347796]" checked={item.whatsapp} disabled={!telefone} onChange={(evento) => mudar(indice, { whatsapp: evento.target.checked })} />
                  WhatsApp
                </label>
                <Button size="icon-sm" variant="ghost" aria-label={`Remover o contato ${indice + 1}`} onClick={() => onChange(contatos.filter((_, i) => i !== indice))}>
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
  );
}
