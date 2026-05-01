import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";

// GET: list active LHDN tax-relief catalog entries.
export async function GET() {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data, error } = await hrSupabaseAdmin
    .from("hr_tax_relief_catalog")
    .select("code, name, parent_code, ea_form_field, max_amount, notes, sort_order")
    .eq("is_active", true)
    .order("sort_order")
    .order("name");
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}
