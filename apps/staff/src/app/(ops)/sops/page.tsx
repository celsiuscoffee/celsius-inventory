"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Loader2, FileText, ListChecks, Building2 } from "lucide-react";
import { useFetch } from "@/lib/use-fetch";

type Sop = {
  id: string;
  title: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sortOrder: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string };
  createdBy: { id: string; name: string };
  _count: { steps: number; sopOutlets: number };
};

type Category = {
  id: string;
  name: string;
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

export default function SopsPage() {
  const { data: sops, isLoading } = useFetch<Sop[]>("/api/sops");
  const { data: categories } = useFetch<Category[]>("/api/sop-categories");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");

  const filtered = useMemo(() => {
    if (!sops) return [];
    return sops.filter((sop) => {
      if (statusFilter !== "ALL" && sop.status !== statusFilter) return false;
      if (categoryFilter !== "ALL" && sop.category.id !== categoryFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return sop.title.toLowerCase().includes(q) || sop.description?.toLowerCase().includes(q);
      }
      return true;
    });
  }, [sops, search, statusFilter, categoryFilter]);

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">SOPs</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {sops ? `${sops.length} standard operating procedure${sops.length !== 1 ? "s" : ""}` : "Loading..."}
          </p>
        </div>
        <Link href="/sops/new">
          <Button className="bg-terracotta hover:bg-terracotta-dark">
            <Plus className="mr-2 h-4 w-4" />Create SOP
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SOPs..."
            className="pl-9"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="ALL">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="ALL">All Categories</option>
          {categories?.map((cat) => (
            <option key={cat.id} value={cat.id}>{cat.name}</option>
          ))}
        </select>
      </div>

      {/* SOP Grid */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              {sops?.length === 0 ? "No SOPs yet" : "No SOPs match your filters"}
            </p>
            {sops?.length === 0 && (
              <Link href="/sops/new">
                <Button variant="outline" className="mt-4">
                  <Plus className="mr-2 h-4 w-4" />Create your first SOP
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((sop) => (
            <Link key={sop.id} href={`/sops/${sop.id}`}>
              <Card className="transition-shadow hover:shadow-md cursor-pointer h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-medium text-foreground line-clamp-2">{sop.title}</h3>
                    <Badge className={`shrink-0 text-[10px] ${STATUS_COLORS[sop.status]}`}>
                      {sop.status}
                    </Badge>
                  </div>
                  {sop.description && (
                    <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2">{sop.description}</p>
                  )}
                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="text-[10px]">{sop.category.name}</Badge>
                    <span className="flex items-center gap-1">
                      <ListChecks className="h-3 w-3" />{sop._count.steps} step{sop._count.steps !== 1 ? "s" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <Building2 className="h-3 w-3" />{sop._count.sopOutlets} outlet{sop._count.sopOutlets !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground/60">
                    by {sop.createdBy.name} · v{sop.version}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
