/**
 * Sincronização de clientes ativos do SIOE (tabela pessoas) para email_contacts / email_companies.
 * Server-only.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getAdminClient } from "@/lib/email-marketing-server";
import {
  companyNameKey,
  fixMojibake,
  normalizeCompanyName,
  formatPersonDisplayName,
  normalizePersonName,
  resolveCanonicalCompanyName,
} from "@/lib/email-marketing-normalize";
import {
  departmentToSioeArea,
  normalizeLegalArea,
  normalizeLegalAreas,
  SUBAREA_ONLY,
} from "@/lib/legal-areas";
import { isInternalClientGroupName } from "@/lib/meus-clientes";

const DEFAULT_SIOE_URL = "https://pzfxmlidwdmsqfwrxdbd.supabase.co";
const PAGE_SIZE = 500;
const PROCESSOS_ID_BATCH = 50;
const FETCH_RETRIES = 4;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= FETCH_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < FETCH_RETRIES) {
        const delayMs = 1000 * 2 ** (attempt - 1);
        if (process.env.SIOE_SYNC_DEBUG) {
          console.warn(`${label} tentativa ${attempt} falhou, retry em ${delayMs}ms`, err);
        }
        await sleep(delayMs);
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} falhou após ${FETCH_RETRIES} tentativas`);
}

function isOpenProcesso(value: string | null | undefined): boolean {
  return (value ?? "").trim().toLowerCase() !== "sim";
}

export interface SioePessoa {
  id: string;
  nome: string;
  nome_fantasia_apelido: string | null;
  tipo: string | null;
  email: string | null;
  telefone: string | null;
  cidade: string | null;
  uf: string | null;
  cpf_cnpj: string | null;
  site: string | null;
  linkedin: string | null;
  contato_1: string | null;
  categoria: string | null;
  grupo_cliente: string | null;
}

export interface SioeSyncResult {
  fetched: number;
  groupsUpserted: number;
  companiesUpserted: number;
  peopleUpserted: number;
  contactsUpserted: number;
  skippedNoEmail: number;
  errors: number;
  responsiblesUpserted: number;
  unmatchedAdvogados: string[];
}

interface SioeProcesso {
  pessoa_id: string;
  area: string | null;
  advogado_responsavel: string | null;
  processo_encerrado: string | null;
}

function getSioeConfig() {
  const url = process.env.SIOE_SUPABASE_URL?.trim() || DEFAULT_SIOE_URL;
  const serviceKey = process.env.SIOE_SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!serviceKey) {
    throw new Error(
      "Configure SIOE_SUPABASE_SERVICE_ROLE_KEY no .env (service role do projeto SIOE PRO)."
    );
  }
  return { url, serviceKey };
}

export function isSioeSyncConfigured(): boolean {
  try {
    getSioeConfig();
    return true;
  } catch {
    return false;
  }
}

export function getSioeClient(): SupabaseClient {
  const { url, serviceKey } = getSioeConfig();
  return createClient(url, serviceKey);
}

function isActiveClient(categoria: string | null): boolean {
  if (!categoria) return false;
  const normalized = fixMojibake(categoria)?.toLowerCase() ?? categoria.toLowerCase();
  if (!normalized.includes("cliente ativo")) return false;
  if (normalized.includes("cliente inativo")) return false;
  return true;
}

function isLegalEntity(tipo: string | null): boolean {
  const t = fixMojibake(tipo)?.toLowerCase() ?? tipo?.toLowerCase() ?? "";
  return t.includes("jur") || t.includes("jurídica") || t.includes("juridica");
}

function isNaturalPerson(tipo: string | null): boolean {
  if (isLegalEntity(tipo)) return false;
  const t = fixMojibake(tipo)?.toLowerCase() ?? tipo?.toLowerCase() ?? "";
  return t.includes("física") || t.includes("fisica") || t.includes("f_sica");
}

function normalizeCity(value: string | null): string | null {
  const city = normalizeCompanyName(value);
  if (!city) return null;
  if (city.toLowerCase() === "não informada" || city.toLowerCase() === "nao informada") return null;
  return city;
}

function resolveCompanyDisplayName(pessoa: SioePessoa): string | null {
  const fantasy = resolveCanonicalCompanyName(pessoa.nome_fantasia_apelido);
  const legal = resolveCanonicalCompanyName(pessoa.nome);
  if (isLegalEntity(pessoa.tipo)) return fantasy ?? legal;
  return null;
}

function isValidEmail(email: string | null | undefined): boolean {
  const value = email?.trim().toLowerCase();
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function fetchActiveClients(sioe: SupabaseClient): Promise<SioePessoa[]> {
  const all: SioePessoa[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await sioe
      .from("pessoas")
      .select(
        "id, nome, nome_fantasia_apelido, tipo, email, telefone, cidade, uf, cpf_cnpj, site, linkedin, contato_1, categoria, grupo_cliente"
      )
      .ilike("categoria", "%Cliente ativo%")
      .not("categoria", "ilike", "%inativo%")
      .order("nome")
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw new Error(`Erro ao ler pessoas no SIOE: ${error.message}`);
    const batch = (data ?? []) as SioePessoa[];
    all.push(...batch.filter((row) => isActiveClient(row.categoria)));
    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return all;
}

function resolveClientGroupName(value: string | null | undefined): string | null {
  return normalizeCompanyName(value) ?? resolveCanonicalCompanyName(value);
}

/** Chave diacritic-insensitive para casar nomes de advogados entre SIOE e o cadastro de usuários. */
function nameKey(value: string | null | undefined): string | null {
  const fixed = fixMojibake(value);
  if (!fixed) return null;
  const key = fixed
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return key || null;
}

