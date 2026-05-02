"use client";

// ⌘K command palette — opens with Cmd/Ctrl+K from anywhere in the backoffice.
// Currently scoped to "find an employee" — fastest way to jump to a profile
// from any module. Easy to extend with other action groups later (e.g. quick
// nav to compliance, schedules, etc.).

import { useEffect, useRef, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";

type Employee = {
  id: string;
  name: string;
  fullName: string | null;
  role: string;
  phone: string | null;
  outlet: { name: string } | null;
  status?: string;
  hrProfile?: { ic_number?: string | null; position?: string | null; profile_photo_url?: string | null } | null;
  profile_photo_url?: string | null;
};

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Fetch the employee directory once on first open. Keep it cached for the
  // session — typical company list is < 500 rows so a client-side fuzzy filter
  // is fast and avoids a per-keystroke server round trip.
  useEffect(() => {
    if (!open || employees.length > 0 || loading) return;
    setLoading(true);
    fetch("/api/hr/employees")
      .then((r) => r.json())
      .then((d) => setEmployees(d?.employees || []))
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false));
  }, [open, employees.length, loading]);

  // Global ⌘K / Ctrl+K handler. Toggles open. Esc closes.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isCmdK = (e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k";
      if (isCmdK) {
        e.preventDefault();
        setOpen((v) => !v);
        setQ("");
        setHighlight(0);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Match name / fullName / phone / IC. Case-insensitive substring.
  const filtered = useMemo(() => {
    if (!q.trim()) return employees.slice(0, 12);
    const needle = q.toLowerCase();
    return employees
      .filter((e) => {
        if (e.status && e.status !== "ACTIVE" && e.status !== "INVITED") return false;
        const name = (e.fullName || e.name || "").toLowerCase();
        const phone = (e.phone || "").toLowerCase();
        const ic = (e.hrProfile?.ic_number || "").toLowerCase();
        return name.includes(needle) || phone.includes(needle) || ic.includes(needle);
      })
      .slice(0, 12);
  }, [q, employees]);

  // Reset highlight when query changes
  useEffect(() => { setHighlight(0); }, [q]);

  const select = (emp: Employee) => {
    router.push(`/hr/employees/${emp.id}`);
    setOpen(false);
    setQ("");
  };

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[highlight];
      if (target) select(target);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-black/40 px-4 pt-[15vh]"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl overflow-hidden rounded-xl border bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onInputKey}
            placeholder="Search employees by name, phone, or IC…"
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
          />
          <kbd className="hidden rounded border bg-gray-100 px-1.5 py-0.5 text-[10px] font-mono text-gray-500 sm:inline">
            ESC
          </kbd>
        </div>

        <div className="max-h-[50vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-8 text-xs text-gray-500">
              <Loader2 className="h-3 w-3 animate-spin" /> Loading directory…
            </div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-xs text-gray-400">
              {q ? `No matches for "${q}"` : "No employees yet"}
            </p>
          ) : (
            <ul className="py-1">
              {filtered.map((e, i) => {
                const photo = e.profile_photo_url || e.hrProfile?.profile_photo_url || null;
                const isActive = i === highlight;
                return (
                  <li key={e.id}>
                    <button
                      onClick={() => select(e)}
                      onMouseEnter={() => setHighlight(i)}
                      className={`flex w-full items-center gap-3 px-4 py-2 text-left text-sm ${
                        isActive ? "bg-terracotta/10" : "hover:bg-gray-50"
                      }`}
                    >
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={photo}
                          alt=""
                          className="h-8 w-8 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-200 text-[11px] font-semibold text-gray-600">
                          {(e.fullName || e.name || "?").charAt(0).toUpperCase()}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {e.fullName || e.name}
                        </span>
                        <span className="block truncate text-[10px] text-gray-500">
                          {[e.role, e.hrProfile?.position, e.outlet?.name].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      {e.phone && (
                        <span className="hidden text-[10px] text-gray-400 sm:inline">{e.phone}</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between border-t px-4 py-2 text-[10px] text-gray-400">
          <span>
            <kbd className="rounded border bg-gray-100 px-1 font-mono">↑</kbd>{" "}
            <kbd className="rounded border bg-gray-100 px-1 font-mono">↓</kbd> navigate ·{" "}
            <kbd className="rounded border bg-gray-100 px-1 font-mono">↵</kbd> open
          </span>
          <span>
            <kbd className="rounded border bg-gray-100 px-1 font-mono">⌘K</kbd> toggle
          </span>
        </div>
      </div>
    </div>
  );
}
