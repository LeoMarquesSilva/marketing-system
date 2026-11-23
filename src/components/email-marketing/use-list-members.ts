"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/utils/supabase/client";

const PAGE = 1000;

/** Contatos de cada lista (list_id → contact_ids), lidos em páginas para não parar nos 1.000 do Supabase. */
export function useListMembers(listIds: string[]) {
  const [members, setMembers] = useState<Map<string, string[]> | null>(null);
  const key = listIds.slice().sort().join(",");

  const load = useCallback(async (ids: string[]) => {
    const map = new Map<string, string[]>(ids.map((id) => [id, []]));
    if (!ids.length) return map;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await supabase
        .from("email_list_contacts")
        .select("list_id, contact_id")
        .in("list_id", ids)
        .order("list_id")
        .order("contact_id")
        .range(from, from + PAGE - 1);
      if (error) throw error;
      for (const row of (data ?? []) as { list_id: string; contact_id: string }[]) map.get(row.list_id)?.push(row.contact_id);
      if (!data || data.length < PAGE) break;
    }
    return map;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const ids = key ? key.split(",") : [];
    load(ids)
      .then((map) => !cancelled && setMembers(map))
      .catch(() => !cancelled && setMembers(new Map()));
    return () => {
      cancelled = true;
    };
  }, [key, load]);

  const reload = useCallback(async () => {
    setMembers(await load(key ? key.split(",") : []).catch(() => new Map()));
  }, [key, load]);

  return { members, reload };
}
