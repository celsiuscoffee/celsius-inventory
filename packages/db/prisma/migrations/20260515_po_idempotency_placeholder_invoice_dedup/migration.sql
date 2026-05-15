-- Duplicate-PO root cause patch (2026-05-15)
--
-- Symptom (3 cases unwound on 2026-05-13): a single "Send to Supplier"
-- click spawned two POs → two placeholder invoices → both got paid.
--
-- Root causes (all addressed here + in app code):
--   1. POST /api/inventory/orders has no idempotency. A double-tap or
--      a network retry creates two distinct Orders (the existing retry
--      loop only handles orderNumber collisions, not duplicate intent).
--   2. PATCH AWAITING_DELIVERY does findFirst → if-not-exists → create
--      on the placeholder Invoice. Two concurrent PATCHes both miss
--      and both create, yielding two placeholder invoices for one PO.
--
-- Defensive layer (this migration):
--   A. Order.clientRequestId — client-generated UUID, unique. POST will
--      upsert against this so a retry returns the same row.
--   B. Partial unique index on Invoice (orderId) for placeholder
--      invoices (PENDING + dueDate=null + INV-prefixed). The PATCH
--      handler can now just .create() and catch P2002 instead of
--      check-then-create. Real supplier invoices (with dueDate) and
--      DEPOSIT_PAID/PAID rows are excluded so attaching a real invoice
--      after the placeholder is recorded still works.

-- A. Idempotency for PO creation
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "Order_clientRequestId_key"
  ON "Order"("clientRequestId")
  WHERE "clientRequestId" IS NOT NULL;

-- B. One placeholder invoice per PO. Partial index so it doesn't fight
--    the legitimate case of multiple non-placeholder invoices on a PO
--    (e.g. deposit invoice + balance invoice from the same supplier).
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_orderId_placeholder_unique"
  ON "Invoice"("orderId")
  WHERE "orderId" IS NOT NULL
    AND "status" = 'PENDING'
    AND "dueDate" IS NULL
    AND "invoiceNumber" LIKE 'INV-%';
