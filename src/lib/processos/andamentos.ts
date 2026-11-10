/** Linha do tempo do processo: tipos e regras sem servidor (a ficha usa direto). */

export type FonteAndamento = "datajud" | "vios" | "manual" | "prazo" | "providencia";

export interface Andamento {
  id: string;
  /** ISO (data e hora). Andamento do VIOS só tem a data: vem à meia-noite. */
  quando: string;
  fonte: FonteAndamento;
  titulo: string;
  detalhe: string | null;
  /** Instância no DataJud (G1, G2…). */
  grau: string | null;
}

export interface LinhaDoTempo {
  andamentos: Andamento[];
  /** Última consulta ao DataJud (de onde vêm os movimentos do tribunal). */
  consultadoEm: string | null;
  /** Por que a última consulta não trouxe nada. */
  erroDataJud: string | null;
}

export const FONTES_ANDAMENTO: { valor: FonteAndamento; rotulo: string; descricao: string }[] = [
  { valor: "datajud", rotulo: "Tribunal (DataJud)", descricao: "Movimentos que o tribunal enviou ao DataJud do CNJ." },
  { valor: "vios", rotulo: "VIOS", descricao: "Último andamento manual cadastrado no VIOS." },
  { valor: "prazo", rotulo: "Prazos", descricao: "Prazos do processo (chegam com o módulo de prazos)." },
  { valor: "providencia", rotulo: "Providências", descricao: "Providências da equipe (chegam com o módulo de providências)." },
  { valor: "manual", rotulo: "Anotações", descricao: "Anotações feitas aqui." },
];

/** "G1" → "1º grau"; "G2" → "2º grau"; "SUP" → "Tribunal superior"; o resto como veio. */
export function rotuloDoGrau(grau: string | null | undefined): string | null {
  const texto = (grau ?? "").trim().toUpperCase();
  if (!texto) return null;
  if (texto === "G1") return "1º grau";
  if (texto === "G2") return "2º grau";
  if (texto === "SUP") return "Tribunal superior";
  if (texto === "JE") return "Juizado";
  if (texto === "TR") return "Turma recursal";
  return texto;
}

/** Andamentos agrupados por mês ("novembro de 2026"), do mais novo para o mais antigo. */
export function porMes(andamentos: Andamento[]): { mes: string; itens: Andamento[] }[] {
  const grupos = new Map<string, Andamento[]>();
  for (const andamento of [...andamentos].sort((a, b) => b.quando.localeCompare(a.quando))) {
    const mes = new Date(andamento.quando).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });
    grupos.set(mes, [...(grupos.get(mes) ?? []), andamento]);
  }
  return [...grupos].map(([mes, itens]) => ({ mes, itens }));
}
