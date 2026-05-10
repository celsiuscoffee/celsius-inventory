import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/server";

// POST /api/loyalty/push/deregister
// Body: { token }
//
// Removes the row for an Expo push token so a signed-out device stops
// receiving order-status pushes scoped to the previous customer's
// phone. Idempotent — missing rows are not an error.
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as { token?: string };
    if (!body.token || !body.token.startsWith("ExponentPushToken[")) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase
      .from("expo_push_tokens")
      .delete()
      .eq("token", body.token);

    if (error) {
      console.error("expo push deregister error:", error);
      return NextResponse.json({ error: "Failed to deregister" }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("push deregister route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
