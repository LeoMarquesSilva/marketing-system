import { CAMPOS, estaPreenchido, type Valores } from "./campos";
import type { ItemSaneamento, Parte, Preenchimento } from "./types";

/**
 * Saneamento: quanto da lista de campos da equipe de Recuperação de Crédito está preenchido em cada
 * processo. Os campos simples vêm do catálogo (naLista); os itens de partes olham proc_partes.
 * Item marcado como "não se aplica" (ex.: não há fiador) sai da conta. Também saem sozinhos, enquanto
 * vazios, os itens opcionais (outros números, acordo) e as datas de arquivamento e encerramento de
 * processo ativo.
 */

type ItemDePartes = { chave: string; rotulo: string; origem: "vios" | "novo"; ok: (partes: Parte[]) => boolean };

const PAPEIS_SOCIETARIOS = new Set(["representante", "socio", "administrador"]);
const PAPEIS_GARANTIA = new Set(["corresponsavel", "fiador", "avalista"]);

const partesDoPolo = (partes: Parte[], polo: string) => partes.filter((parte) => parte.papel === "parte" && parte.polo === polo);
const devedores = (partes: Parte[]) => partes.filter((parte) => parte.devedor);
const todos = <T,>(lista: T[], teste: (item: T) => boolean) => lista.length > 0 && lista.every(teste);

/** Advogados do devedor: os ligados a ele (referente a) ou, sem ligação, os do mesmo polo. */
function advogadosDoDevedor(partes: Parte[]): Parte[] {
  const alvo = devedores(partes);
  const ids = new Set(alvo.map((parte) => parte.id));
  const polos = new Set(alvo.map((parte) => parte.polo));
  return partes.filter((parte) => parte.papel === "advogado" && (parte.referenteA ? ids.has(parte.referenteA) : polos.has(parte.polo)));
}

export const ITENS_DE_PARTES: ItemDePartes[] = [
  { chave: "parte_ativa", rotulo: "Parte ativa: nome ou razão social", origem: "vios", ok: (partes) => partesDoPolo(partes, "ativo").length > 0 },
  { chave: "parte_ativa_documento", rotulo: "Parte ativa: CPF/CNPJ", origem: "vios", ok: (partes) => todos(partesDoPolo(partes, "ativo"), (parte) => Boolean(parte.documento)) },
  { chave: "parte_passiva", rotulo: "Parte passiva: nome ou razão social", origem: "vios", ok: (partes) => partesDoPolo(partes, "passivo").length > 0 },
  { chave: "parte_passiva_documento", rotulo: "Parte passiva: CPF/CNPJ", origem: "vios", ok: (partes) => todos(partesDoPolo(partes, "passivo"), (parte) => Boolean(parte.documento)) },
  { chave: "executado_enderecos", rotulo: "Executado: endereços", origem: "novo", ok: (partes) => todos(devedores(partes), (parte) => parte.enderecos.length > 0) },
  { chave: "executado_contatos", rotulo: "Executado: celular/WhatsApp, e-mail, site", origem: "novo", ok: (partes) => todos(devedores(partes), (parte) => parte.contatos.length > 0) },
  { chave: "representantes", rotulo: "Representantes, sócios, administradores", origem: "novo", ok: (partes) => partes.some((parte) => PAPEIS_SOCIETARIOS.has(parte.papel)) },
  { chave: "corresponsaveis", rotulo: "Corresponsáveis, fiadores, avalistas", origem: "novo", ok: (partes) => partes.some((parte) => PAPEIS_GARANTIA.has(parte.papel)) },
  { chave: "advogado_executado", rotulo: "Advogado do executado: nome e OAB", origem: "novo", ok: (partes) => todos(advogadosDoDevedor(partes), (parte) => Boolean(parte.oab)) },
  { chave: "advogado_executado_contatos", rotulo: "Advogado do executado: telefone, WhatsApp, e-mail", origem: "novo", ok: (partes) => todos(advogadosDoDevedor(partes), (parte) => parte.contatos.length > 0) },
];

/** Ordem da lista enviada pela equipe: os itens de partes entram depois do polo do cliente. */
const DEPOIS_DE = "polo_cliente";

function itensNaOrdem(): { chave: string; rotulo: string; origem: "vios" | "novo"; partes?: ItemDePartes }[] {
  const simples = CAMPOS.filter((item) => item.naLista).map((item) => ({ chave: item.chave, rotulo: item.rotulo, origem: item.origem }));
  const corte = simples.findIndex((item) => item.chave === DEPOIS_DE) + 1;
  const dePartes = ITENS_DE_PARTES.map((item) => ({ chave: item.chave, rotulo: item.rotulo, origem: item.origem, partes: item }));
  return [...simples.slice(0, corte), ...dePartes, ...simples.slice(corte)];
}

export const ITENS_SANEAMENTO = itensNaOrdem();

/** Só existem em alguns processos (não há outro número, não houve acordo): vazios, não contam como falta. */
const OPCIONAIS = new Set(["outros_numeros", "data_acordo", "valor_acordo"]);
/** Só fazem sentido depois que o processo deixa de estar ativo. */
const SO_ENCERRADO = new Set(["data_arquivamento", "data_encerramento"]);

function dispensado(chave: string, valores: Valores): boolean {
  if (OPCIONAIS.has(chave)) return true;
  return SO_ENCERRADO.has(chave) && /^ativo/i.test(String(valores.situacao ?? ""));
}

export function calcularPreenchimento(valores: Valores, partes: Parte[], naoAplicaveis: string[] = []): Preenchimento {
  const fora = new Set(naoAplicaveis);
  const itens: ItemSaneamento[] = ITENS_SANEAMENTO.map((item) => {
    if (fora.has(item.chave)) return { chave: item.chave, rotulo: item.rotulo, origem: item.origem, estado: "nao_se_aplica" };
    const ok = item.partes ? item.partes.ok(partes) : estaPreenchido(valores[item.chave]);
    if (!ok && dispensado(item.chave, valores)) return { chave: item.chave, rotulo: item.rotulo, origem: item.origem, estado: "nao_se_aplica", automatico: true };
    return { chave: item.chave, rotulo: item.rotulo, origem: item.origem, estado: ok ? "ok" : "falta" };
  });
  const contam = itens.filter((item) => item.estado !== "nao_se_aplica");
  const feitos = contam.filter((item) => item.estado === "ok").length;
  return { itens, feitos, total: contam.length, percentual: contam.length ? Math.round((feitos / contam.length) * 100) : 100 };
}
