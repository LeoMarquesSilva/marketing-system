/** Opções dos campos trabalhistas (sem dependências: o catálogo de campos também usa). Espelham a migration. */

export const TIPOS_TERMINO = [
  { valor: "sem_justa_causa", rotulo: "Dispensa sem justa causa" },
  { valor: "pedido_demissao", rotulo: "Pedido de demissão" },
  { valor: "justa_causa", rotulo: "Dispensa por justa causa" },
  { valor: "rescisao_indireta", rotulo: "Rescisão indireta" },
  { valor: "acordo_484a", rotulo: "Acordo (art. 484-A da CLT)" },
  { valor: "termino_contrato", rotulo: "Término do contrato a prazo" },
  { valor: "em_vigor", rotulo: "Contrato em vigor" },
  { valor: "outro", rotulo: "Outro" },
];

export const AGENTES_LAUDO = [
  { valor: "insalubridade", rotulo: "Insalubridade" },
  { valor: "periculosidade", rotulo: "Periculosidade" },
  { valor: "ambos", rotulo: "Insalubridade e periculosidade" },
  { valor: "nenhum", rotulo: "Nenhum (laudo negativo)" },
];

export const GRAUS = [
  { valor: "minimo", rotulo: "Mínimo (10%)" },
  { valor: "medio", rotulo: "Médio (20%)" },
  { valor: "maximo", rotulo: "Máximo (40%)" },
];

export const DECISOES = [
  { valor: "sentenca", rotulo: "Sentença" },
  { valor: "acordao", rotulo: "Acórdão (TRT)" },
  { valor: "rr", rotulo: "Recurso de revista (TST)" },
];

export const BASES_ADICIONAL = [
  { valor: "salario_minimo", rotulo: "Salário-mínimo" },
  { valor: "salario_contratual", rotulo: "Salário contratual" },
];

export type ResultadoPedido = "deferido" | "em_parte" | "indeferido" | "nao_julgado";
export const RESULTADOS_PEDIDO: { valor: ResultadoPedido; rotulo: string }[] = [
  { valor: "deferido", rotulo: "Deferido" },
  { valor: "em_parte", rotulo: "Deferido em parte" },
  { valor: "indeferido", rotulo: "Indeferido" },
  { valor: "nao_julgado", rotulo: "Não julgado" },
];

export type EspecieAfastamento = "auxilio_doenca" | "acidentario" | "outro";
export const ESPECIES_AFASTAMENTO: { valor: EspecieAfastamento; rotulo: string }[] = [
  { valor: "auxilio_doenca", rotulo: "Auxílio-doença (B31)" },
  { valor: "acidentario", rotulo: "Auxílio-doença acidentário (B91)" },
  { valor: "outro", rotulo: "Outro" },
];

