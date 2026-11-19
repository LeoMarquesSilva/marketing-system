import "server-only";

import { z } from "zod";
import { AudienciasError, db, falhou } from "./server";
import type { TipoAudiencia } from "./tipos";

/**
 * Configuração da pauta (aud_config). O envio de verdade precisa de duas chaves: a do ambiente
 * (PAUTA_OUTLOOK_MODO=real, PAUTA_WHATSAPP_MODO=real) e a da tela de configurações (ligado). Sem as duas,
 * o sistema só registra o que mandaria (modo teste).
 */

const esquema = z.object({
  duracoes: z.record(z.string(), z.number().int().min(10).max(600)).default({}),
  whatsapp: z
    .object({ ligado: z.boolean().default(false), grupo: z.string().trim().max(120).nullable().default(null), instancia: z.string().trim().max(120).nullable().default(null) })
    .default({ ligado: false, grupo: null, instancia: null }),
  outlook: z.object({ ligado: z.boolean().default(false), organizador: z.string().trim().email().nullable().default(null) }).default({ ligado: false, organizador: null }),
  tribunais: z.array(z.string().regex(/^TRT\d{1,2}$/)).default(["TRT15"]),
});

export type ConfigPauta = z.infer<typeof esquema> & { duracoes: Partial<Record<TipoAudiencia, number>> };

export function modoOutlook(): "real" | "simulado" {
  return process.env.PAUTA_OUTLOOK_MODO?.trim().toLowerCase() === "real" ? "real" : "simulado";
}

export function modoWhatsapp(): "real" | "simulado" | "off" {
  const valor = process.env.PAUTA_WHATSAPP_MODO?.trim().toLowerCase();
  return valor === "real" ? "real" : valor === "off" ? "off" : "simulado";
}

export async function lerConfig(): Promise<ConfigPauta> {
  const { data, error } = await db().from("aud_config").select("chave, valor");
  if (error) falhou("ler a configuração da pauta", error);
  const bruto = Object.fromEntries(((data ?? []) as { chave: string; valor: unknown }[]).map((l) => [l.chave, l.valor]));
  return esquema.parse(bruto) as ConfigPauta;
}

export async function salvarConfig(entrada: unknown, quem: string | null): Promise<ConfigPauta> {
  const lido = esquema.partial().safeParse(entrada);
  if (!lido.success) throw new AudienciasError(lido.error.issues[0]?.message ?? "Configuração inválida.", 400);
  const linhas = Object.entries(lido.data)
    .filter(([, v]) => v !== undefined)
    .map(([chave, valor]) => ({ chave, valor, atualizado_em: new Date().toISOString(), atualizado_por: quem }));
  if (linhas.length) {
    const { error } = await db().from("aud_config").upsert(linhas, { onConflict: "chave" });
    if (error) falhou("salvar a configuração da pauta", error);
  }
  return lerConfig();
}
