import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
dotenv.config({ path: path.join(root, '.env.local'), quiet: true });
dotenv.config({ path: path.join(root, '.env'), quiet: true });
const python = process.env.CONTENT_SCHEDULE_PYTHON;
if (!python) throw new Error('Defina CONTENT_SCHEDULE_PYTHON com o runtime Python que contém openpyxl.');
const workbook = path.join(root, 'Cronograma Marketing BP 2026.xlsx');
const extraction = spawnSync(python, [path.join(root, 'scripts/read-content-schedule.py'), workbook], { encoding: 'utf8', maxBuffer: 5 * 1024 * 1024 });
if (extraction.status !== 0) throw new Error(extraction.stderr || 'Não foi possível ler a planilha.');
const rows = JSON.parse(extraction.stdout);
if (!rows.length) throw new Error('Nenhuma vaga de 2026 encontrada.');

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: users, error } = await db.from('users').select('id,name,department,is_active').order('name');
if (error) throw new Error(error.message);
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const area = (v) => ({ 'insolvencia': 'Reestruturação', 'reestruturacao': 'Reestruturação', 'legal ops': 'Operações Legais', 'operacoes legais': 'Operações Legais', 'contratos': 'Societário e Contratos', 'societario e contratos': 'Societário e Contratos', 'distressed deals': 'Special Situations', 'distressed deals special situations': 'Special Situations' }[norm(v)] ?? v);
// Partial names must retain their word order and match one active person in the source area.
// One-letter initials and single first names stay unresolved, even when only one candidate exists.
const tokens = (v) => norm(v).split(' ').filter((x) => !['de','da','do','das','dos','e'].includes(x));
const matchName = (name, sourceArea) => {
  const candidates = users.filter((u) => u.is_active !== false && area(u.department) === sourceArea);
  const exact = candidates.filter((u) => norm(u.name) === norm(name));
  if (exact.length === 1) return exact[0];
  const parts = tokens(name);
  if (parts.length < 2 || parts.some((p) => p.length < 2) || /definir|novo|n a/.test(norm(name))) return null;
  const matched = candidates.filter((u) => {
    const full = tokens(u.name);
    if (full[0] !== parts[0]) return false;
    let cursor = 0;
    return parts.every((part) => { const at = full.indexOf(part, cursor); cursor = at + 1; return at >= 0; });
  });
  return matched.length === 1 ? matched[0] : null;
};
const prepared = rows.map((r) => {
  const canonicalArea = area(r.sheet);
  const person = matchName(r.name, canonicalArea);
  return { area: canonicalArea, due_date: r.date, format: r.format, collaborator_id: person?.id ?? null, source_key: `cronograma-bp-2026:${r.sheet}:${r.row}`, source_name: r.name || null, source_status: r.status || null, source_notes: `${r.sheet}, linha ${r.row}. Tema original: ${r.theme || '—'}. Tarefa VIOS agendada: ${r.scheduled || '—'}.`, cancelled: norm(r.theme).includes('cancelad') || norm(r.status).includes('cancelad') };
});
const summary = { total: prepared.length, linked: prepared.filter((r) => r.collaborator_id).length, pending: prepared.filter((r) => !r.collaborator_id).length, cancelled: prepared.filter((r) => r.cancelled).length, byArea: Object.fromEntries([...new Set(prepared.map((r) => r.area))].map((key) => [key, prepared.filter((r) => r.area === key).length])), pendingNames: [...new Set(prepared.filter((r) => !r.collaborator_id).map((r) => `${r.area}: ${r.source_name}`))] };
if (process.argv.includes('--apply')) {
  const { error: writeError } = await db.from('content_schedule_slots').upsert(prepared, { onConflict: 'source_key', ignoreDuplicates: true });
  if (writeError) throw new Error(writeError.message);
  const { data: saved, error: checkError } = await db.from('content_schedule_slots').select('source_key,collaborator_id').in('source_key', prepared.map((r) => r.source_key));
  if (checkError || saved.length !== prepared.length) throw new Error('Falha ao conferir todas as vagas importadas.');
  summary.verified = saved.length;
  summary.savedLinked = saved.filter((r) => r.collaborator_id).length;
}
console.log(JSON.stringify({ mode: process.argv.includes('--apply') ? 'apply' : 'preview', ...summary }, null, 2));
