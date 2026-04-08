import { NextResponse, NextRequest } from "next/server";
import { requireRole, AuthError } from "@/lib/auth";

const defaults = { id: "default", pinLength: 4 };

// GET /api/settings/system — fetch system settings
export async function GET() {
  return NextResponse.json(defaults);
}

// PATCH /api/settings/system — update system settings (admin only)
export async function PATCH(req: NextRequest) {
  try {
    await requireRole(req.headers, "ADMIN");
  } catch (e) {
    if (e instanceof AuthError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  const body = await req.json();

  if (body.pinLength !== undefined) {
    const pl = Number(body.pinLength);
    if (pl !== 4 && pl !== 6) {
      return NextResponse.json({ error: "PIN length must be 4 or 6" }, { status: 400 });
    }
    defaults.pinLength = pl;
  }

  return NextResponse.json(defaults);
}
