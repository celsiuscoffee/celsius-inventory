-- Hot-path indexes for multi-outlet queries.
-- Apply via Supabase MCP (db push is disabled; see packages/db/package.json).
-- All statements are idempotent.
--
-- Names match Prisma's default naming convention so a future
-- `prisma migrate diff` will not try to re-create them.

-- User: list staff by outlet; list active staff by role.
CREATE INDEX IF NOT EXISTS "User_outletId_idx" ON "User"("outletId");
CREATE INDEX IF NOT EXISTS "User_role_status_idx" ON "User"("role", "status");

-- Order: outlet dashboards; status filters with recent-first ordering.
CREATE INDEX IF NOT EXISTS "Order_outletId_createdAt_idx" ON "Order"("outletId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "Order_supplierId_idx" ON "Order"("supplierId");

-- Invoice: outlet AR list; unpaid scan; supplier drill-down; PO join.
CREATE INDEX IF NOT EXISTS "Invoice_outletId_issueDate_idx" ON "Invoice"("outletId", "issueDate" DESC);
CREATE INDEX IF NOT EXISTS "Invoice_status_issueDate_idx" ON "Invoice"("status", "issueDate" DESC);
CREATE INDEX IF NOT EXISTS "Invoice_supplierId_idx" ON "Invoice"("supplierId");
CREATE INDEX IF NOT EXISTS "Invoice_orderId_idx" ON "Invoice"("orderId");

-- Receiving: outlet history; PO lookup.
CREATE INDEX IF NOT EXISTS "Receiving_outletId_receivedAt_idx" ON "Receiving"("outletId", "receivedAt" DESC);
CREATE INDEX IF NOT EXISTS "Receiving_orderId_idx" ON "Receiving"("orderId");

-- StockCount: outlet history timeline.
CREATE INDEX IF NOT EXISTS "StockCount_outletId_countDate_idx" ON "StockCount"("outletId", "countDate" DESC);

-- StockAdjustment: outlet audit trail; product history.
CREATE INDEX IF NOT EXISTS "StockAdjustment_outletId_createdAt_idx" ON "StockAdjustment"("outletId", "createdAt" DESC);
CREATE INDEX IF NOT EXISTS "StockAdjustment_productId_idx" ON "StockAdjustment"("productId");
