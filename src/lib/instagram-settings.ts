import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const MONTHLY_GOAL_KEY = "instagram_monthly_goal";
export const DEFAULT_MONTHLY_GOAL = 12;

function getServiceClient() {
  if (!supabaseServiceKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada.");
  }
  return createClient(supabaseUrl, supabaseServiceKey);
}

export async function fetchInstagramMonthlyGoal(): Promise<number> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", MONTHLY_GOAL_KEY)
      .maybeSingle();

    if (error || !data) return DEFAULT_MONTHLY_GOAL;
    const n = Number(data.value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_MONTHLY_GOAL;
  } catch {
    return DEFAULT_MONTHLY_GOAL;
  }
}

export async function updateInstagramMonthlyGoal(goal: number): Promise<void> {
  const safe = Math.max(1, Math.floor(Number.isFinite(goal) ? goal : DEFAULT_MONTHLY_GOAL));
  const supabase = getServiceClient();
  const { error } = await supabase
    .from("app_settings")
    .upsert(
      { key: MONTHLY_GOAL_KEY, value: safe, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  if (error) throw new Error(error.message);
}
