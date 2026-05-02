// Streamed loading state for any /inventory/* route. Renders an inline
// data-table skeleton — same layout footprint as the actual pages — instead
// of a full-page spinner so the user sees the right shape immediately.
// Next.js will swap this out for real content as soon as the page resolves.
import { TableLoadingSkeleton } from "@celsius/ui";

export default function InventoryLoading() {
  return <TableLoadingSkeleton rows={10} />;
}
