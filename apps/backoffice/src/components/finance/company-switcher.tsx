"use client";

// Bukku-style company switcher for the finance module. Sets a cookie on the
// server, then reloads the page so SWR data is re-fetched under the new
// company scope.

import { useState, useRef, useEffect } from "react";
import { useFetch } from "@/lib/use-fetch";
import { Button } from "@celsius/ui";
import { Building2, Check, ChevronDown, Loader2 } from "lucide-react";

type Company = {
  id: string;
  name: string;
  brn: string | null;
  tin: string | null;
  isDefault: boolean;
  isActive: boolean;
};

export function CompanySwitcher() {
  const { data, isLoading } = useFetch<{ companies: Company[]; activeCompanyId: string }>(
    "/api/finance/companies"
  );
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function close(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("click", close);
      document.addEventListener("keydown", onEsc);
    }
    return () => {
      document.removeEventListener("click", close);
      document.removeEventListener("keydown", onEsc);
    };
  }, [open]);

  if (isLoading || !data) {
    return (
      <Button variant="outline" size="sm" disabled>
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading...
      </Button>
    );
  }

  const active = data.companies.find((c) => c.id === data.activeCompanyId);

  async function pick(id: string) {
    if (id === data?.activeCompanyId) {
      setOpen(false);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/finance/companies/switch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ companyId: id }),
      });
      if (res.ok) {
        // Hard reload so all SWR caches refetch under the new company scope.
        window.location.reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div ref={ref} className="relative inline-block">
      <Button
        onClick={() => setOpen((o) => !o)}
        disabled={busy}
        variant="outline"
        size="sm"
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <Building2 className="h-4 w-4" />
        <span className="max-w-[200px] truncate font-medium">
          {active?.name ?? "Pick company"}
        </span>
        <ChevronDown className="h-3 w-3" />
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-lg"
          role="listbox"
        >
          <ul className="max-h-80 overflow-y-auto py-1">
            {data.companies
              .filter((c) => c.isActive)
              .map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => pick(c.id)}
                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-sm transition hover:bg-muted"
                    role="option"
                    aria-selected={c.id === data.activeCompanyId}
                  >
                    <span className="flex min-w-0 flex-col items-start">
                      <span className="truncate font-medium">{c.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {c.id}
                        {c.brn ? ` · ${c.brn}` : ""}
                      </span>
                    </span>
                    {c.id === data.activeCompanyId && (
                      <Check className="h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    )}
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
    </div>
  );
}
