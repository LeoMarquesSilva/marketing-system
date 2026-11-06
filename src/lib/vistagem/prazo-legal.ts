import { chaveNome } from "./agendamento";

/**
 * Prazo legal dos recursos (e das respostas a eles), em dias, para a vistagem já marcar os dias quando o jurídico
 * escolhe a tarefa de Prazo. Não é o prazo do tipo no VIOS: lá fica o dia do Enviar (ex.: APELAÇÃO 12 = 15 − 3).
 *
 * Comum (CPC art. 1.003, § 5º): 15 dias; embargos de declaração e a resposta a eles, 5 (art. 1.023); recurso
 * inominado do Juizado, 10 (Lei 9.099, art. 42). Trabalhista (Lei 5.584/70, art. 6º): 8 dias; embargos de declaração,
 * 5 (CLT art. 897-A); recurso extraordinário e agravos para o STF seguem o CPC (15).
 */
const PRAZOS_DE_RECURSO: readonly (readonly [nome: string, comum: number, trabalhista: number])[] = [
  ["APELAÇÃO", 15, 15],
  ["AGRAVO DE INSTRUMENTO", 15, 8],
  ["AGRAVO DE PETIÇÃO", 8, 8],
  ["AGRAVO EM RECURSO ESPECIAL - ARESP", 15, 15],
  ["AGRAVO INTERNO", 15, 8],
  ["AGRAVO INTERNO EM RECURSO ESPECIAL OU EXTRAORDINÁRIO", 15, 15],
  ["AGRAVO RETIDO/INTERNO", 15, 8],
  ["AIAP", 8, 8],
  ["AIRO", 8, 8],
  ["AIRR", 8, 8],
  ["CONTRAMINUTA", 15, 8],
  ["CONTRAMINUTA - I", 15, 8],
  ["CONTRARRAZÕES", 15, 8],
  ["EMBARGOS DE DECLARAÇÃO", 5, 5],
  ["RESPOSTA AOS EMBARGOS DE DECLARAÇÃO", 5, 5],
  ["RECURSO DE REVISTA", 8, 8],
  ["RECURSO ESPECIAL/EXTRAORDINÁRIO", 15, 15],
  ["RECURSO INOMINADO", 10, 10],
  ["RECURSO ORDINÁRIO", 15, 8],
];

const POR_NOME = new Map(PRAZOS_DE_RECURSO.map(([nome, comum, trabalhista]) => [chaveNome(nome), { comum, trabalhista }]));

/** Dias do prazo legal do recurso pelo nome da tarefa no VIOS; null quando a tarefa não é recurso. */
export function prazoLegalDaTarefa(nomeTarefa: string | null | undefined, areaDoCatalogo: string | null | undefined): number | null {
  const prazo = POR_NOME.get(chaveNome(nomeTarefa));
  if (!prazo) return null;
  return chaveNome(areaDoCatalogo) === "TRABALHISTA" ? prazo.trabalhista : prazo.comum;
}

/** Nomes com prazo legal, para a página de regras. */
export const RECURSOS_COM_PRAZO_LEGAL = PRAZOS_DE_RECURSO;
