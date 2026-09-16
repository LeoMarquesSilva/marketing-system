import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{1,80}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ campaign: string; channel: string }> }
) {
  const { campaign, channel } = await params;
  if (!SAFE_SLUG.test(campaign) || !SAFE_SLUG.test(channel)) {
    return new NextResponse("Link não encontrado.", { status: 404 });
  }

  const supabase = await createClient();
  const { data: destination, error } = await supabase.rpc(
    "record_event_tracking_click",
    {
      p_campaign_slug: campaign,
      p_channel: channel,
      p_referrer: request.headers.get("referer"),
      p_user_agent: request.headers.get("user-agent"),
    }
  );

  if (error || typeof destination !== "string" || !destination.startsWith("https://")) {
    return new NextResponse("Link não encontrado.", { status: 404 });
  }

  const response = NextResponse.redirect(destination, 307);
  response.headers.set("Cache-Control", "no-store");
  response.headers.set("X-Robots-Tag", "noindex, nofollow");
  return response;
}
