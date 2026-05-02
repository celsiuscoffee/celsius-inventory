// Dashboard renders KPI tiles + charts; show a matching shape, not a
// table-style skeleton, while the SWR fetches resolve.
import { DashboardLoadingSkeleton } from "@celsius/ui";

export default function DashboardLoading() {
  return <DashboardLoadingSkeleton tiles={4} />;
}
