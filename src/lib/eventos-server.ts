import { createClient } from "@/utils/supabase/server";
import {
  fetchAvailableYears,
  fetchEventAttachments,
  fetchEventById,
  fetchEventBudgetItems,
  fetchEventCommunications,
  fetchEventHistory,
  fetchEventInvites,
  fetchEventPostmortem,
  fetchEventSupplierLinks,
  fetchEventTemplates,
  fetchEventsOverview,
  fetchEventsWithStats,
  fetchSuppliersCatalog,
  fetchSuppliersCatalogWithStats,
  fetchSupplierQuotes,
  fetchEventTasks,
} from "@/lib/eventos";

export async function fetchEventosPageData(year: number) {
  const supabase = await createClient();
  const [years, events, overview] = await Promise.all([
    fetchAvailableYears(supabase),
    fetchEventsWithStats(year, supabase),
    fetchEventsOverview(year, supabase),
  ]);
  return { years, events, overview, year };
}

export async function fetchPrestadoresPageData() {
  const supabase = await createClient();
  const suppliers = await fetchSuppliersCatalogWithStats(supabase);
  return { suppliers };
}

export async function fetchEventoDetailData(id: string) {
  const supabase = await createClient();
  const [
    event,
    tasks,
    budgetItems,
    linkedSuppliers,
    catalogSuppliers,
    quotes,
    invites,
    communications,
    attachments,
    postmortem,
    history,
    templates,
  ] = await Promise.all([
    fetchEventById(id, supabase),
    fetchEventTasks(id, supabase),
    fetchEventBudgetItems(id, supabase),
    fetchEventSupplierLinks(id, supabase),
    fetchSuppliersCatalog(supabase),
    fetchSupplierQuotes(id, supabase),
    fetchEventInvites(id, supabase),
    fetchEventCommunications(id, supabase),
    fetchEventAttachments(id, supabase),
    fetchEventPostmortem(id, supabase),
    fetchEventHistory(id, supabase),
    fetchEventTemplates(supabase),
  ]);
  return {
    event,
    tasks,
    budgetItems,
    linkedSuppliers,
    catalogSuppliers,
    quotes,
    invites,
    communications,
    attachments,
    postmortem,
    history,
    templates,
  };
}