async function upsertClientGroup(
  admin: ReturnType<typeof getAdminClient>,
  grupoCliente: string | null | undefined,
  syncedAt: string,
  cache: Map<string, string | null>
): Promise<string | null> {
  const name = resolveClientGroupName(grupoCliente);
  if (!name || isInternalClientGroupName(name)) return null;
  const key = companyNameKey(name);
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  const { data, error } = await admin
    .from("email_client_groups")
    .upsert(
      {
        name,
        name_normalized: key,
        source: "sioe",
        sioe_synced_at: syncedAt,
      },
      { onConflict: "name_normalized" }
    )
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  const id = data.id as string;
  cache.set(key, id);
  return id;
}

function buildCompanyPayload(
  pessoa: SioePessoa,
  companyName: string,
  key: string,
  syncedAt: string,
  clientGroupId: string | null
) {
  return {
    name: companyName,
    name_normalized: key,
    city: normalizeCity(pessoa.cidade),
    state: normalizeCompanyName(pessoa.uf),
    cnpj: pessoa.cpf_cnpj?.trim() || null,
    website: pessoa.site?.trim() || null,
    linkedin: pessoa.linkedin?.trim() || null,
    source: "sioe",
    client_group_id: clientGroupId,
    sioe_pessoa_id: pessoa.id,
    sioe_synced_at: syncedAt,
    custom_fields: {
      sioe_tipo: pessoa.tipo,
      sioe_grupo_cliente: pessoa.grupo_cliente,
      sioe_categoria: pessoa.categoria,
      sioe_razao_social: normalizeCompanyName(pessoa.nome),
    },
  };
}

async function upsertCompanyFromSioe(
  admin: ReturnType<typeof getAdminClient>,
  pessoa: SioePessoa,
  syncedAt: string,
  clientGroupId: string | null
): Promise<{ companyId: string | null; companyName: string | null }> {
  const companyName = resolveCompanyDisplayName(pessoa);
  if (!companyName) return { companyId: null, companyName: null };

  const key = companyNameKey(companyName);
  if (!key) return { companyId: null, companyName: null };

  const payload = buildCompanyPayload(pessoa, companyName, key, syncedAt, clientGroupId);

  const bySioe = await admin
    .from("email_companies")
    .upsert(payload, { onConflict: "sioe_pessoa_id" })
    .select("id, name")
    .maybeSingle();

  if (!bySioe.error && bySioe.data) {
    return { companyId: bySioe.data.id as string, companyName: bySioe.data.name as string };
  }

  const byName = await admin
    .from("email_companies")
    .upsert(payload, { onConflict: "name_normalized" })
    .select("id, name")
    .single();

  if (byName.error) throw new Error(byName.error.message);
  return { companyId: byName.data.id as string, companyName: byName.data.name as string };
}

