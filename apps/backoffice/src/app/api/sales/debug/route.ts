import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTransactions } from "@/lib/storehub";

// ─── GET /api/sales/debug ──────────────────────────────────────────────
// Diagnostic endpoint to check StoreHub connectivity and data flow.

export async function GET() {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const checks: Record<string, unknown> = {};

    // 1. Check env vars
    checks.envVars = {
      STOREHUB_ACCOUNT_ID: process.env.STOREHUB_ACCOUNT_ID ? `set (${process.env.STOREHUB_ACCOUNT_ID.length} chars)` : "MISSING",
      STOREHUB_API_KEY: process.env.STOREHUB_API_KEY ? `set (${process.env.STOREHUB_API_KEY.length} chars)` : "MISSING",
    };

    // 2. Check outlets with storehubId
    const outlets = await prisma.outlet.findMany({
      where: { storehubId: { not: null }, status: "ACTIVE" },
      select: { id: true, name: true, storehubId: true },
    });
    checks.outlets = outlets.map((o) => ({ name: o.name, storehubId: o.storehubId }));
    checks.outletCount = outlets.length;

    if (outlets.length === 0) {
      checks.diagnosis = "No active outlets with storehubId configured. Dashboard will show 404.";
      return NextResponse.json(checks);
    }

    // 3. Test StoreHub API with first outlet (small date range)
    const testOutlet = outlets[0];
    const now = new Date();
    const mytNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const today = mytNow.toISOString().split("T")[0];
    const yesterday = new Date(mytNow);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    try {
      const from = new Date(yesterdayStr + "T00:00:00+08:00");
      const to = new Date(today + "T23:59:59+08:00");
      const txns = await getTransactions(testOutlet.storehubId!, from, to);
      checks.storehubTest = {
        outlet: testOutlet.name,
        storehubId: testOutlet.storehubId,
        dateRange: `${yesterdayStr} to ${today}`,
        transactionCount: txns.length,
        sampleTotal: txns.length > 0 ? txns[0].total : null,
        sampleTime: txns.length > 0 ? (txns[0].transactionTime || txns[0].completedAt || txns[0].createdAt) : null,
      };
      if (txns.length > 0) {
        checks.diagnosis = `StoreHub API working. Got ${txns.length} transactions. Dashboard should show data.`;
      } else {
        checks.diagnosis = `StoreHub API connected but returned 0 transactions for ${yesterdayStr}-${today}. Could be no sales in this period.`;
      }
    } catch (err) {
      checks.storehubTest = {
        error: err instanceof Error ? err.message : String(err),
        outlet: testOutlet.name,
        storehubId: testOutlet.storehubId,
      };
      checks.diagnosis = `StoreHub API FAILED: ${err instanceof Error ? err.message : String(err)}. This is why the dashboard shows RM 0.00.`;
    }

    return NextResponse.json(checks);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
