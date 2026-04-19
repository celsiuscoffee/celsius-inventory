/**
 * Audit logging helpers backed by the ActivityLog table.
 *
 * Two entry points:
 *   - logActivity(params)       — bare insert, awaits completion
 *   - audited(opts, fn)         — wrap a mutation; audit row is written
 *                                 after the mutation resolves, then awaited
 *                                 so serverless runtimes don't terminate
 *                                 before the audit row is persisted
 *
 * Audit-write failures are caught inside logActivity so they never block
 * a business operation, but they're reported via the error reporter (if
 * registered) — wire Sentry here so you see silent audit failures.
 */
import { prisma } from "./index";

export type ActivityLogParams = {
  userId?: string | null;
  action: string;
  module: string;
  details?: string;
  targetId?: string;
  targetName?: string;
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
};

export type AuditOptions = {
  actorId: string | null;
  action: string;
  module: string;
  target?: { id: string; name?: string };
  diff?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
};

// ─── Error reporter registration ─────────────────────────────
// Apps call setAuditErrorReporter() at startup to forward audit
// failures to their observability tool (Sentry, Datadog, etc).
// @celsius/db stays framework-agnostic.

type AuditErrorReporter = (err: unknown, context: Record<string, unknown>) => void;

let errorReporter: AuditErrorReporter | null = null;

export function setAuditErrorReporter(fn: AuditErrorReporter): void {
  errorReporter = fn;
}

// ─── logActivity ─────────────────────────────────────────────

export async function logActivity(params: ActivityLogParams): Promise<void> {
  try {
    await prisma.activityLog.create({
      data: {
        userId: params.userId ?? null,
        action: params.action,
        module: params.module,
        details: params.details,
        targetId: params.targetId,
        targetName: params.targetName,
        diff: params.diff ?? undefined,
        metadata: params.metadata ?? undefined,
        ipAddress: params.ipAddress,
      },
    });
  } catch (err) {
    console.error("[audit] logActivity failed", { action: params.action, err });
    errorReporter?.(err, {
      source: "audit.logActivity",
      action: params.action,
      module: params.module,
      targetId: params.targetId,
    });
  }
}

// ─── audited() wrapper ───────────────────────────────────────

/**
 * Wrap a mutation so an ActivityLog row is written after it resolves.
 * The audit write is awaited so serverless runtimes don't terminate
 * before persistence; logActivity swallows its own errors so a failed
 * audit write never blocks the business operation.
 *
 *   const invoice = await audited(
 *     { actorId: session.id, action: "INVOICE_MARK_PAID", module: "invoices",
 *       target: { id: invoiceId }, metadata: { source: "telegram" } },
 *     () => prisma.invoice.update({ where: { id: invoiceId }, data: { status: "PAID" } }),
 *   );
 */
export async function audited<T>(opts: AuditOptions, fn: () => Promise<T>): Promise<T> {
  const result = await fn();
  await logActivity({
    userId: opts.actorId,
    action: opts.action,
    module: opts.module,
    targetId: opts.target?.id,
    targetName: opts.target?.name,
    diff: opts.diff,
    metadata: opts.metadata,
    ipAddress: opts.ipAddress,
  });
  return result;
}
