import { NextResponse } from "next/server";
import { requireProfessionalProfileAdmin } from "@/lib/profiles/auth";
import { listProfessionalProfiles, toProfileApiError } from "@/lib/profiles/admin";
import type { ProfessionalProfileListFilters } from "@/lib/profiles/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireProfessionalProfileAdmin();

    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const completeness = url.searchParams.get("completeness");

    const filters: ProfessionalProfileListFilters = {
      status:
        status === "draft" || status === "published" || status === "archived" ? status : "all",
      completeness:
        completeness === "complete" || completeness === "incomplete" ? completeness : "all",
      search: url.searchParams.get("search") ?? undefined,
    };

    return NextResponse.json(await listProfessionalProfiles(filters));
  } catch (error) {
    const apiError = toProfileApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