async function upsertContactFromSioe(
  admin: ReturnType<typeof getAdminClient>,
  pessoa: SioePessoa,
  companyId: string | null,
  companyName: string | null,
  clientGroupId: string | null,
  syncedAt: string,
  existingByEmail: Map<string, Record<string, unknown>>
): Promise<boolean> {
  const email = pessoa.email?.trim().toLowerCase();
  if (!isValidEmail(email)) return false;

  const existing = existingByEmail.get(email!);
  const contactName =
    formatPersonDisplayName(pessoa.contato_1) ??
    (isLegalEntity(pessoa.tipo) ? null : formatPersonDisplayName(pessoa.nome)) ??
    formatPersonDisplayName(existing?.name as string | null);

  const payload = {
    email: email!,
    name: contactName,
    phone: pessoa.telefone?.trim() || (existing?.phone as string | null) || null,
    company: companyName ?? (existing?.company as string | null) ?? null,
    company_id: companyId ?? (existing?.company_id as string | null) ?? null,
    client_group_id: clientGroupId ?? (existing?.client_group_id as string | null) ?? null,
    tags: (existing?.tags as string[] | undefined) ?? [],
    status: (existing?.status as string | undefined) ?? "subscribed",
    source: (existing?.source as string | undefined) ?? "sioe",
    custom_fields: {
      ...((existing?.custom_fields as Record<string, unknown> | undefined) ?? {}),
      sioe_pessoa_id: pessoa.id,
      sioe_tipo: pessoa.tipo,
      sioe_categoria: pessoa.categoria,
      sioe_grupo_cliente: pessoa.grupo_cliente,
    },
    sioe_pessoa_id: pessoa.id,
    sioe_synced_at: syncedAt,
  };

  const { error } = await admin.from("email_contacts").upsert(payload, { onConflict: "email" });
  if (error) throw new Error(error.message);
  return true;
}

