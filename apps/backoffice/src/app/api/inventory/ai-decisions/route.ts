import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTransactions, type StoreHubTransaction } from "@/lib/storehub";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─── GET /api/inventory/ai-decisions ───────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const outletId = searchParams.get("outletId") || null;

    // ─── Date ranges ────────────────────────────────────────────────
    const now = new Date();
    const mytNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    const todayMYT = mytNow.toISOString().split("T")[0];

    const d30 = new Date(mytNow);
    d30.setDate(d30.getDate() - 29);
    const from30 = d30.toISOString().split("T")[0];

    const d90 = new Date(mytNow);
    d90.setDate(d90.getDate() - 89);
    const from90 = d90.toISOString().split("T")[0];

    const d7 = new Date(mytNow);
    d7.setDate(d7.getDate() - 6);
    const from7 = d7.toISOString().split("T")[0];

    const outletWhere = outletId
      ? { id: outletId }
      : { status: "ACTIVE" as const };

    // ─── Parallel data fetches ──────────────────────────────────────
    const [
      outlets,
      products,
      supplierProducts,
      priceHistory,
      orders30,
      orders90,
      stockBalances,
      parLevels,
      wastage30,
      invoices,
      receivings30,
      menuIngredients,
    ] = await Promise.all([
      // 1. Outlets
      prisma.outlet.findMany({
        where: outletWhere,
        select: { id: true, name: true, storehubId: true },
      }),

      // 2. All active products
      prisma.product.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          sku: true,
          baseUom: true,
          shelfLifeDays: true,
          itemType: true,
          packages: {
            select: { id: true, packageName: true, conversionFactor: true, isDefault: true },
          },
        },
      }),

      // 3. Supplier products (pricing)
      prisma.supplierProduct.findMany({
        where: { isActive: true },
        select: {
          id: true,
          supplierId: true,
          productId: true,
          productPackageId: true,
          price: true,
          moq: true,
          supplier: { select: { id: true, name: true, leadTimeDays: true } },
          productPackage: { select: { conversionFactor: true, packageName: true } },
        },
      }),

      // 4. Price history (last 90 days)
      prisma.priceHistory.findMany({
        where: { changedAt: { gte: new Date(from90 + "T00:00:00+08:00") } },
        select: {
          supplierId: true,
          productId: true,
          productPackageId: true,
          oldPrice: true,
          newPrice: true,
          changePercent: true,
          changedAt: true,
        },
        orderBy: { changedAt: "desc" },
      }),

      // 5. Purchase orders (last 30 days)
      prisma.order.findMany({
        where: {
          createdAt: { gte: new Date(from30 + "T00:00:00+08:00") },
          ...(outletId ? { outletId } : {}),
        },
        select: {
          id: true,
          orderNumber: true,
          supplierId: true,
          totalAmount: true,
          status: true,
          deliveryDate: true,
          createdAt: true,
          supplier: { select: { name: true, leadTimeDays: true } },
          items: {
            select: {
              productId: true,
              quantity: true,
              unitPrice: true,
              totalPrice: true,
            },
          },
        },
      }),

      // 6. Purchase orders (last 90 days for trend)
      prisma.order.findMany({
        where: {
          createdAt: { gte: new Date(from90 + "T00:00:00+08:00") },
          status: { in: ["COMPLETED", "PARTIALLY_RECEIVED", "AWAITING_DELIVERY", "CONFIRMED"] },
          ...(outletId ? { outletId } : {}),
        },
        select: {
          id: true,
          totalAmount: true,
          createdAt: true,
          supplierId: true,
          supplier: { select: { name: true } },
        },
      }),

      // 7. Stock balances
      prisma.stockBalance.findMany({
        where: outletId ? { outletId } : {},
        select: {
          productId: true,
          outletId: true,
          quantity: true,
          lastUpdated: true,
          outlet: { select: { name: true } },
        },
      }),

      // 8. Par levels
      prisma.parLevel.findMany({
        where: outletId ? { outletId } : {},
        select: {
          productId: true,
          outletId: true,
          parLevel: true,
          reorderPoint: true,
          maxLevel: true,
          avgDailyUsage: true,
          lastCalculated: true,
        },
      }),

      // 9. Wastage (last 30 days)
      prisma.stockAdjustment.findMany({
        where: {
          createdAt: { gte: new Date(from30 + "T00:00:00+08:00") },
          adjustmentType: { in: ["WASTAGE", "BREAKAGE", "EXPIRED", "SPILLAGE"] },
          ...(outletId ? { outletId } : {}),
        },
        select: {
          productId: true,
          adjustmentType: true,
          quantity: true,
          costAmount: true,
          createdAt: true,
        },
      }),

      // 10. Invoices (last 90 days for cash cycle)
      prisma.invoice.findMany({
        where: {
          createdAt: { gte: new Date(from90 + "T00:00:00+08:00") },
          ...(outletId ? { outletId } : {}),
        },
        select: {
          id: true,
          amount: true,
          status: true,
          paymentType: true,
          issueDate: true,
          dueDate: true,
          createdAt: true,
          supplierId: true,
          supplier: { select: { name: true } },
        },
      }),

      // 11. Receivings (last 30 days)
      prisma.receiving.findMany({
        where: {
          createdAt: { gte: new Date(from30 + "T00:00:00+08:00") },
          ...(outletId ? { outletId } : {}),
        },
        select: {
          id: true,
          receivedAt: true,
          items: {
            select: {
              productId: true,
              orderedQty: true,
              receivedQty: true,
              discrepancyReason: true,
            },
          },
        },
      }),

      // 12. Menu ingredients (BOM)
      prisma.menuIngredient.findMany({
        select: {
          menuId: true,
          productId: true,
          quantityUsed: true,
          menu: { select: { name: true, sellingPrice: true } },
        },
      }),
    ]);

    // ─── Fetch sales data from StoreHub ─────────────────────────────
    const storehubOutlets = outlets.filter((o) => o.storehubId);
    let totalSalesRevenue30 = 0;
    let totalSalesOrders30 = 0;
    const productSalesMap: Record<string, number> = {}; // productId → qty sold (via BOM)

    if (storehubOutlets.length > 0) {
      const allTxns: StoreHubTransaction[] = [];
      for (const outlet of storehubOutlets) {
        try {
          const from = new Date(from30 + "T00:00:00+08:00");
          const to = new Date(todayMYT + "T23:59:59+08:00");
          const txns = await getTransactions(outlet.storehubId!, from, to);
          allTxns.push(...txns);
        } catch (err) {
          console.error(`[ai-decisions] Failed to fetch StoreHub for ${outlet.name}:`, err);
        }
      }

      // Build menu ingredient map: menuName → [{productId, quantityUsed}]
      const bomMap: Record<string, { productId: string; quantityUsed: number }[]> = {};
      for (const mi of menuIngredients) {
        const key = mi.menu.name.toLowerCase().trim();
        if (!bomMap[key]) bomMap[key] = [];
        bomMap[key].push({ productId: mi.productId, quantityUsed: Number(mi.quantityUsed) });
      }

      for (const txn of allTxns) {
        if (txn.isCancelled) continue;
        totalSalesRevenue30 += txn.total;
        totalSalesOrders30 += 1;

        for (const item of txn.items || []) {
          const key = item.name.toLowerCase().trim();
          const recipe = bomMap[key];
          if (recipe) {
            for (const ing of recipe) {
              productSalesMap[ing.productId] =
                (productSalesMap[ing.productId] || 0) + ing.quantityUsed * item.quantity;
            }
          }
        }
      }
    }

    // ─── Build analysis data ────────────────────────────────────────

    // Product lookup
    const productMap = new Map(products.map((p) => [p.id, p]));

    // 1. Unit cost map (cheapest per base unit)
    const unitCostMap: Record<string, { cost: number; supplier: string }> = {};
    for (const sp of supplierProducts) {
      const conv = sp.productPackage ? Number(sp.productPackage.conversionFactor) : 1;
      const unitCost = Number(sp.price) / conv;
      if (!unitCostMap[sp.productId] || unitCost < unitCostMap[sp.productId].cost) {
        unitCostMap[sp.productId] = { cost: unitCost, supplier: sp.supplier.name };
      }
    }

    // 2. Stock value & days of stock
    type StockItem = {
      productName: string;
      productId: string;
      outletName: string;
      quantity: number;
      unitCost: number;
      stockValue: number;
      parLevel: number;
      reorderPoint: number;
      avgDailyUsage: number;
      daysOfStock: number;
      status: "critical" | "low" | "ok" | "overstock" | "dead";
    };

    const stockItems: StockItem[] = [];
    const parMap = new Map(
      parLevels.map((p) => [`${p.productId}_${p.outletId}`, p])
    );

    let totalStockValue = 0;
    let criticalCount = 0;
    let lowCount = 0;
    let overstockCount = 0;
    let deadStockCount = 0;

    for (const sb of stockBalances) {
      const product = productMap.get(sb.productId);
      if (!product) continue;

      const uc = unitCostMap[sb.productId]?.cost || 0;
      const stockVal = Number(sb.quantity) * uc;
      totalStockValue += stockVal;

      const par = parMap.get(`${sb.productId}_${sb.outletId}`);
      const avgDaily = par ? Number(par.avgDailyUsage) : 0;
      const parLevel = par ? Number(par.parLevel) : 0;
      const reorderPt = par ? Number(par.reorderPoint) : 0;
      const qty = Number(sb.quantity);
      const daysOfStock = avgDaily > 0 ? Math.round(qty / avgDaily) : qty > 0 ? 999 : 0;

      let status: StockItem["status"] = "ok";
      if (qty <= 0 && avgDaily > 0) status = "critical";
      else if (qty > 0 && qty <= reorderPt && avgDaily > 0) status = "low";
      else if (qty > parLevel * 2 && parLevel > 0) status = "overstock";
      else if (avgDaily === 0 && qty > 0) status = "dead";

      if (status === "critical") criticalCount++;
      if (status === "low") lowCount++;
      if (status === "overstock") overstockCount++;
      if (status === "dead") deadStockCount++;

      stockItems.push({
        productName: product.name,
        productId: sb.productId,
        outletName: sb.outlet.name,
        quantity: qty,
        unitCost: Math.round(uc * 100) / 100,
        stockValue: Math.round(stockVal * 100) / 100,
        parLevel,
        reorderPoint: reorderPt,
        avgDailyUsage: Math.round(avgDaily * 100) / 100,
        daysOfStock,
        status,
      });
    }

    // 3. Supplier spending analysis
    type SupplierSpend = {
      name: string;
      supplierId: string;
      spend30: number;
      spend90: number;
      orderCount30: number;
      leadTimeDays: number;
      priceChanges: number;
      avgPriceChangePercent: number;
    };

    const supplierSpendMap: Record<string, SupplierSpend> = {};

    for (const order of orders90) {
      const sid = order.supplierId;
      if (!supplierSpendMap[sid]) {
        supplierSpendMap[sid] = {
          name: order.supplier.name,
          supplierId: sid,
          spend30: 0,
          spend90: 0,
          orderCount30: 0,
          leadTimeDays: 0,
          priceChanges: 0,
          avgPriceChangePercent: 0,
        };
      }
      supplierSpendMap[sid].spend90 += Number(order.totalAmount);
    }

    for (const order of orders30) {
      const sid = order.supplierId;
      if (!supplierSpendMap[sid]) {
        supplierSpendMap[sid] = {
          name: order.supplier.name,
          supplierId: sid,
          spend30: 0,
          spend90: 0,
          orderCount30: 0,
          leadTimeDays: order.supplier.leadTimeDays || 0,
          priceChanges: 0,
          avgPriceChangePercent: 0,
        };
      }
      supplierSpendMap[sid].spend30 += Number(order.totalAmount);
      supplierSpendMap[sid].orderCount30 += 1;
      supplierSpendMap[sid].leadTimeDays = order.supplier.leadTimeDays || 0;
    }

    // Price change analysis
    for (const ph of priceHistory) {
      if (supplierSpendMap[ph.supplierId]) {
        supplierSpendMap[ph.supplierId].priceChanges += 1;
        supplierSpendMap[ph.supplierId].avgPriceChangePercent += Number(ph.changePercent || 0);
      }
    }
    for (const ss of Object.values(supplierSpendMap)) {
      if (ss.priceChanges > 0) {
        ss.avgPriceChangePercent = Math.round((ss.avgPriceChangePercent / ss.priceChanges) * 100) / 100;
      }
    }

    const topSuppliers = Object.values(supplierSpendMap)
      .sort((a, b) => b.spend30 - a.spend30)
      .slice(0, 10);

    // 4. Wastage analysis
    type WasteItem = { productName: string; totalQty: number; totalCost: number; type: string };
    const wasteMap: Record<string, WasteItem> = {};
    let totalWasteCost = 0;

    for (const w of wastage30) {
      const product = productMap.get(w.productId);
      const key = w.productId;
      if (!wasteMap[key]) {
        wasteMap[key] = {
          productName: product?.name || "Unknown",
          totalQty: 0,
          totalCost: 0,
          type: w.adjustmentType,
        };
      }
      wasteMap[key].totalQty += Math.abs(Number(w.quantity));
      wasteMap[key].totalCost += Math.abs(Number(w.costAmount || 0));
      totalWasteCost += Math.abs(Number(w.costAmount || 0));
    }

    const topWaste = Object.values(wasteMap)
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10);

    // 5. Cash cycle analysis
    const totalPurchases30 = orders30.reduce((s, o) => s + Number(o.totalAmount), 0);
    const totalPurchases90 = orders90.reduce((s, o) => s + Number(o.totalAmount), 0);

    // Days Payable Outstanding approximation
    const paidInvoices = invoices.filter((i) => i.status === "PAID" && i.issueDate && i.dueDate);
    const overdueInvoices = invoices.filter((i) => i.status === "OVERDUE");
    const pendingInvoices = invoices.filter((i) => i.status === "PENDING" || i.status === "INITIATED");

    const totalPayables = pendingInvoices.reduce((s, i) => s + Number(i.amount), 0) +
      overdueInvoices.reduce((s, i) => s + Number(i.amount), 0);

    // Days Inventory Outstanding (value of inventory / daily COGS)
    const dailyCOGS = totalPurchases30 > 0 ? totalPurchases30 / 30 : 0;
    const daysInventoryOutstanding = dailyCOGS > 0 ? Math.round(totalStockValue / dailyCOGS) : 0;

    // Receiving discrepancies
    let totalOrdered = 0;
    let totalReceived = 0;
    for (const r of receivings30) {
      for (const item of r.items) {
        totalOrdered += Number(item.orderedQty);
        totalReceived += Number(item.receivedQty);
      }
    }
    const receivingAccuracy = totalOrdered > 0 ? Math.round((totalReceived / totalOrdered) * 100) : 100;

    // 6. Products with multiple suppliers (cost comparison)
    const multiSupplierProducts: {
      productName: string;
      suppliers: { name: string; unitCost: number; moq: number }[];
      savingsOpportunity: number;
    }[] = [];

    const productSupplierMap: Record<string, { name: string; unitCost: number; moq: number }[]> = {};
    for (const sp of supplierProducts) {
      const conv = sp.productPackage ? Number(sp.productPackage.conversionFactor) : 1;
      const unitCost = Math.round((Number(sp.price) / conv) * 100) / 100;
      if (!productSupplierMap[sp.productId]) productSupplierMap[sp.productId] = [];
      productSupplierMap[sp.productId].push({
        name: sp.supplier.name,
        unitCost,
        moq: Number(sp.moq) || 0,
      });
    }

    for (const [pid, suppliers] of Object.entries(productSupplierMap)) {
      if (suppliers.length < 2) continue;
      const product = productMap.get(pid);
      if (!product) continue;
      suppliers.sort((a, b) => a.unitCost - b.unitCost);
      const cheapest = suppliers[0].unitCost;
      const expensive = suppliers[suppliers.length - 1].unitCost;
      const monthlyUsage = productSalesMap[pid] || 0;
      const savings = monthlyUsage * (expensive - cheapest);
      if (savings > 0) {
        multiSupplierProducts.push({
          productName: product.name,
          suppliers,
          savingsOpportunity: Math.round(savings * 100) / 100,
        });
      }
    }
    multiSupplierProducts.sort((a, b) => b.savingsOpportunity - a.savingsOpportunity);

    // ─── Build AI prompt ────────────────────────────────────────────

    const analysisPrompt = `You are an inventory strategist and F&B operations consultant for Celsius Coffee, a Malaysian specialty coffee chain. Your goal is to provide actionable AI-driven decisions focused on THREE key areas:

1. **COST OPTIMISATION** — Reduce COGS, negotiate better prices, optimise order quantities
2. **NEGATIVE CASH CYCLE** — Pay suppliers AFTER revenue is collected. Extend payables, reduce inventory holding time
3. **INVENTORY OPTIMISATION** — Right-size stock levels, reduce waste, improve turnover

DATA CONTEXT:
- Currency: Malaysian Ringgit (RM)
- Business: Specialty coffee chain with ${outlets.length} outlets
- Outlets: ${outlets.map((o) => o.name).join(", ")}
- Analysis period: Last 30/90 days as of ${todayMYT}

═══ FINANCIAL OVERVIEW (Last 30 Days) ═══
- Sales Revenue: RM ${Math.round(totalSalesRevenue30).toLocaleString()} (${totalSalesOrders30} orders)
- Total Purchases: RM ${Math.round(totalPurchases30).toLocaleString()}
- Gross Margin: ${totalSalesRevenue30 > 0 ? Math.round(((totalSalesRevenue30 - totalPurchases30) / totalSalesRevenue30) * 100) : 0}%
- Wastage Cost: RM ${Math.round(totalWasteCost).toLocaleString()} (${totalSalesRevenue30 > 0 ? Math.round((totalWasteCost / totalSalesRevenue30) * 100 * 10) / 10 : 0}% of sales)

═══ CASH CYCLE METRICS ═══
- Total Inventory Value: RM ${Math.round(totalStockValue).toLocaleString()}
- Days Inventory Outstanding: ${daysInventoryOutstanding} days
- Outstanding Payables: RM ${Math.round(totalPayables).toLocaleString()}
- Overdue Invoices: ${overdueInvoices.length} (RM ${Math.round(overdueInvoices.reduce((s, i) => s + Number(i.amount), 0)).toLocaleString()})
- Paid Invoices (90d): ${paidInvoices.length}
- Daily COGS: RM ${Math.round(dailyCOGS).toLocaleString()}
- Purchases (90d): RM ${Math.round(totalPurchases90).toLocaleString()}

═══ INVENTORY HEALTH ═══
- Total Products Tracked: ${products.length}
- Stock Items: ${stockItems.length}
- Critical (out of stock with demand): ${criticalCount}
- Low Stock (below reorder point): ${lowCount}
- Overstock (>2x par): ${overstockCount}
- Dead Stock (no usage): ${deadStockCount}
- Receiving Accuracy: ${receivingAccuracy}%

═══ TOP SUPPLIERS BY SPEND (30d) ═══
${topSuppliers.map((s) => `- ${s.name}: RM${Math.round(s.spend30)} (${s.orderCount30} orders, lead time: ${s.leadTimeDays}d, price changes: ${s.priceChanges}, avg change: ${s.avgPriceChangePercent}%)`).join("\n")}

═══ STOCK STATUS ALERTS ═══
Critical Items: ${stockItems.filter((s) => s.status === "critical").slice(0, 10).map((s) => `${s.productName} @ ${s.outletName} (0 stock, uses ${s.avgDailyUsage}/day)`).join("; ") || "None"}
Overstock Items: ${stockItems.filter((s) => s.status === "overstock").slice(0, 10).map((s) => `${s.productName} @ ${s.outletName} (${s.daysOfStock}d stock, RM${s.stockValue})`).join("; ") || "None"}
Dead Stock Items: ${stockItems.filter((s) => s.status === "dead").slice(0, 10).map((s) => `${s.productName} @ ${s.outletName} (${s.quantity} units, RM${s.stockValue})`).join("; ") || "None"}

═══ TOP WASTAGE (30d) ═══
${topWaste.map((w) => `- ${w.productName}: ${w.totalQty} units, RM${Math.round(w.totalCost)} (${w.type})`).join("\n") || "No wastage recorded"}

═══ SUPPLIER PRICE COMPARISON OPPORTUNITIES ═══
${multiSupplierProducts.slice(0, 10).map((p) => `- ${p.productName}: ${p.suppliers.map((s) => `${s.name} RM${s.unitCost}/unit`).join(" vs ")} → potential monthly savings RM${p.savingsOpportunity}`).join("\n") || "No multi-supplier products found"}

═══ PRICE INFLATION ALERTS (90d) ═══
${priceHistory.length > 0 ? `${priceHistory.length} price changes detected. Increases: ${priceHistory.filter((p) => Number(p.changePercent) > 0).length}, Decreases: ${priceHistory.filter((p) => Number(p.changePercent) < 0).length}` : "No price changes recorded"}

Please provide your analysis as a JSON object with this structure:
{
  "decisions": [
    {
      "type": "cost_optimisation" | "cash_cycle" | "inventory_optimisation",
      "priority": "urgent" | "high" | "medium" | "low",
      "title": "short action title (max 80 chars)",
      "description": "2-3 sentence explanation of the decision and expected impact",
      "impact_rm": number or null (estimated RM impact per month),
      "action_items": ["specific step 1", "specific step 2"]
    }
  ],
  "health_score": {
    "overall": number (0-100),
    "cost_efficiency": number (0-100),
    "cash_cycle": number (0-100),
    "inventory_turnover": number (0-100),
    "waste_control": number (0-100)
  },
  "quick_wins": ["immediate action 1", "immediate action 2", "immediate action 3"],
  "cash_cycle_summary": "1-2 sentence summary of cash cycle position and key recommendation"
}

Provide 8-12 decisions covering all three areas. Be specific with product names and supplier names where relevant. Focus on ACTIONABLE decisions, not observations.

Return ONLY valid JSON, no markdown or explanation.`;

    // ─── Call Claude ─────────────────────────────────────────────────

    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 3000,
      messages: [{ role: "user", content: analysisPrompt }],
    });

    let aiResult: {
      decisions: unknown[];
      health_score: Record<string, number>;
      quick_wins: string[];
      cash_cycle_summary: string;
    } = {
      decisions: [],
      health_score: { overall: 0, cost_efficiency: 0, cash_cycle: 0, inventory_turnover: 0, waste_control: 0 },
      quick_wins: [],
      cash_cycle_summary: "",
    };

    try {
      const text = response.content[0].type === "text" ? response.content[0].text : "";
      const jsonStr = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      aiResult = JSON.parse(jsonStr);
    } catch {
      console.error("[ai-decisions] Failed to parse AI response");
    }

    // ─── Return combined response ───────────────────────────────────

    return NextResponse.json({
      ...aiResult,
      metrics: {
        salesRevenue30: Math.round(totalSalesRevenue30),
        totalPurchases30: Math.round(totalPurchases30),
        grossMarginPercent: totalSalesRevenue30 > 0
          ? Math.round(((totalSalesRevenue30 - totalPurchases30) / totalSalesRevenue30) * 100)
          : 0,
        totalStockValue: Math.round(totalStockValue),
        daysInventoryOutstanding,
        totalPayables: Math.round(totalPayables),
        wasteCost30: Math.round(totalWasteCost),
        receivingAccuracy,
        criticalItems: criticalCount,
        lowStockItems: lowCount,
        overstockItems: overstockCount,
        deadStockItems: deadStockCount,
        totalProducts: products.length,
        analysisDate: todayMYT,
      },
    });
  } catch (err) {
    console.error("[ai-decisions] Error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
