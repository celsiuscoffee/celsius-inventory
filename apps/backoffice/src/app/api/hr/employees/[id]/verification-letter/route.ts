import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getSession } from "@/lib/auth";
import { hrSupabaseAdmin } from "@/lib/hr/supabase";
import { prisma } from "@/lib/prisma";
import {
  generateVerificationLetterPDF,
  type VerificationLetterData,
  type VerificationLetterFormat,
} from "@/lib/hr/statutory/verification-letter";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const BUCKET = "hr-documents";
const supabaseUrl = process.env.NEXT_PUBLIC_LOYALTY_SUPABASE_URL || "";
const supabaseKey = process.env.LOYALTY_SUPABASE_SERVICE_ROLE_KEY || "";

type AnyClient = ReturnType<typeof createClient>;
function storageClient(): AnyClient {
  return createClient(supabaseUrl, supabaseKey);
}

const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
};

// Build the data payload. Loaded by both GET (preview) and POST (sign+file).
async function loadLetterData(
  userId: string,
  format: VerificationLetterFormat,
  recipient: string | null,
  recipientAddress: string | null,
  purpose: string | null,
  withSignature: boolean,
): Promise<
  | { ok: true; data: VerificationLetterData; employeeName: string }
  | { ok: false; status: number; error: string }
> {
  const [user, profileRes, companyRes] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, fullName: true, status: true } }),
    hrSupabaseAdmin.from("hr_employee_profiles").select("*").eq("user_id", userId).single(),
    hrSupabaseAdmin.from("hr_company_settings").select("*").limit(1).maybeSingle(),
  ]);
  if (!user) return { ok: false, status: 404, error: "User not found" };
  if (user.status !== "ACTIVE") {
    return { ok: false, status: 409, error: "Cannot issue verification for a non-active employee" };
  }
  const profile = profileRes.data as {
    ic_number?: string | null; position?: string | null; join_date?: string | null;
    basic_salary?: number | string | null; employment_type?: string | null;
  } | null;
  if (!profile) return { ok: false, status: 404, error: "HR profile not found" };
  if (!profile.join_date) return { ok: false, status: 400, error: "Cannot issue without a join_date" };

  const company = companyRes.data as {
    company_name?: string; ssm_number?: string | null;
    address_line1?: string | null; address_line2?: string | null;
    postcode?: string | null; city?: string | null; country?: string | null;
    confirmation_signatory_name?: string | null; confirmation_signatory_title?: string | null;
    confirmation_signature_path?: string | null;
    officer_name?: string | null; officer_position?: string | null;
    officer_email?: string | null; phone?: string | null;
  } | null;

  // Last 3 months gross — only computed for income_proof to keep the page
  // honest about the headers it shows.
  let last3MonthsGross: number | null = null;
  if (format === "income_proof") {
    const today = new Date();
    const cutoff = new Date(today.getFullYear(), today.getMonth() - 3, 1).toISOString().slice(0, 10);
    const { data: items } = await hrSupabaseAdmin
      .from("hr_payroll_items")
      .select("payroll_run_id, gross_pay, hr_payroll_runs!inner(period_start, status)")
      .eq("user_id", userId)
      .gte("hr_payroll_runs.period_start", cutoff)
      .in("hr_payroll_runs.status", ["confirmed", "paid"]);
    if (items && items.length > 0) {
      last3MonthsGross = items.reduce((s, i: { gross_pay?: number | string }) => s + Number(i.gross_pay || 0), 0);
    }
  }

  // Fetch signature bytes from storage when caller is signing.
  let signatureImageBytes: Uint8Array | null = null;
  if (withSignature && company?.confirmation_signature_path && supabaseUrl && supabaseKey) {
    try {
      const supa = storageClient();
      const { data: dl } = await supa.storage.from(BUCKET).download(company.confirmation_signature_path);
      if (dl) signatureImageBytes = new Uint8Array(await dl.arrayBuffer());
    } catch { /* ignore */ }
  }

  const empType = profile.employment_type || "full_time";
  const employeeFullName = user.fullName || user.name;
  const today = new Date().toISOString().slice(0, 10);
  const addressParts = [
    company?.address_line1,
    company?.address_line2,
    [company?.postcode, company?.city].filter(Boolean).join(" "),
    company?.country,
  ].filter(Boolean) as string[];

  return {
    ok: true,
    employeeName: employeeFullName,
    data: {
      employeeFullName,
      icNumber: profile.ic_number || null,
      position: profile.position || "Staff",
      joinDate: profile.join_date,
      employmentType: EMPLOYMENT_TYPE_LABELS[empType] || empType,
      basicSalary: profile.basic_salary != null ? Number(profile.basic_salary) : null,
      last3MonthsGross,
      recipient,
      recipientAddress,
      purpose,
      format,
      letterDate: today,
      companyName: company?.company_name || "Celsius Coffee Sdn. Bhd.",
      companySSM: company?.ssm_number || null,
      companyAddress: addressParts.join(", ") || null,
      companyEmail: company?.officer_email || null,
      companyPhone: company?.phone || null,
      signatoryName: company?.confirmation_signatory_name || company?.officer_name || "HR Department",
      signatoryTitle: company?.confirmation_signatory_title || company?.officer_position || "Director",
      signatureImageBytes,
    },
  };
}