async function upsertPersonFromSioe(
  admin: ReturnType<typeof getAdminClient>,
  pessoa: SioePessoa,
  clientGroupId: string | null,
  syncedAt: string
): Promise<string | null> {
  if (!isNaturalPerson(pessoa.tipo)) return null;

  const name = formatPersonDisplayName(pessoa.contato_1) ?? formatPersonDisplayName(pessoa.nome);
  if (!name) return null;

  const payload = {
    sioe_pessoa_id: pessoa.id,
    name,
    email: isValidEmail(pessoa.email) ? pessoa.email!.trim().toLowerCase() : null,
    phone: pessoa.telefone?.trim() || null,
    cpf_cnpj: pessoa.cpf_cnpj?.trim() || null,
    client_group_id: clientGroupId,
    company_id: null,
    source: "sioe",
    sioe_synced_at: syncedAt,
    custom_fields: {
      sioe_tipo: pessoa.tipo,
      sioe_categoria: pessoa.categoria,
      sioe_grupo_cliente: pessoa.grupo_cliente,
    },
  };

  const bySioe = await admin
    .from("email_people")
    .upsert(payload, { onConflict: "sioe_pessoa_id" })
    .select("id")
    .maybeSingle();

  if (!bySioe.error && bySioe.data) return bySioe.data.id as string;

  if (bySioe.error && process.env.SIOE_SYNC_DEBUG) {
    console.error("upsertPersonFromSioe upsert error", pessoa.id, bySioe.error.message);
  }

  const { data, error } = await admin.from("email_people").insert(payload).select("id").single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

/** Varre processos_completo no SIOE PRO paginando a tabela (mais estável que centenas de .in()). */
async function fetchAllOpenProcessosFiltered(
  sioe: SupabaseClient,
  pessoaIdSet: Set<string>
): Promise<SioeProcesso[]> {
  const result: SioeProcesso[] = [];
  let from = 0;

  while (true) {
    const batch = await withRetry(`processos_completo offset ${from}`, async () => {
      const { data, error } = await sioe
        .from("processos_completo")
        .select("pessoa_id, area, advogado_responsavel, processo_encerrado")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`Erro ao ler processos_completo no SIOE: ${error.message}`);
      return (data ?? []) as SioeProcesso[];
    });

    for (const row of batch) {
      if (!pessoaIdSet.has(row.pessoa_id) || !isOpenProcesso(row.processo_encerrado)) continue;
      result.push(row);
    }

    if (batch.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  return result;
}

async function fetchOpenProcessosForPessoas(
  sioe: SupabaseClient,
  pessoaIds: string[]
): Promise<SioeProcesso[]> {
  if (pessoaIds.length === 0) return [];

  const pessoaIdSet = new Set(pessoaIds);

  // Listas grandes: uma varredura paginada da tabela evita timeout em dezenas de queries .in().
  if (pessoaIds.length >= 100) {
    return fetchAllOpenProcessosFiltered(sioe, pessoaIdSet);
  }

  const result: SioeProcesso[] = [];
  for (let i = 0; i < pessoaIds.length; i += PROCESSOS_ID_BATCH) {
    const idsBatch = pessoaIds.slice(i, i + PROCESSOS_ID_BATCH);
    let from = 0;
    while (true) {
      const batch = await withRetry(`processos_completo pessoa_ids ${i}`, async () => {
        const { data, error } = await sioe
          .from("processos_completo")
          .select("pessoa_id, area, advogado_responsavel, processo_encerrado")
          .in("pessoa_id", idsBatch)
          .range(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`Erro ao ler processos_completo no SIOE: ${error.message}`);
        return (data ?? []) as SioeProcesso[];
      });

      result.push(...batch.filter((row) => isOpenProcesso(row.processo_encerrado)));
      if (batch.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }

  return result;
}

interface ResponsibleAggregate {
  pessoaId: string;
  area: string | null;
  advogadoName: string | null;
  advogadoNormalized: string | null;
  count: number;
}

function aggregateResponsibles(rows: SioeProcesso[]): ResponsibleAggregate[] {
  const map = new Map<string, ResponsibleAggregate>();
  for (const row of rows) {
    const area = normalizeCompanyName(row.area);
    const advogadoName = formatPersonDisplayName(row.advogado_responsavel);
    const advogadoNormalized = nameKey(advogadoName);
    const key = `${row.pessoa_id}::${area ?? ""}::${advogadoNormalized ?? ""}`;
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      continue;
    }
    map.set(key, { pessoaId: row.pessoa_id, area, advogadoName, advogadoNormalized, count: 1 });
  }
  return Array.from(map.values());
}

interface PessoaLink {
  clientGroupId: string | null;
  companyId: string | null;
  personId: string | null;
}

/** Monta vínculos SIOE → grupo/empresa/pessoa a partir do que já está no ORQESTRAI. */
async function buildPessoaLinksFromDatabase(
  admin: ReturnType<typeof getAdminClient>
): Promise<Map<string, PessoaLink>> {
  const map = new Map<string, PessoaLink>();

  const [{ data: people }, { data: companies }] = await Promise.all([
    admin
      .from("email_people")
      .select("id, sioe_pessoa_id, client_group_id, company_id")
      .not("sioe_pessoa_id", "is", null),
    admin
      .from("email_companies")
      .select("id, sioe_pessoa_id, client_group_id")
      .not("sioe_pessoa_id", "is", null),
  ]);

  for (const row of people ?? []) {
    const sioeId = row.sioe_pessoa_id as string;
    map.set(sioeId, {
      clientGroupId: (row.client_group_id as string | null) ?? null,
      companyId: (row.company_id as string | null) ?? null,
      personId: row.id as string,
    });
  }

  for (const row of companies ?? []) {
    const sioeId = row.sioe_pessoa_id as string;
    const existing = map.get(sioeId);
    if (existing) {
      if (!existing.companyId) existing.companyId = row.id as string;
      if (!existing.clientGroupId) existing.clientGroupId = (row.client_group_id as string | null) ?? null;
      continue;
    }
    map.set(sioeId, {
      clientGroupId: (row.client_group_id as string | null) ?? null,
      companyId: row.id as string,
      personId: null,
    });
  }

  return map;
}

function mergePessoaLinks(
  primary: Map<string, PessoaLink>,
  secondary: Map<string, PessoaLink>
): Map<string, PessoaLink> {
  const merged = new Map(primary);
  for (const [sioeId, link] of secondary) {
    const existing = merged.get(sioeId);
    if (!existing) {
      merged.set(sioeId, link);
      continue;
    }
    merged.set(sioeId, {
      clientGroupId: existing.clientGroupId ?? link.clientGroupId,
      companyId: existing.companyId ?? link.companyId,
      personId: existing.personId ?? link.personId,
    });
  }
  return merged;
}

/**
 * Lê processos_completo no SIOE para os clientes recém-sincronizados, casa o
 * advogado_responsavel com um usuário do sistema (override manual > nome normalizado)
 * e regrava email_group_responsibles + as colunas denormalizadas legal_areas/responsible_user_ids.
 */
async function syncResponsibles(
  sioe: SupabaseClient,
  admin: ReturnType<typeof getAdminClient>,
  pessoaLinks: Map<string, PessoaLink>,
  syncedAt: string
): Promise<{ responsiblesUpserted: number; unmatchedAdvogados: string[] }> {
  const pessoaIds = Array.from(pessoaLinks.keys());
  if (pessoaIds.length === 0) return { responsiblesUpserted: 0, unmatchedAdvogados: [] };

  const processos = await fetchOpenProcessosForPessoas(sioe, pessoaIds);
  const aggregates = aggregateResponsibles(processos);
  if (aggregates.length === 0) return { responsiblesUpserted: 0, unmatchedAdvogados: [] };

  const [{ data: overrideRows }, { data: userRows }] = await Promise.all([
    admin.from("email_advogado_user_overrides").select("advogado_name_normalized, user_id"),
    admin.from("users").select("id, name, department"),
  ]);

  const overrideByName = new Map(
    (overrideRows ?? []).map((r) => [r.advogado_name_normalized as string, r.user_id as string])
  );
  const userIdByName = new Map<string, string>();
  const departmentByUserId = new Map<string, string | null>();
  for (const row of userRows ?? []) {
    const key = nameKey(row.name as string);
    if (key && !userIdByName.has(key)) userIdByName.set(key, row.id as string);
    departmentByUserId.set(row.id as string, (row.department as string | null) ?? null);
  }

  const touchedGroupIds = new Set<string>();
  const rows: Record<string, unknown>[] = [];
  const unmatched = new Set<string>();
  const areasByGroup = new Map<string, Set<string>>();
  const usersByGroup = new Map<string, Set<string>>();
  const areasByCompany = new Map<string, Set<string>>();
  const usersByCompany = new Map<string, Set<string>>();

  for (const agg of aggregates) {
    const link = pessoaLinks.get(agg.pessoaId);
    if (!link) continue;

    const responsibleUserId =
      (agg.advogadoNormalized && overrideByName.get(agg.advogadoNormalized)) ||
      (agg.advogadoNormalized && userIdByName.get(agg.advogadoNormalized)) ||
      null;

    if (agg.advogadoName && !responsibleUserId) unmatched.add(agg.advogadoName);

    if (link.clientGroupId) touchedGroupIds.add(link.clientGroupId);

    // Área do cliente: prioriza a área de prática do advogado casado (nosso
    // cadastro, department → área SIOE) — vincula pelo usuário, não pelo
    // processo. Exceção: quando o próprio processo já traz uma subárea
    // específica (ex.: "Recuperação de Crédito", subárea de Cível), preserva
    // essa etiqueta — não some só porque o advogado é do Cível em geral.
    // Sem advogado casado (ou department sem área mapeada), cai no valor
    // bruto do processo do SIOE como antes.
    const rawArea = normalizeLegalArea(agg.area);
    const departmentArea = responsibleUserId
      ? departmentToSioeArea(departmentByUserId.get(responsibleUserId))
      : null;
    const resolvedArea =
      rawArea && SUBAREA_ONLY.has(rawArea) ? rawArea : normalizeLegalArea(departmentArea ?? agg.area);

    rows.push({
      client_group_id: link.clientGroupId,
      company_id: link.companyId,
      person_id: link.personId,
      area: resolvedArea,
      advogado_responsavel_name: agg.advogadoName,
      advogado_responsavel_name_normalized: agg.advogadoNormalized,
      responsible_user_id: responsibleUserId,
      open_processes_count: agg.count,
      sioe_synced_at: syncedAt,
    });

    if (link.clientGroupId) {
      if (resolvedArea) {
        if (!areasByGroup.has(link.clientGroupId)) areasByGroup.set(link.clientGroupId, new Set());
        areasByGroup.get(link.clientGroupId)!.add(resolvedArea);
      }
      if (responsibleUserId) {
        if (!usersByGroup.has(link.clientGroupId)) usersByGroup.set(link.clientGroupId, new Set());
        usersByGroup.get(link.clientGroupId)!.add(responsibleUserId);
      }
    }
    if (link.companyId) {
      if (resolvedArea) {
        if (!areasByCompany.has(link.companyId)) areasByCompany.set(link.companyId, new Set());
        areasByCompany.get(link.companyId)!.add(resolvedArea);
      }
      if (responsibleUserId) {
        if (!usersByCompany.has(link.companyId)) usersByCompany.set(link.companyId, new Set());
        usersByCompany.get(link.companyId)!.add(responsibleUserId);
      }
    }
  }

  if (touchedGroupIds.size > 0) {
    await admin.from("email_group_responsibles").delete().in("client_group_id", Array.from(touchedGroupIds));
  }
  const groupless = rows.filter((r) => !r.client_group_id).map((r) => r.company_id as string).filter(Boolean);
  if (groupless.length > 0) {
    await admin.from("email_group_responsibles").delete().is("client_group_id", null).in("company_id", groupless);
  }

  if (rows.length > 0) {
    const { error } = await admin.from("email_group_responsibles").insert(rows);
    if (error) throw new Error(error.message);
  }

  await Promise.all(
    Array.from(new Set([...areasByGroup.keys(), ...usersByGroup.keys()])).map((groupId) =>
      admin
        .from("email_client_groups")
        .update({
          legal_areas: normalizeLegalAreas(Array.from(areasByGroup.get(groupId) ?? [])),
          responsible_user_ids: Array.from(usersByGroup.get(groupId) ?? []),
        })
        .eq("id", groupId)
    )
  );

  await Promise.all(
    Array.from(new Set([...areasByCompany.keys(), ...usersByCompany.keys()])).map((companyId) =>
      admin
        .from("email_companies")
        .update({
          legal_areas: normalizeLegalAreas(Array.from(areasByCompany.get(companyId) ?? [])),
          responsible_user_ids: Array.from(usersByCompany.get(companyId) ?? []),
        })
        .eq("id", companyId)
    )
  );

  return { responsiblesUpserted: rows.length, unmatchedAdvogados: Array.from(unmatched).sort() };
}

export async function testSioeConnection(): Promise<{
  ok: boolean;
  activeClients?: number;
  withEmail?: number;
  message?: string;
}> {
  try {
    const sioe = getSioeClient();
    const rows = await fetchActiveClients(sioe);
    const withEmail = rows.filter((row) => isValidEmail(row.email)).length;
    return { ok: true, activeClients: rows.length, withEmail };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Erro ao conectar no SIOE.",
    };
  }
}

export async function syncSioeActiveClients(): Promise<SioeSyncResult> {
  const sioe = getSioeClient();
  const admin = getAdminClient();
  const syncedAt = new Date().toISOString();

  const pessoas = await fetchActiveClients(sioe);

  const { data: existingRows } = await admin
    .from("email_contacts")
    .select("email, name, phone, company, company_id, tags, status, custom_fields, source");
  const existingByEmail = new Map(
    (existingRows ?? []).map((row) => [String(row.email).toLowerCase(), row as Record<string, unknown>])
  );

  let groupsUpserted = 0;
  let companiesUpserted = 0;
  let peopleUpserted = 0;
  let contactsUpserted = 0;
  let skippedNoEmail = 0;
  let errors = 0;
  const groupCache = new Map<string, string | null>();
  const seenGroups = new Set<string>();
  const pessoaLinks = new Map<string, PessoaLink>();

  for (const pessoa of pessoas) {
    try {
      const groupName = resolveClientGroupName(pessoa.grupo_cliente);
      if (isInternalClientGroupName(groupName)) continue;

      const clientGroupId = await upsertClientGroup(admin, pessoa.grupo_cliente, syncedAt, groupCache);
      const groupKey = companyNameKey(resolveClientGroupName(pessoa.grupo_cliente) ?? "");
      if (groupKey && clientGroupId && !seenGroups.has(groupKey)) {
        seenGroups.add(groupKey);
        groupsUpserted++;
      }

      const { companyId, companyName } = await upsertCompanyFromSioe(
        admin,
        pessoa,
        syncedAt,
        clientGroupId
      );
      if (companyId) companiesUpserted++;

      const personId = await upsertPersonFromSioe(admin, pessoa, clientGroupId, syncedAt);
      if (personId) peopleUpserted++;

      if (companyId || personId) {
        pessoaLinks.set(pessoa.id, { clientGroupId, companyId, personId });
      }

      const contactUpserted = await upsertContactFromSioe(
        admin,
        pessoa,
        companyId,
        companyName,
        clientGroupId,
        syncedAt,
        existingByEmail
      );
      if (contactUpserted) {
        contactsUpserted++;
      } else if (!isNaturalPerson(pessoa.tipo)) {
        skippedNoEmail++;
      }
    } catch (err) {
      if (process.env.SIOE_SYNC_DEBUG) {
        console.error("sync row error", pessoa.id, err instanceof Error ? err.message : err);
      }
      errors++;
    }
  }

  let responsiblesUpserted = 0;
  let unmatchedAdvogados: string[] = [];
  try {
    const dbLinks = await buildPessoaLinksFromDatabase(admin);
    const mergedLinks = mergePessoaLinks(pessoaLinks, dbLinks);
    const result = await syncResponsibles(sioe, admin, mergedLinks, syncedAt);
    responsiblesUpserted = result.responsiblesUpserted;
    unmatchedAdvogados = result.unmatchedAdvogados;
  } catch (err) {
    if (process.env.SIOE_SYNC_DEBUG) {
      console.error("responsibles sync error", err instanceof Error ? err.message : err);
    }
    errors++;
  }

  return {
    fetched: pessoas.length,
    groupsUpserted,
    companiesUpserted,
    peopleUpserted,
    contactsUpserted,
    skippedNoEmail,
    errors,
    responsiblesUpserted,
    unmatchedAdvogados,
  };
}

/** Sincroniza só processos/responsáveis do SIOE PRO (sem reimportar pessoas/empresas). */
export async function syncSioeResponsiblesOnly(): Promise<{
  responsiblesUpserted: number;
  unmatchedAdvogados: string[];
  pessoaLinks: number;
}> {
  const sioe = getSioeClient();
  const admin = getAdminClient();
  const syncedAt = new Date().toISOString();
  const pessoaLinks = await buildPessoaLinksFromDatabase(admin);
  const result = await syncResponsibles(sioe, admin, pessoaLinks, syncedAt);
  return { ...result, pessoaLinks: pessoaLinks.size };
}

// --- Vínculo manual advogado -> usuário (tela admin "Vincular responsáveis") ---

export interface UnmatchedAdvogado {
  advogadoNameNormalized: string;
  advogadoName: string;
  clientCount: number;
  totalProcesses: number;
}

export interface AdvogadoOverride {
  advogadoNameNormalized: string;
  userId: string;
  userName: string | null;
  updatedAt: string;
}

export async function listUnmatchedAdvogados(): Promise<UnmatchedAdvogado[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("email_group_responsibles")
    .select("advogado_responsavel_name, advogado_responsavel_name_normalized, open_processes_count")
    .is("responsible_user_id", null)
    .not("advogado_responsavel_name_normalized", "is", null);
  if (error) throw new Error(error.message);

  const map = new Map<string, UnmatchedAdvogado>();
  for (const row of data ?? []) {
    const key = row.advogado_responsavel_name_normalized as string;
    const existing = map.get(key);
    if (existing) {
      existing.clientCount++;
      existing.totalProcesses += (row.open_processes_count as number) ?? 0;
      continue;
    }
    map.set(key, {
      advogadoNameNormalized: key,
      advogadoName: (row.advogado_responsavel_name as string) ?? key,
      clientCount: 1,
      totalProcesses: (row.open_processes_count as number) ?? 0,
    });
  }
  return Array.from(map.values()).sort((a, b) => b.clientCount - a.clientCount);
}

export async function listAdvogadoOverrides(): Promise<AdvogadoOverride[]> {
  const admin = getAdminClient();
  const { data, error } = await admin
    .from("email_advogado_user_overrides")
    .select("advogado_name_normalized, user_id, updated_at, users!email_advogado_user_overrides_user_id_fkey(name)")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => {
    const joined = (row as { users?: { name: string } | { name: string }[] | null }).users;
    const userName = Array.isArray(joined) ? (joined[0]?.name ?? null) : (joined?.name ?? null);
    return {
      advogadoNameNormalized: row.advogado_name_normalized as string,
      userId: row.user_id as string,
      userName,
      updatedAt: row.updated_at as string,
    };
  });
}

/**
 * Grava o vínculo manual e reaplica imediatamente para as linhas já existentes
 * de email_group_responsibles (sem precisar rodar um novo sync completo).
 */
export async function saveAdvogadoOverride(
  advogadoNameNormalized: string,
  userId: string,
  updatedByUserId: string | null
): Promise<void> {
  const admin = getAdminClient();
  const { error } = await admin.from("email_advogado_user_overrides").upsert(
    {
      advogado_name_normalized: advogadoNameNormalized,
      user_id: userId,
      updated_at: new Date().toISOString(),
      updated_by: updatedByUserId,
    },
    { onConflict: "advogado_name_normalized" }
  );
  if (error) throw new Error(error.message);

  const { data: affectedRows, error: affectedError } = await admin
    .from("email_group_responsibles")
    .update({ responsible_user_id: userId })
    .eq("advogado_responsavel_name_normalized", advogadoNameNormalized)
    .select("client_group_id, company_id");
  if (affectedError) throw new Error(affectedError.message);

  const groupIds = new Set<string>();
  const companyIds = new Set<string>();
  for (const row of affectedRows ?? []) {
    if (row.client_group_id) groupIds.add(row.client_group_id as string);
    if (row.company_id) companyIds.add(row.company_id as string);
  }

  await Promise.all([
    ...Array.from(groupIds).map((groupId) => recomputeGroupResponsibleIds(admin, groupId)),
    ...Array.from(companyIds).map((companyId) => recomputeCompanyResponsibleIds(admin, companyId)),
  ]);
}

async function recomputeGroupResponsibleIds(
  admin: ReturnType<typeof getAdminClient>,
  groupId: string
): Promise<void> {
  const { data } = await admin
    .from("email_group_responsibles")
    .select("responsible_user_id")
    .eq("client_group_id", groupId)
    .not("responsible_user_id", "is", null);
  const userIds = Array.from(new Set((data ?? []).map((r) => r.responsible_user_id as string)));
  await admin.from("email_client_groups").update({ responsible_user_ids: userIds }).eq("id", groupId);
}

async function recomputeCompanyResponsibleIds(
  admin: ReturnType<typeof getAdminClient>,
  companyId: string
): Promise<void> {
  const { data } = await admin
    .from("email_group_responsibles")
    .select("responsible_user_id")
    .eq("company_id", companyId)
    .not("responsible_user_id", "is", null);
  const userIds = Array.from(new Set((data ?? []).map((r) => r.responsible_user_id as string)));
  await admin.from("email_companies").update({ responsible_user_ids: userIds }).eq("id", companyId);
}
