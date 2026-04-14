import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/pickup/supabase";
import { requireRole } from "@/lib/auth";

// POST — save Bukku credentials for an outlet
export async function POST(req: NextRequest, { params }: { params: Promise<{ storeId: string }> }) {
  try { await requireRole(req.headers, "ADMIN"); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { storeId } = await params;
  const { token, subdomain } = await req.json();

  const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (token !== undefined) update.bukkuToken = token;
  if (subdomain !== undefined) update.bukkuSubdomain = subdomain;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from("Outlet")
    .update(update)
    .eq("pickupStoreId", storeId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
