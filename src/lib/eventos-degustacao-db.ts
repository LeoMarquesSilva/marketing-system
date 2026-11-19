/** Degustação de drinks no banco: drinks provados (com foto), notas e participantes. Mesmo cliente das telas de Eventos. */
import { supabase } from "@/utils/supabase/client";
import { parseParticipants, type EventTasting, type TastingParticipant, type TastingStatus } from "@/lib/eventos-programa";
import { isScore, participantKey, type Score, type TastingDrink, type TastingVote } from "@/lib/eventos-degustacao";
import { EVENT_FILES_BUCKET, publicStorageObjectUrl, removeFromBucket, sanitizeFileName } from "@/lib/storage-buckets";
import { resolveEmployeeAvatarUrl } from "@/lib/ferias/filters";

type Row = Record<string, unknown>;

function toTasting(row: Row): EventTasting {
  const status = row.status as TastingStatus;
  return {
    id: String(row.id),
    eventId: String(row.event_id),
    menuType: row.menu_type === "bebida" ? "bebida" : "comida",
    vendorName: String(row.vendor_name),
    tastingDate: (row.tasting_date as string | null) ?? null,
    tastingTime: (row.tasting_time as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    linkUrl: (row.link_url as string | null) ?? null,
    status: status === "realizada" || status === "cancelada" ? status : "agendada",
    resultNote: (row.result_note as string | null) ?? null,
    participants: parseParticipants(row.participants),
    sortOrder: Number(row.sort_order ?? 0),
  };
}

function toDrink(row: Row): TastingDrink {
  return {
    id: String(row.id),
    tastingId: String(row.tasting_id),
    eventId: String(row.event_id),
    name: String(row.name),
    photoPath: (row.photo_path as string | null) ?? null,
    photoUrl: (row.photo_url as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    shortlisted: Boolean(row.shortlisted),
    menuItemId: (row.menu_item_id as string | null) ?? null,
    sortOrder: Number(row.sort_order ?? 0),
    createdAt: String(row.created_at ?? ""),
    isVolante: Boolean(row.is_volante),
    included: Boolean(row.included),
    chosenAt: (row.chosen_at as string | null) ?? null,
    chosenBy: (row.chosen_by as string | null) ?? null,
  };
}

/** O que a proposta mostra de cada degustação além do cadastro: pontos fortes e quantos drinks entram à escolha. */
export interface TastingExtras {
  highlights: string[];
  choiceLimit: number | null;
}

function toExtras(row: Row): TastingExtras {
  const list = Array.isArray(row.highlights) ? row.highlights : [];
  const limit = Number(row.choice_limit);
  return {
    highlights: list.filter((item): item is string => typeof item === "string" && item.trim().length > 0),
    choiceLimit: Number.isInteger(limit) && limit > 0 ? limit : null,
  };
}

function toVote(row: Row): TastingVote | null {
  const score = Number(row.score);
  if (!isScore(score)) return null;
  return {
    id: String(row.id),
    drinkId: String(row.drink_id),
    tastingId: String(row.tasting_id),
    participantKey: String(row.participant_key),
    participantName: String(row.participant_name),
    userId: (row.user_id as string | null) ?? null,
    score,
    recordedBy: (row.recorded_by as string | null) ?? null,
  };
}

export interface TastingFace {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface DrinkTastingData {
  eventName: string | null;
  /** Todas as degustações de drinks do evento (a aberta e as anteriores). */
  tastings: EventTasting[];
  drinks: TastingDrink[];
  votes: TastingVote[];
  faces: Record<string, TastingFace>;
  /** Por id da degustação. */
  extras: Record<string, TastingExtras>;
}

/** Degustações de drinks do evento, com drinks, notas e fotos das pessoas. */
export async function fetchDrinkTastings(eventId: string): Promise<DrinkTastingData> {
  const [event, tastings, drinks] = await Promise.all([
    supabase.from("events").select("name").eq("id", eventId).maybeSingle(),
    supabase.from("event_tastings").select("*").eq("event_id", eventId).eq("menu_type", "bebida").neq("status", "cancelada").order("tasting_date"),
    supabase.from("event_tasting_drinks").select("*").eq("event_id", eventId).order("sort_order").order("created_at"),
  ]);
  if (tastings.error) throw new Error("Não foi possível carregar as degustações.");
  if (drinks.error) throw new Error("Não foi possível carregar os drinks.");
  const tastingList = (tastings.data ?? []).map((row) => toTasting(row as Row));
  const extras: Record<string, TastingExtras> = {};
  for (const row of (tastings.data ?? []) as Row[]) extras[String(row.id)] = toExtras(row);
  const drinkList = (drinks.data ?? []).map((row) => toDrink(row as Row));
  const ids = tastingList.map((tasting) => tasting.id);
  const votes = ids.length > 0 ? await supabase.from("event_tasting_votes").select("*").in("tasting_id", ids) : { data: [], error: null };
  if (votes.error) throw new Error("Não foi possível carregar as notas.");

  // Rostos de quem participou e de quem escolheu na proposta.
  const userIds = [
    ...new Set(
      [...tastingList.flatMap((tasting) => tasting.participants.map((person) => person.userId)), ...drinkList.map((drink) => drink.chosenBy)].filter(
        (id): id is string => Boolean(id)
      )
    ),
  ];
  const faces: Record<string, TastingFace> = {};
  if (userIds.length > 0) {
    const { data } = await supabase.from("users").select("id, name, avatar_url, photo_onedrive_url").in("id", userIds);
    for (const row of (data ?? []) as Row[]) {
      faces[String(row.id)] = {
        id: String(row.id),
        name: String(row.name ?? ""),
        avatarUrl: resolveEmployeeAvatarUrl(row.avatar_url as string | null, (row.photo_onedrive_url as string | null) ?? null),
      };
    }
  }

  return {
    eventName: (event.data?.name as string | undefined) ?? null,
    tastings: tastingList,
    drinks: drinkList,
    votes: (votes.data ?? []).map((row) => toVote(row as Row)).filter((vote): vote is TastingVote => vote !== null),
    faces,
    extras,
  };
}

/** Marca ou desmarca o drink como escolhido para a festa (página de proposta). */
export async function setDrinkChosen(drinkId: string, chosen: boolean, by: string | null): Promise<TastingDrink> {
  const { data, error } = await supabase
    .from("event_tasting_drinks")
    .update({ chosen_at: chosen ? new Date().toISOString() : null, chosen_by: chosen ? by : null, updated_at: new Date().toISOString() })
    .eq("id", drinkId)
    .select("*")
    .single();
  if (error || !data) throw new Error("A escolha não foi salva. Confira a internet e toque de novo.");
  return toDrink(data as Row);
}

/** Evento de uma degustação (a página do celular abre pela degustação). */
export async function fetchTastingEventId(tastingId: string): Promise<string | null> {
  const { data, error } = await supabase.from("event_tastings").select("event_id").eq("id", tastingId).maybeSingle();
  if (error) throw new Error("Não foi possível abrir a degustação.");
  return (data?.event_id as string | undefined) ?? null;
}

export interface DrinkTastingSummary {
  id: string;
  eventId: string;
  eventName: string | null;
  vendorName: string;
  tastingDate: string | null;
  tastingTime: string | null;
  status: TastingStatus;
  participants: number;
}

/** Degustações de drinks de todos os eventos, a mais recente primeiro (lista de /degustacao). */
export async function fetchDrinkTastingList(): Promise<DrinkTastingSummary[]> {
  const { data, error } = await supabase
    .from("event_tastings")
    .select("id, event_id, vendor_name, tasting_date, tasting_time, status, participants, events(name)")
    .eq("menu_type", "bebida")
    .neq("status", "cancelada")
    .order("tasting_date", { ascending: false });
  if (error) throw new Error("Não foi possível carregar as degustações.");
  return ((data ?? []) as Row[]).map((row) => {
    const event = row.events as { name?: string } | { name?: string }[] | null;
    const eventName = Array.isArray(event) ? event[0]?.name : event?.name;
    return {
      id: String(row.id),
      eventId: String(row.event_id),
      eventName: eventName ?? null,
      vendorName: String(row.vendor_name),
      tastingDate: (row.tasting_date as string | null) ?? null,
      tastingTime: (row.tasting_time as string | null) ?? null,
      status: (row.status as TastingStatus) ?? "agendada",
      participants: parseParticipants(row.participants).length,
    };
  });
}

/** Grava (ou troca) a nota de um participante. */
export async function saveVote(input: {
  drink: TastingDrink;
  person: TastingParticipant;
  score: Score;
  recordedBy: string | null;
}): Promise<TastingVote> {
  const { data, error } = await supabase
    .from("event_tasting_votes")
    .upsert(
      {
        drink_id: input.drink.id,
        tasting_id: input.drink.tastingId,
        participant_key: participantKey(input.person),
        participant_name: input.person.name,
        user_id: input.person.userId,
        score: input.score,
        recorded_by: input.recordedBy,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "drink_id,participant_key" }
    )
    .select("*")
    .single();
  const vote = data ? toVote(data as Row) : null;
  if (error || !vote) throw new Error("A nota não foi salva. Confira a internet e toque de novo.");
  return vote;
}

export async function deleteVote(drinkId: string, key: string): Promise<void> {
  const { error } = await supabase.from("event_tasting_votes").delete().eq("drink_id", drinkId).eq("participant_key", key);
  if (error) throw new Error("Não foi possível apagar a nota.");
}

/** Sobe a foto já reduzida para eventos/<evento>/degustacoes/<degustação>/. */
export async function uploadDrinkPhoto(eventId: string, tastingId: string, drinkName: string, blob: Blob): Promise<{ path: string; url: string }> {
  const extension = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
  const path = `eventos/${eventId}/degustacoes/${tastingId}/${Date.now()}-${sanitizeFileName(`${drinkName || "drink"}.${extension}`)}`;
  const { error } = await supabase.storage.from(EVENT_FILES_BUCKET).upload(path, blob, { contentType: blob.type || "image/jpeg", upsert: false });
  if (error) throw new Error("A foto não subiu. Confira a internet e tente de novo.");
  const url = publicStorageObjectUrl(EVENT_FILES_BUCKET, path);
  if (!url) throw new Error("Não foi possível montar o endereço da foto.");
  return { path, url };
}

export interface DrinkInput {
  name: string;
  note: string | null;
  shortlisted: boolean;
  photoPath: string | null;
  photoUrl: string | null;
}

export async function createDrink(tasting: Pick<EventTasting, "id" | "eventId">, input: DrinkInput, createdBy: string | null, sortOrder: number): Promise<TastingDrink> {
  const { data, error } = await supabase
    .from("event_tasting_drinks")
    .insert({
      tasting_id: tasting.id,
      event_id: tasting.eventId,
      name: input.name.trim(),
      note: input.note,
      shortlisted: input.shortlisted,
      photo_path: input.photoPath,
      photo_url: input.photoUrl,
      sort_order: sortOrder,
      created_by: createdBy,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error("O drink não foi salvo. Tente de novo.");
  return toDrink(data as Row);
}

export async function updateDrink(drink: TastingDrink, input: DrinkInput): Promise<TastingDrink> {
  const { data, error } = await supabase
    .from("event_tasting_drinks")
    .update({
      name: input.name.trim(),
      note: input.note,
      shortlisted: input.shortlisted,
      photo_path: input.photoPath,
      photo_url: input.photoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", drink.id)
    .select("*")
    .single();
  if (error || !data) throw new Error("As mudanças não foram salvas. Tente de novo.");
  if (drink.photoPath && drink.photoPath !== input.photoPath) await removeFromBucket(EVENT_FILES_BUCKET, drink.photoPath);
  return toDrink(data as Row);
}

export async function deleteDrink(drink: TastingDrink): Promise<void> {
  const { error } = await supabase.from("event_tasting_drinks").delete().eq("id", drink.id);
  if (error) throw new Error("Não foi possível apagar o drink.");
  if (drink.photoPath) await removeFromBucket(EVENT_FILES_BUCKET, drink.photoPath);
}

/** Troca a lista de quem participa (entrar na lista, incluir convidado). Relê antes para não apagar quem outro celular incluiu. */
export async function updateParticipants(
  tastingId: string,
  change: (current: TastingParticipant[]) => TastingParticipant[]
): Promise<TastingParticipant[]> {
  const { data: current, error: readError } = await supabase.from("event_tastings").select("participants").eq("id", tastingId).single();
  if (readError) throw new Error("Não foi possível ler a lista de participantes.");
  const next = change(parseParticipants(current?.participants));
  const { error } = await supabase.from("event_tastings").update({ participants: next, updated_at: new Date().toISOString() }).eq("id", tastingId);
  if (error) throw new Error("Não foi possível atualizar a lista de participantes.");
  return next;
}

/** Leva o drink aprovado ao cardápio do evento (bebida), quando o organizador decidir. */
export async function approveDrinkToMenu(drink: TastingDrink, vendorName: string, sortOrder: number): Promise<string> {
  const { data, error } = await supabase
    .from("event_menu_items")
    .insert({
      event_id: drink.eventId,
      menu_type: "bebida",
      section: "Drinks",
      name: drink.name,
      note: null,
      highlight: false,
      status: "aprovado",
      vendor_name: vendorName,
      sort_order: sortOrder,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("Não foi possível levar o drink ao cardápio.");
  const menuItemId = String((data as Row).id);
  const linked = await supabase.from("event_tasting_drinks").update({ menu_item_id: menuItemId, updated_at: new Date().toISOString() }).eq("id", drink.id);
  if (linked.error) console.error("Erro ao ligar drink ao cardápio:", linked.error);
  return menuItemId;
}
