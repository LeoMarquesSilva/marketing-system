import "server-only";

// Lê o PDF (ou a foto) de um contrato e devolve as datas-chave para pré-preencher
// o formulário. A pessoa confere antes de salvar; nada é gravado daqui.
import { generateObject } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { OPENAI_DEFAULT_MODEL, openAIGenerationOptions } from "@/lib/openai-models";
import { onlyDigits } from "@/lib/masks-br";
import { ADJUSTMENT_INDEXES, VALUE_PERIODS, type ContractExtraction } from "./types";
import { FacilitiesHttpError } from "./server";

export function contractAiKey(): string | null {
  return process.env.NEXT_OPENAI_API_KEY || process.env.OPENAI_API_KEY || null;
}

const extractionSchema = z.object({
  titulo: z.string().nullable().describe("Nome curto do contrato, ex.: 'Locação do escritório', 'Licença Legal One'."),
  objeto: z.string().nullable().describe("Objeto do contrato em uma ou duas frases."),
  inicio_vigencia: z.string().nullable().describe("Início da vigência, AAAA-MM-DD."),
  fim_vigencia: z.string().nullable().describe("Fim da vigência atual, AAAA-MM-DD. Null se prazo indeterminado."),
  renovacao_automatica: z.boolean().nullable(),
  prazo_renovacao_meses: z.number().int().nullable().describe("Duração de cada renovação, em meses."),
  aviso_previo_dias: z.number().int().nullable().describe("Antecedência para não renovar ou rescindir, em dias (1 mês = 30 dias)."),
  indice_reajuste: z.enum(ADJUSTMENT_INDEXES).nullable().describe("ipca, igpm, inpc, ivar, fixo (percentual fixo) ou outro."),
  mes_reajuste: z.number().int().min(1).max(12).nullable().describe("Mês-base do reajuste anual (1-12)."),
  valor: z.number().nullable().describe("Valor do contrato em reais, sem símbolo."),
  periodicidade_valor: z.enum(VALUE_PERIODS).nullable().describe("mensal, anual ou total."),
  contratante: z.string().nullable().describe("Quem contrata (o escritório), como está no contrato."),
  documento_contratada: z.string().nullable().describe("CNPJ ou CPF de quem presta o serviço."),
  resumo: z
    .string()
    .nullable()
    .describe("Até 3 frases com o que mais importa: multa de rescisão, garantias, obrigações fora do comum."),
});

const SYSTEM_PROMPT = `Você lê contratos de fornecedores de um escritório de advocacia (Bismarchi | Pires Sociedade de Advogados).
Extraia só o que está escrito no documento; quando a informação não aparecer, devolva null — nunca invente.
Datas sempre em AAAA-MM-DD. Se o contrato diz "prazo de 12 meses a partir da assinatura" e a data de assinatura aparece, calcule o fim da vigência.
Aviso prévio em dias (30 dias por mês). Valores em reais como número (1.234,56 → 1234.56).
O contratante é o escritório; a contratada é o fornecedor.`;

const isoDate = (value: string | null) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null);

export async function extractContract(input: {
  apiKey: string;
  bytes: Uint8Array;
  contentType: string;
  fileName: string;
}): Promise<ContractExtraction> {
  const isPdf = input.contentType === "application/pdf";
  const isImage = input.contentType.startsWith("image/");
  if (!isPdf && !isImage) {
    throw new FacilitiesHttpError("A leitura automática funciona com PDF ou foto do contrato.", 415, "UNSUPPORTED_TYPE");
  }

  const modelId = process.env.OPENAI_CONTRACTS_MODEL?.trim() || OPENAI_DEFAULT_MODEL;
  const { object } = await generateObject({
    model: createOpenAI({ apiKey: input.apiKey })(modelId),
    schema: extractionSchema,
    schemaName: "contrato_fornecedor",
    system: SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: `Leia o contrato "${input.fileName}" e preencha os campos.` },
          isPdf
            ? { type: "file", data: input.bytes, mediaType: "application/pdf", filename: input.fileName }
            : { type: "image", image: input.bytes, mediaType: input.contentType },
        ],
      },
    ],
    ...openAIGenerationOptions(modelId, { reasoningEffort: "low", temperature: 0 }),
    maxRetries: 1,
    abortSignal: AbortSignal.timeout(55_000),
  });

  const start = isoDate(object.inicio_vigencia);
  const end = isoDate(object.fim_vigencia);
  const document = object.documento_contratada ? onlyDigits(object.documento_contratada) : "";
  return {
    title: object.titulo?.trim() || null,
    object: object.objeto?.trim() || null,
    start_date: start,
    end_date: end && (!start || end >= start) ? end : null,
    auto_renew: object.renovacao_automatica,
    renewal_months: object.prazo_renovacao_meses && object.prazo_renovacao_meses > 0 ? object.prazo_renovacao_meses : null,
    notice_days: object.aviso_previo_dias != null && object.aviso_previo_dias >= 0 ? object.aviso_previo_dias : null,
    adjustment_index: object.indice_reajuste,
    adjustment_month: object.mes_reajuste,
    value: object.valor != null && object.valor >= 0 ? object.valor : null,
    value_period: object.periodicidade_valor,
    contracting_party: object.contratante?.trim() || null,
    supplier_document: document.length === 11 || document.length === 14 ? document : null,
    summary: object.resumo?.trim() || null,
  };
}
