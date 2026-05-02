import Link from "next/link";
import { ArrowLeft } from "lucide-react";

// Small breadcrumb crumb shown above each HR sub-page's h1 so operators have
// a consistent way back to the HR landing. Use as: <BackToHR />.
export function BackToHR() {
  return (
    <Link
      href="/hr"
      className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:underline"
    >
      <ArrowLeft className="h-3 w-3" /> HR
    </Link>
  );
}
