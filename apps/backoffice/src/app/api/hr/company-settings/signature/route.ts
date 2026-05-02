import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// Reuses the hr-documents bucket (already provisioned + private). Company-
// level assets live under the reserved `_company/` prefix so they can't
// collide with employee UUIDs (UUIDs never start with an underscore).
const BUCKET = "hr-documents";
const COMPANY_PREFIX = "_company";

const supabaseUrl = process.env.NEXT_PUBLIC_LOYALTY_SUPABASE_URL || "";
const supabaseKey = process.env.LOYALTY_SUPABASE_SERVICE_ROLE_KEY || "";

type AnyClient = ReturnType<typeof createClient>;
function storageClient(): AnyClient {
  return createClient(supabaseUrl, supabaseKey);
}

// POST /api/hr/company-settings/signature — upload a transparent PNG of the
// CEO/officer signature. Replaces any previous file. The PDF generator pulls
// from confirmation_signature_path on every confirmation letter.
export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "file is required" }, { status: 400 });

  // Tight allowlist — only PNG so transparency is preserved when stamped on
  // the PDF. JPEGs would paint a white background over the signature line.
  if (file.type !== "image/png") {
    return NextResponse.json({ error: "Signature must be a PNG (transparent background)" }, { status: 400 });
  }
  // Refuse anything bigger than 2 MB — the PDF stays small and the sign
  // endpoint stays fast.
  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.byteLength > 2 * 1024 * 1024) {
    return NextResponse.json({ error: "Signature file too large (max 2 MB)" }, { status: 400 });
  }

  const supabase = storageClient();

  // Find the existing settings row (we need its id to update + we'll prune
  // the previous file to avoid orphaned blobs).
  const { data: settings } = await hrSupabaseAdmin
    .from("hr_company_settings")
    .select("id, confirmation_signature_path")
    .limit(1)
    .maybeSingle();
  if (!settings) {
    return NextResponse.json({ error: "Company settings row not found" }, { status: 404 });
  }

  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${COMPANY_PREFIX}/confirmation-signature-${stamp}.png`;

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(storagePath, buffer, { contentType: "image/png", upsert: false });
  if (upErr) {
    return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });
  }

  const { error: updErr } = await hrSupabaseAdmin
    .from("hr_company_settings")
    .update({ confirmation_signature_path: storagePath, updated_at: new Date().toISOString() })
    .eq("id", settings.id);
  if (updErr) {
    // Roll back the storage upload so we don't leak orphaned blobs on a DB
    // failure. The previous signature path is preserved in the row.
    await supabase.storage.from(BUCKET).remove([storagePath]);
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // Best-effort cleanup of the previous signature.
  if (settings.confirmation_signature_path && settings.confirmation_signature_path !== storagePath) {
    await supabase.storage.from(BUCKET).remove([settings.confirmation_signature_path]).catch(() => {});
  }

  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  return NextResponse.json({ path: storagePath, signed_url: signed?.signedUrl ?? null });
}

// DELETE — clear the signature so confirmation letters fall back to the
// dotted line until a new one is uploaded.
export async function DELETE() {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }

  const { data: settings } = await hrSupabaseAdmin
    .from("hr_company_settings")
    .select("id, confirmation_signature_path")
    .limit(1)
    .maybeSingle();
  if (!settings) {
    return NextResponse.json({ error: "Company settings row not found" }, { status: 404 });
  }

  if (settings.confirmation_signature_path) {
    const supabase = storageClient();
    await supabase.storage.from(BUCKET).remove([settings.confirmation_signature_path]).catch(() => {});
  }
  await hrSupabaseAdmin
    .from("hr_company_settings")
    .update({ confirmation_signature_path: null, updated_at: new Date().toISOString() })
    .eq("id", settings.id);

  return NextResponse.json({ ok: true });
}
