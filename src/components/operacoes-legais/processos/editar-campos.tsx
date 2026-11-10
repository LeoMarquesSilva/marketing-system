"use client";

import { useState } from "react";
import { CloudUpload, LoaderCircle, PencilLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { CampoProcesso, ValorCampo, Valores } from "@/lib/processos/campos";
import type { ProcessoDetalhe } from "@/lib/processos/types";
import { CampoData } from "../vistagem/campo-data";
import { DialogoAcao } from "../vistagem/dialogo-acao";
import { Seletor } from "../vistagem/seletor";
import { Aviso, Campo, Selo } from "../vistagem/ui";
import { mensagemDeErro, processosApi } from "./processos-api";

/** Valor do banco → texto do controle do formulário. */
export function paraFormulario(item: CampoProcesso, valor: ValorCampo | undefined): string {
  if (valor === null || valor === undefined) return "";
  if (Array.isArray(valor)) return valor.join("\n");
  if (typeof valor === "boolean") return valor ? "sim" : "nao";
  if ((item.tipo === "valor" || item.tipo === "percentual") && typeof valor === "number") {
    return valor.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return String(valor);
}

/** Texto do controle → o que a rota espera (ela valida e converte de novo). */
export function doFormulario(item: CampoProcesso, texto: string): unknown {
  if (item.tipo === "lista") return texto.split("\n").map((linha) => linha.trim()).filter(Boolean);
  if (item.tipo === "booleano") return texto === "sim" ? true : texto === "nao" ? false : null;
  return texto.trim();
}

const SIM_NAO = [
  { valor: "sim", rotulo: "Sim" },
  { valor: "nao", rotulo: "Não" },
];

/** O controle certo para o tipo do campo (texto, data, valor, opção…). */
export function Controle({ item, valor, onChange }: { item: CampoProcesso; valor: string; onChange: (valor: string) => void }) {
  if (!item.editavel) return <Input value={valor} disabled readOnly />;
  switch (item.tipo) {
    case "texto_longo":
      return <Textarea value={valor} onChange={(evento) => onChange(evento.target.value)} rows={6} className="text-sm" />;
    case "lista":
      return <Textarea value={valor} onChange={(evento) => onChange(evento.target.value)} rows={3} className="text-sm" />;
    case "data":
      return <CampoData valor={valor} onChange={onChange} rotulo={item.rotulo} permitirVazio />;
    case "booleano":
      return <Seletor valor={valor} onChange={onChange} opcoes={SIM_NAO} todos={{ rotulo: "Não informado" }} rotulo={item.rotulo} />;
    case "opcao":
      return <Seletor valor={valor} onChange={onChange} opcoes={item.opcoes ?? []} todos={{ rotulo: "Não informado" }} rotulo={item.rotulo} />;
    case "valor":
    case "percentual":
      return <Input value={valor} onChange={(evento) => onChange(evento.target.value)} inputMode="decimal" placeholder={item.tipo === "valor" ? "0,00" : "0"} className="tabular-nums" />;
    default:
      return <Input value={valor} onChange={(evento) => onChange(evento.target.value)} />;
  }
}

/**
 * Edição de um grupo de campos do cadastro. Só o que mudou vai para a rota; campo que existe no VIOS
 * entra na fila de gravação (o aviso do rodapé diz isso antes de salvar).
 */
export function EditarCampos({
  processoId,
  titulo,
  campos,
  valores,
  gravacaoSimulada,
  onFechar,
  onSalvo,
}: {
  processoId: string;
  titulo: string;
  campos: CampoProcesso[];
  valores: Valores;
  gravacaoSimulada: boolean;
  onFechar: () => void;
  onSalvo: (processo: ProcessoDetalhe) => void;
}) {
  const [iniciais] = useState(() => Object.fromEntries(campos.map((item) => [item.chave, paraFormulario(item, valores[item.chave])])));
  const [formulario, setFormulario] = useState<Record<string, string>>(iniciais);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const alterados = campos.filter((item) => item.editavel && formulario[item.chave] !== iniciais[item.chave]);
  const paraVios = alterados.filter((item) => item.origem === "vios").length;

  async function salvar() {
    setSalvando(true);
    setErro("");
    try {
      const corpo = Object.fromEntries(alterados.map((item) => [item.chave, doFormulario(item, formulario[item.chave])]));
      const resposta = await processosApi.patch<{ processo: ProcessoDetalhe }>(`/${processoId}`, { valores: corpo });
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
      icone={PencilLine}
      titulo={`Editar ${titulo.toLowerCase()}`}
      descricao="Campo que já existe no VIOS entra na fila de gravação de volta; campo novo fica só aqui."
      className="sm:max-w-3xl"
      aviso={
        paraVios ? (
          <span className="inline-flex items-center gap-1.5 text-amber-800">
            <CloudUpload className="size-3.5" aria-hidden />
            {paraVios} campo{paraVios === 1 ? "" : "s"} do VIOS {paraVios === 1 ? "vai" : "vão"} para a fila{gravacaoSimulada ? " (gravação simulada)" : ""}.
          </span>
        ) : alterados.length ? (
          `${alterados.length} campo${alterados.length === 1 ? "" : "s"} alterado${alterados.length === 1 ? "" : "s"}.`
        ) : (
          "Nada alterado ainda."
        )
      }
      rodape={
        <>
          <Button variant="outline" onClick={onFechar} disabled={salvando}>
            Cancelar
          </Button>
          <Button onClick={() => void salvar()} disabled={salvando || !alterados.length}>
            {salvando ? <LoaderCircle className="animate-spin" /> : null} Salvar
          </Button>
        </>
      }
    >
      {erro ? <Aviso tom="erro">{erro}</Aviso> : null}
      <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        {campos.map((item) => (
          <Campo
            key={item.chave}
            className={item.tipo === "texto_longo" || item.tipo === "lista" ? "sm:col-span-2" : undefined}
            rotulo={
              <span className="flex flex-wrap items-center gap-1.5">
                {item.rotulo}
                <Selo tom={item.origem === "vios" ? "neutro" : "marca"} className="py-0 text-[11px]">
                  {item.origem === "vios" ? "VIOS" : "Novo"}
                </Selo>
              </span>
            }
            dica={!item.editavel ? "Vem do VIOS e não é editado aqui." : item.tipo === "lista" ? "Um por linha." : undefined}
          >
            <Controle item={item} valor={formulario[item.chave] ?? ""} onChange={(valor) => setFormulario((atual) => ({ ...atual, [item.chave]: valor }))} />
          </Campo>
        ))}
      </div>
    </DialogoAcao>
  );
}
