import { createClient } from "@/utils/supabase/server";
import {
  getAllowedLegalAreas,
  isContentManager,
  type ContentAccessProfile,
} from "@/lib/content-areas";

export interface UserContentAccess extends ContentAccessProfile {
  id: string;
  name: string;
  email: string | null;
}

export async function getAuthenticatedContentUser(): Promise<{
  authId: string;
  profile: UserContentAccess | null;
} | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("users")
    .select("id, name, email, department, role")
    .eq("auth_id", user.id)
    .maybeSingle();

  return {
    authId: user.id,
    profile: profile as UserContentAccess | null,
  };
}

export function resolveAreaFilter(
  profile: UserContentAccess | null,
  requestedArea?: string
): { areas: string[] | null; area?: string; denied?: boolean } {
  const allowed = getAllowedLegalAreas(profile);

  if (allowed === null) {
    return { areas: null, area: requestedArea };
  }

  if (allowed.length === 0) {
    return { areas: [] };
  }

  if (requestedArea) {
    if (!allowed.includes(requestedArea as (typeof allowed)[number])) {
      return { areas: allowed, denied: true };
    }
    return { areas: allowed, area: requestedArea };
  }

  return { areas: allowed };
}

export { isContentManager, getAllowedLegalAreas };
