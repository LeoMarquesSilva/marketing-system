import { campoPorChave, formatarValor, type Valores } from "./campos";
import { ITENS_SANEAMENTO } from "./preenchimento";
import { rotuloDoPapel, type Contato, type Parte } from "./types";

/**
 * Linhas da planilha de processos: uma coluna por item da lista de campos da equipe de Recuperação de
 * Crédito, na ordem em que ela mandou. Sem servidor, para dar para testar.
 */

export interface ColunaPlanilha {
  chave: string;
  rotulo: string;
  origem: "vios" | "novo";
}

export const COLUNAS_PLANILHA: ColunaPlanilha[] = ITENS_SANEAMENTO.map((item) => ({ chave: item.chave, rotulo: item.rotulo, origem: item.origem }));

const juntar = (itens: (string | null | undefined)[]) => itens.filter(Boolean).join("\n");

function contato(item: Contato): string {
  return `${item.valor}${item.whatsapp ? " (WhatsApp)" : ""}`;
}

function comDocumento(parte: Parte): string {
  return parte.documento ? `${parte.nome} (${parte.documento})` : parte.nome;
}

const PARTES: Record<string, (partes: Parte[]) => string> = {
  parte_ativa: (partes) => juntar(partes.filter((parte) => parte.papel === "parte" && parte.polo === "ativo").map((parte) => parte.nome)),
  parte_ativa_documento: (partes) => juntar(partes.filter((parte) => parte.papel === "parte" && parte.polo === "ativo").map((parte) => parte.documento)),
  parte_passiva: (partes) => juntar(partes.filter((parte) => parte.papel === "parte" && parte.polo === "passivo").map((parte) => parte.nome)),
  parte_passiva_documento: (partes) => juntar(partes.filter((parte) => parte.papel === "parte" && parte.polo === "passivo").map((parte) => parte.documento)),
  executado_enderecos: (partes) =>
    juntar(partes.filter((parte) => parte.devedor).flatMap((parte) => parte.enderecos.map((item) => juntar([item.endereco, juntar([item.cidade, item.uf, item.cep]).replace(/\n/g, " · ")]).replace(/\n/g, " · ")))),
  executado_contatos: (partes) => juntar(partes.filter((parte) => parte.devedor).flatMap((parte) => parte.contatos.map(contato))),
  representantes: (partes) =>
    juntar(partes.filter((parte) => ["representante", "socio", "administrador"].includes(parte.papel)).map((parte) => `${comDocumento(parte)}: ${parte.vinculo ?? rotuloDoPapel(parte.papel)}`)),
  corresponsaveis: (partes) =>
    juntar(partes.filter((parte) => ["corresponsavel", "fiador", "avalista"].includes(parte.papel)).map((parte) => `${comDocumento(parte)}: ${parte.vinculo ?? rotuloDoPapel(parte.papel)}`)),
  advogado_executado: (partes) => juntar(advogadosDoDevedor(partes).map((parte) => (parte.oab ? `${parte.nome} (OAB ${parte.oab})` : parte.nome))),
  advogado_executado_contatos: (partes) => juntar(advogadosDoDevedor(partes).flatMap((parte) => parte.contatos.map(contato))),
};

function advogadosDoDevedor(partes: Parte[]): Parte[] {
  const devedores = partes.filter((parte) => parte.devedor);
  const ids = new Set(devedores.map((parte) => parte.id));
  const polos = new Set(devedores.map((parte) => parte.polo));
  return partes.filter((parte) => parte.papel === "advogado" && (parte.referenteA ? ids.has(parte.referenteA) : polos.has(parte.polo)));
}

export function linhaDaPlanilha(valores: Valores, partes: Parte[]): string[] {
  return COLUNAS_PLANILHA.map((coluna) => {
    const dePartes = PARTES[coluna.chave];
    if (dePartes) return dePartes(partes);
    return formatarValor(campoPorChave(coluna.chave), valores[coluna.chave]);
  });
}
