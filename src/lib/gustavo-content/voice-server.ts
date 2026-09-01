import { GustavoContentError } from "@/lib/gustavo-content/errors";
import { getGustavoContentAdmin } from "@/lib/gustavo-content/server";
import {
  validateVoiceInput,
  type GustavoVoiceSample,
  type VoiceInput,
} from "@/lib/gustavo-content/voice";

const VOICE_SELECT =
  "id, source_type, source_url, published_at, original_text, content_type, tone, analysis, performance, authenticity, is_active, created_by, created_at, updated_at";

export async function listVoiceSamples(): Promise<GustavoVoiceSample[]> {
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_voice_samples")
    .select(VOICE_SELECT)
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (error) throw new GustavoContentError(error.message, 500);
  return (data ?? []) as GustavoVoiceSample[];
}

export async function listActiveVoice(): Promise<GustavoVoiceSample[]> {
  const samples = await listVoiceSamples();
  return samples.filter((sample) => sample.is_active);
}

export async function createVoiceSample(
  input: VoiceInput,
  actorId: string
): Promise<GustavoVoiceSample> {
  const parsed = validateVoiceInput(input);
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_voice_samples")
    .insert({ ...parsed, created_by: actorId })
    .select(VOICE_SELECT)
    .single();
  if (error || !data) {
    throw new GustavoContentError(error?.message ?? "Não foi possível salvar a amostra.", 500);
  }
  return data as GustavoVoiceSample;
}

export async function updateVoiceSample(
  id: string,
  input: VoiceInput
): Promise<GustavoVoiceSample> {
  if (!id) throw new GustavoContentError("id é obrigatório.", 400);
  const parsed = validateVoiceInput(input);
  const admin = getGustavoContentAdmin();
  const { data, error } = await admin
    .from("gustavo_content_voice_samples")
    .update(parsed)
    .eq("id", id)
    .select(VOICE_SELECT)
    .maybeSingle();
  if (error) throw new GustavoContentError(error.message, 500);
  if (!data) throw new GustavoContentError("Amostra não encontrada.", 404);
  return data as GustavoVoiceSample;
}

export async function deleteVoiceSample(id: string): Promise<void> {
  if (!id) throw new GustavoContentError("id é obrigatório.", 400);
  const admin = getGustavoContentAdmin();
  const { error } = await admin.from("gustavo_content_voice_samples").delete().eq("id", id);
  if (error) throw new GustavoContentError(error.message, 500);
}
