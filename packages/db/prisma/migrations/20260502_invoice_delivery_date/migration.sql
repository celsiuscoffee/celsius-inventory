-- Track the actual delivery date on the invoice itself. Order.deliveryDate
-- is the planned/expected date (set when the PO is created); this column
-- captures what the supplier's invoice says actually arrived. The two can
-- differ — and when they do, we want both, so the receivings cycle and
-- payment cycle each have their own truth.
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "deliveryDate" TIMESTAMP(3);
