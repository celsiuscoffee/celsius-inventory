"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ──────────────────────────────────────────────────────────────

type Decision = {
  type: "cost_optimisation" | "cash_cycle" | "inventory_optimisation";
  priority: "urgent" | "high" | "medium" | "low";
  title: string;
  description: string;
  impact_rm: number | null;
  action_items: string[];
};

type HealthScore = {
  overall: number;
  cost_efficiency: number;
  cash_cycle: number;
  inventory_turnover: number;
  waste_control: number;
};

type Metrics = {
  salesRevenue30: number;
  totalPurchases30: number;
  grossMarginPercent: number;
  totalStockValue: number;
  daysInventoryOutstanding: number;
  totalPayables: number;
  wasteCost30: number;
  receivingAccuracy: number;
  criticalItems: number;
  lowStockItems: number;
  overstockItems: number;
  deadStockItems: number;
  totalProducts: number;
  analysisDate: string;
};

type AIResponse = {
  decisions: Decision[];
  health_score: HealthScore;
  quick_wins: string[];
  cash_cycle_summary: string;
  metrics: Metrics;
};

// ─── Helpers ────────────────────────────────────────────────────────────

const typeConfig = {
  cost_optimisation: { label: "Cost Optimisation", color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/30", icon: "RM" },
  cash_cycle: { label: "Cash Cycle", color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/30", icon: "\u21c4" },
  inventory_optimisation: { label: "Inventory", color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/30", icon: "\u2693" },
};

const priorityConfig = {
  urgent: { label: "URGENT", color: "bg-red-500/20 text-red-400 border-red-500/40" },
  high: { label: "HIGH", color: "bg-orange-500/20 text-orange-400 border-orange-500/40" },
  medium: { label: "MEDIUM", color: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40" },
  low: { label: "LOW", color: "bg-zinc-500/20 text-zinc-400 border-zinc-500/40" },
};

function ScoreRing({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color =
    score >= 80 ? "text-emerald-400" : score >= 60 ? "text-yellow-400" : score >= 40 ? "text-orange-400" : "text-red-400";
  const strokeColor =
    score >= 80 ? "#34d399" : score >= 60 ? "#facc15" : score >= 40 ? "#fb923c" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth={4} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={4}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-1000"
          />
        </svg>
        <div className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${color}`}>
          {score}
        </div>
      </div>
      <span className="text-xs text-zinc-400 text-center leading-tight">{label}</span>
    </div>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────

export default function AIDecisionsPage() {
  const [data, setData] = useState<AIResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/inventory/ai-decisions");
      if (!res.ok) throw new Error("Failed to fetch");
      const json = await res.json();
      setData(json);
    } catch {
      setError("Failed to load AI analysis. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <span className="text-xl">&#x1F9E0;</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Inventory Decisions</h1>
            <p className="text-sm text-zinc-400">Analysing inventory data...</p>
          </div>
        </div>
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
          <p className="text-zinc-400 animate-pulse">Claude is analysing your inventory, purchasing, and cash flow data...</p>
          <p className="text-xs text-zinc-500">This may take 15-30 seconds</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-4">AI Inventory Decisions</h1>
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          {error || "No data available"}
        </div>
        <button
          onClick={fetchData}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Retry
        </button>
      </div>
    );
  }

  const { decisions, health_score, quick_wins, cash_cycle_summary, metrics } = data;

  const filteredDecisions =
    filterType === "all" ? decisions : decisions.filter((d) => d.type === filterType);

  const totalImpact = decisions.reduce((s, d) => s + (d.impact_rm || 0), 0);
  const urgentCount = decisions.filter((d) => d.priority === "urgent" || d.priority === "high").length;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
            <span className="text-xl">&#x1F9E0;</span>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">AI Inventory Decisions</h1>
            <p className="text-sm text-zinc-400">
              Cost optimisation &bull; Negative cash cycle &bull; Inventory optimisation
            </p>
          </div>
        </div>
        <button
          onClick={fetchData}
          className="px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-lg hover:bg-zinc-700 text-sm"
        >
          Refresh Analysis
        </button>
      </div>

      {/* Health Score + Metrics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Health Score Card */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Health Score</h2>
          <div className="flex items-center justify-center mb-4">
            <ScoreRing score={health_score.overall} label="Overall" size={100} />
          </div>
          <div className="grid grid-cols-4 gap-2">
            <ScoreRing score={health_score.cost_efficiency} label="Cost" size={60} />
            <ScoreRing score={health_score.cash_cycle} label="Cash" size={60} />
            <ScoreRing score={health_score.inventory_turnover} label="Turnover" size={60} />
            <ScoreRing score={health_score.waste_control} label="Waste" size={60} />
          </div>
        </div>

        {/* Key Metrics */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5">
          <h2 className="text-sm font-medium text-zinc-400 mb-3">Key Metrics (30d)</h2>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-zinc-500">Sales Revenue</p>
              <p className="text-lg font-bold text-white">RM {metrics.salesRevenue30.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Purchases</p>
              <p className="text-lg font-bold text-white">RM {metrics.totalPurchases30.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Gross Margin</p>
              <p className={`text-lg font-bold ${metrics.grossMarginPercent >= 60 ? "text-emerald-400" : metrics.grossMarginPercent >= 40 ? "text-yellow-400" : "text-red-400"}`}>
                {metrics.grossMarginPercent}%
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Inventory Value</p>
              <p className="text-lg font-bold text-white">RM {metrics.totalStockValue.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Days of Inventory</p>
              <p className={`text-lg font-bold ${metrics.daysInventoryOutstanding <= 7 ? "text-emerald-400" : metrics.daysInventoryOutstanding <= 14 ? "text-yellow-400" : "text-red-400"}`}>
                {metrics.daysInventoryOutstanding}d
              </p>
            </div>
            <div>
              <p className="text-xs text-zinc-500">Wastage Cost</p>
              <p className="text-lg font-bold text-red-400">RM {metrics.wasteCost30.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Cash Cycle + Quick Wins */}
        <div className="space-y-4">
          {/* Cash Cycle Summary */}
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4">
            <h2 className="text-sm font-medium text-blue-400 mb-2 flex items-center gap-2">
              <span>&#x21C4;</span> Cash Cycle
            </h2>
            <p className="text-sm text-zinc-300">{cash_cycle_summary}</p>
            <div className="mt-2 flex gap-4 text-xs text-zinc-400">
              <span>Payables: RM {metrics.totalPayables.toLocaleString()}</span>
              <span>DIO: {metrics.daysInventoryOutstanding}d</span>
            </div>
          </div>

          {/* Quick Wins */}
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
            <h2 className="text-sm font-medium text-emerald-400 mb-2">&#x26A1; Quick Wins</h2>
            <ul className="space-y-1.5">
              {quick_wins.map((qw, i) => (
                <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                  <span className="text-emerald-400 mt-0.5">&#x2022;</span>
                  {qw}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Stock Health Bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-medium text-zinc-400">Inventory Status</h2>
          <span className="text-xs text-zinc-500">{metrics.totalProducts} products tracked</span>
        </div>
        <div className="flex gap-3">
          {metrics.criticalItems > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-lg">
              <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-red-400">{metrics.criticalItems} Critical</span>
            </div>
          )}
          {metrics.lowStockItems > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/10 border border-orange-500/30 rounded-lg">
              <div className="w-2 h-2 bg-orange-500 rounded-full" />
              <span className="text-sm font-medium text-orange-400">{metrics.lowStockItems} Low Stock</span>
            </div>
          )}
          {metrics.overstockItems > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              <span className="text-sm font-medium text-yellow-400">{metrics.overstockItems} Overstock</span>
            </div>
          )}
          {metrics.deadStockItems > 0 && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-500/10 border border-zinc-500/30 rounded-lg">
              <div className="w-2 h-2 bg-zinc-500 rounded-full" />
              <span className="text-sm font-medium text-zinc-400">{metrics.deadStockItems} Dead Stock</span>
            </div>
          )}
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 rounded-lg">
            <span className="text-sm text-zinc-400">Receiving Accuracy: <span className="font-medium text-white">{metrics.receivingAccuracy}%</span></span>
          </div>
        </div>
      </div>

      {/* Impact Summary + Filter */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-sm text-zinc-400">
            <span className="text-white font-bold">{decisions.length}</span> decisions &bull;{" "}
            <span className="text-red-400 font-medium">{urgentCount} urgent/high priority</span> &bull;{" "}
            Est. impact: <span className="text-emerald-400 font-bold">RM {Math.round(totalImpact).toLocaleString()}/mo</span>
          </div>
        </div>
        <div className="flex gap-1 bg-zinc-800/50 rounded-lg p-0.5">
          {[
            { key: "all", label: "All" },
            { key: "cost_optimisation", label: "Cost" },
            { key: "cash_cycle", label: "Cash" },
            { key: "inventory_optimisation", label: "Inventory" },
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilterType(f.key)}
              className={`px-3 py-1.5 text-xs rounded-md transition ${
                filterType === f.key
                  ? "bg-zinc-700 text-white"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Decisions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredDecisions.map((d, i) => {
          const tc = typeConfig[d.type] || typeConfig.cost_optimisation;
          const pc = priorityConfig[d.priority] || priorityConfig.medium;
          const isExpanded = expandedIdx === i;

          return (
            <div
              key={i}
              className={`bg-zinc-900 border rounded-xl overflow-hidden cursor-pointer transition-all hover:border-zinc-600 ${
                d.priority === "urgent" ? "border-red-500/30" : "border-zinc-800"
              }`}
              onClick={() => setExpandedIdx(isExpanded ? null : i)}
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center justify-center w-7 h-7 rounded-md border text-xs font-bold ${tc.bg}`}>
                      {tc.icon}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${pc.color}`}>
                      {pc.label}
                    </span>
                    <span className={`text-xs ${tc.color}`}>{tc.label}</span>
                  </div>
                  {d.impact_rm && (
                    <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      RM {d.impact_rm.toLocaleString()}/mo
                    </span>
                  )}
                </div>
                <h3 className="text-sm font-semibold text-white mb-1">{d.title}</h3>
                <p className="text-xs text-zinc-400 leading-relaxed">{d.description}</p>
              </div>

              {isExpanded && d.action_items && d.action_items.length > 0 && (
                <div className="border-t border-zinc-800 bg-zinc-950/50 p-4">
                  <p className="text-xs font-medium text-zinc-400 mb-2">Action Items:</p>
                  <ul className="space-y-1.5">
                    {d.action_items.map((ai, j) => (
                      <li key={j} className="text-xs text-zinc-300 flex items-start gap-2">
                        <span className="text-purple-400 mt-0.5 shrink-0">&#x25B6;</span>
                        {ai}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-zinc-600 pt-4">
        Analysis powered by Claude AI &bull; Data as of {metrics.analysisDate} &bull; Refreshes on demand
      </div>
    </div>
  );
}