// GET — preview download (unsigned). Useful for HR to spot-check before
// committing to the document vault.
//   ?format=standard|with_salary|income_proof&recipient=...&purpose=...
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const sp = new URL(req.url).searchParams;
  const format = (sp.get("format") || "standard") as VerificationLetterFormat;
  if (!["standard", "with_salary", "income_proof"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  const result = await loadLetterData(
    id, format,
    sp.get("recipient") || null,
    sp.get("recipient_address") || null,
    sp.get("purpose") || null,
    false,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const pdfBytes = await generateVerificationLetterPDF(result.data);
  const buffer = Buffer.from(pdfBytes);
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="Verification_${result.employeeName.replace(/\s+/g, "_")}_${result.data.letterDate}.pdf"`,
    },
  });
}

// POST — generate signed PDF and file it to the employee's documents.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || !["OWNER", "ADMIN"].includes(session.role)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Storage not configured" }, { status: 500 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const format = (body.format || "standard") as VerificationLetterFormat;
  if (!["standard", "with_salary", "income_proof"].includes(format)) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }

  const result = await loadLetterData(
    id, format,
    body.recipient || null,
    body.recipient_address || null,
    body.purpose || null,
    true,
  );
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  if (!result.data.signatureImageBytes) {
    return NextResponse.json(
      { error: "No company signature on file. Upload one in HR → Settings → Company first." },
      { status: 400 },
    );
  }

  const pdfBytes = await generateVerificationLetterPDF(result.data);
  const buffer = Buffer.from(pdfBytes);
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const storagePath = `${id}/verification/${stamp}.pdf`;
  const supabase = storageClient();
  const { error: upErr } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: "application/pdf", upsert: false,
  });
  if (upErr) return NextResponse.json({ error: `Upload failed: ${upErr.message}` }, { status: 500 });

  const fileName = `Verification_Letter_${result.employeeName.replace(/\s+/g, "_")}_${result.data.letterDate}.pdf`;
  const titleSuffix = format === "income_proof" ? " (Income Proof)" : format === "with_salary" ? " (with Salary)" : "";
  const { data: row, error: insErr } = await hrSupabaseAdmin
    .from("hr_employee_documents")
    .insert({
      user_id: id,
      doc_type: "verification",
      title: `Employment Verification${titleSuffix} — ${result.data.letterDate}`,
      file_name: fileName,
      storage_path: storagePath,
      mime_type: "application/pdf",
      size_bytes: buffer.byteLength,
      effective_date: result.data.letterDate,
      uploaded_by: session.id,
    })
    .select()
    .single();
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  // Generate signed URL for immediate viewing.
  const { data: signed } = await supabase.storage.from(BUCKET).createSignedUrl(storagePath, 3600);
  return NextResponse.json({ document: { ...row, signed_url: signed?.signedUrl ?? null } });
}
