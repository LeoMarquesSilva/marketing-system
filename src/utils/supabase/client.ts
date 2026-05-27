import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    lock: async <R>(
      _name: string,
      _acquireTimeout: number,
      fn: () => Promise<R>
    ): Promise<R> => fn(),
  },
});
