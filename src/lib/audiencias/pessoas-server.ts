import "server-only";

import { z } from "zod";
import { AudienciasError, COLUNAS_PESSOA, db, falhou, paraPessoa } from "./server";
import type { PessoaPauta } from "./tipos";

const esquema = z.object({
  id: z.string().uuid(),
  nomeCurto: z.string().trim().min(2).max(60).optional(),
  email: z.string().trim().email("E-mail inválido.").nullable().optional(),
  whatsapp: z
    .string()
    .trim()
    .regex(/^[\d\s()+-]{10,20}$/, "WhatsApp com DDD, só números.")
    .nullable()
    .optional(),
  fazAudiencia: z.boolean().optional(),
  coordenacao: z.boolean().optional(),
  ativo: z.boolean().optional(),
});

/** A controladoria completa a pessoa: WhatsApp (para a marcação no grupo), e-mail (convite), papel na pauta. */
export async function salvarPessoa(entrada: unknown): Promise<PessoaPauta> {
  const lido = esquema.safeParse(entrada);
  if (!lido.success) throw new AudienciasError(lido.error.issues[0]?.message ?? "Dados inválidos.", 400);
  const { id, ...d } = lido.data;
  const campos: Record<string, unknown> = {};
  if (d.nomeCurto !== undefined) campos.nome_curto = d.nomeCurto;
  if (d.email !== undefined) campos.email = d.email || null;
  if (d.whatsapp !== undefined) campos.whatsapp = d.whatsapp ? d.whatsapp.replace(/\D/g, "") : null;
  if (d.fazAudiencia !== undefined) campos.faz_audiencia = d.fazAudiencia;
  if (d.coordenacao !== undefined) campos.coordenacao = d.coordenacao;
  if (d.ativo !== undefined) campos.ativo = d.ativo;
  const { data, error } = await db().from("aud_pessoas").update(campos).eq("id", id).select(COLUNAS_PESSOA).maybeSingle();
  if (error) falhou("salvar a pessoa", error);
  if (!data) throw new AudienciasError("Pessoa não encontrada.", 404);
  return paraPessoa(data as Record<string, unknown>);
}
