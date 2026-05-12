// POST /api/loyalty/manual-grant — grant a voucher from a template to a
// specific member. Used by support staff for refunds, complaint
// resolutions, makeup gestures, internal rewards.
//
// Body: { brand_id, member_id, template_id, note? }
// Returns: the issued_rewards row.

import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/loyalty/supabase";
import { requireAuth } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.error;

  const body = await request.json();
  const { brand_id, member_id, template_id, note } = body ?? {};
  if (!brand_id || !member_id || !template_id) {
    return NextResponse.json({ error: "brand_id, member_id, template_id required" }, { status: 400 });
  }

  // Load template (need denormalised display + discount fields).
  const { data: tpl } = await supabaseAdmin
    .from("voucher_templates")
    .select(`
      id, title, description, icon, category, validity_days,
      discount_type, discount_value, min_order_value,
      applicable_categories, applicable_products, free_product_name,
      stacks_with_beans
    `)
    .eq("id", template_id)
    .eq("brand_id", brand_id)
    .eq("is_active", true)
    .single();

  if (!tpl) return NextResponse.json({ error: "Template not found or inactive" }, { status: 404 });

  const expiresAt = tpl.validity_days
    ? new Date(Date.now() + (tpl.validity_days as number) * 24 * 60 * 60 * 1000).toISOString()
    : null;

  const { data, error } = await supabaseAdmin
    .from("issued_rewards")
    .insert({
      brand_id,
      member_id,
      voucher_template_id: tpl.id,
      source_type: "manual",
      source_ref_id: auth.user?.id ?? null,    // who granted it
      title:                 tpl.title,
      description:           note ? `${tpl.description} — ${note}` : tpl.description,
      icon:                  tpl.icon,
      category:              tpl.category,
      discount_type:         tpl.discount_type,
      discount_value:        tpl.discount_value,
      min_order_value:       tpl.min_order_value,
      applicable_categories: tpl.applicable_categories,
      applicable_products:   tpl.applicable_products,
      free_product_name:     tpl.free_product_name,
      stacks_with_beans:     tpl.stacks_with_beans ?? true,
      status: "active",
      issued_at: new Date().toISOString(),
      expires_at: expiresAt,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
