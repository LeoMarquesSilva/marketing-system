import { NextResponse } from "next/server";
import { toRhApiError } from "@/lib/rh/qualifications/server";
import { createRegistrationForm, listRegistrationForms } from "@/lib/rh/registration/server";

export async function GET() {
  try {
    const items = await listRegistrationForms();
    return NextResponse.json({ items });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const form = await createRegistrationForm({
      kind: body.kind,
      inviteeName: body.inviteeName,
      personalEmail: body.personalEmail,
      phone: body.phone,
      expectedAdmissionDate: body.expectedAdmissionDate,
    });
    return NextResponse.json({ form }, { status: 201 });
  } catch (error) {
    const apiError = toRhApiError(error);
    return NextResponse.json(apiError.body, { status: apiError.status });
  }
}
