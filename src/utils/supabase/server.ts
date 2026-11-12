import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { comUsuarioPeloToken } from "./usuario-da-sessao";

export async function createClient() {
  const cookieStore = await cookies();
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "https://placeholder.supabase.co";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "placeholder-anon-key";

  // `auth.getUser()` valida o token localmente, sem ir ao Supabase Auth (CPU na Vercel): ver usuario-da-sessao.ts.
  return comUsuarioPeloToken(
    createServerClient(
      url,
      key,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options?: object }[]) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Ignored if called from Server Component
            }
          },
        },
      }
    ),
    url
  );
}
