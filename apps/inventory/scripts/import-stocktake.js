#!/usr/bin/env node
/**
 * Import stock balances from a CSV stocktake file.
 *
 * Usage:
 *   cd apps/inventory && node scripts/import-stocktake.js [path-to-csv]
 *
 * Default CSV path: /tmp/stocktake-march.csv
 */

const fs = require("fs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

// ── Config ──────────────────────────────────────────────────────────────────

const CSV_PATH = process.argv[2] || "/tmp/stocktake-march.csv";
const BRANCH_ID = "89b19c9f-b1e0-42fe-a404-6d1a472e34c5"; // Celsius Coffee Putrajaya (CONEZION)

// ── UOM conversion ──────────────────────────────────────────────────────────

// Spreadsheet UOM → { baseUom, factor }
const UOM_CONVERSIONS = {
  LITRE: { baseUom: "ml", factor: 1000 },
  KG: { baseUom: "g", factor: 1000 },
  GRAM: { baseUom: "g", factor: 1 },
  MILILITRE: { baseUom: "ml", factor: 1 },
  PCS: { baseUom: "pcs", factor: 1 },
  ROLL: { baseUom: "pcs", factor: 1 },
  BOTTLE: { baseUom: "pcs", factor: 1 },
  BDL: { baseUom: "pcs", factor: 1 },
};

// ── Parse the PER UNIT/PACK MEASUREMENT column ─────────────────────────────
// Examples: "1L", "500g", "2KG", "1000ml", "5000g", "0.5KG", "25pcs",
//           "1 loaf", "2 loaf", "pcs", "packet", "10 roll", "2 bdl"
// Returns the value in base UOM (ml or g or pcs).

function parsePerUnit(raw, spreadsheetUom) {
  if (!raw || !raw.trim()) return null;

  const s = raw.trim().toLowerCase();

  // Try to match number + unit patterns
  const match = s.match(
    /^([\d.]+)\s*(l|litre|litres|kg|g|gram|grams|ml|mililitre|pcs|roll|bdl|loaf|bottle)?$/i
  );

  if (match) {
    const value = parseFloat(match[1]);
    const unit = (match[2] || "").toLowerCase();

    if (isNaN(value)) return null;

    // Convert to base UOM based on detected unit
    switch (unit) {
      case "l":
      case "litre":
      case "litres":
        return value * 1000; // → ml
      case "kg":
        return value * 1000; // → g
      case "g":
      case "gram":
      case "grams":
        return value; // → g
      case "ml":
      case "mililitre":
        return value; // → ml
      case "pcs":
      case "roll":
      case "bdl":
      case "loaf":
      case "bottle":
        return value; // → pcs
      default:
        // No unit suffix — use the spreadsheet UOM to determine conversion
        return value * (UOM_CONVERSIONS[spreadsheetUom]?.factor ?? 1);
    }
  }

  // Handle bare unit words like "pcs", "packet"
  if (["pcs", "packet", "loaf", "roll", "bdl"].includes(s)) {
    return 1;
  }

  return null;
}

// ── CSV parsing ─────────────────────────────────────────────────────────────

function parseCSV(filePath) {
  const content = fs.readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter((l) => l.trim());

  // Skip header (line 0)
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const product = (cols[0] || "").trim();
    const uom = (cols[1] || "").trim().toUpperCase();
    const perUnit = (cols[2] || "").trim();
    const totalRaw = (cols[5] || "").trim();

    if (!product) continue;

    const total = parseFloat(totalRaw);
    if (isNaN(total) || total === 0) continue;

    rows.push({ product, uom, perUnit, total });
  }
  return rows;
}

// ── Aggregate duplicate product names ───────────────────────────────────────

function aggregateRows(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.product;
    if (map.has(key)) {
      const existing = map.get(key);
      existing.total += row.total;
    } else {
      map.set(key, { ...row });
    }
  }
  return Array.from(map.values());
}

// ── Name normalisation for fuzzy matching ───────────────────────────────────

function normalize(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "") // strip non-alphanumeric
    .replace(/sprinkle/g, "spinkle") // known CSV→DB variant
    .replace(/fettuccine/g, "fettucine") // possible variant
    .trim();
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n📂 Reading CSV: ${CSV_PATH}`);
  const rawRows = parseCSV(CSV_PATH);
  console.log(`   Parsed ${rawRows.length} non-zero rows from CSV`);

  const rows = aggregateRows(rawRows);
  console.log(`   After dedup: ${rows.length} unique products\n`);

  // Fetch all DB products
  const dbProducts = await prisma.product.findMany({
    where: { isActive: true },
    select: { id: true, name: true, baseUom: true },
  });
  console.log(`   ${dbProducts.length} active products in database\n`);

  // Build lookup maps
  const exactMap = new Map(); // lowercase name → product
  const normalizedMap = new Map(); // normalized name → product
  for (const p of dbProducts) {
    const lower = p.name.toLowerCase().trim();
    exactMap.set(lower, p);
    normalizedMap.set(normalize(p.name), p);
  }

  const matched = [];
  const unmatched = [];
  let imported = 0;

  for (const row of rows) {
    // 1. Try exact match (case-insensitive)
    let dbProduct = exactMap.get(row.product.toLowerCase().trim());

    // 2. Try normalized match
    if (!dbProduct) {
      dbProduct = normalizedMap.get(normalize(row.product));
    }

    // 3. Try partial/contains match (CSV name contained in DB name, or vice versa)
    if (!dbProduct) {
      const csvLower = row.product.toLowerCase().trim();
      const candidates = dbProducts.filter(
        (p) =>
          p.name.toLowerCase().includes(csvLower) ||
          csvLower.includes(p.name.toLowerCase())
      );
      if (candidates.length === 1) {
        dbProduct = candidates[0];
      } else if (candidates.length > 1) {
        // Pick first match for ambiguous cases
        dbProduct = candidates[0];
        console.log(
          `   ⚠️  Ambiguous match for "${row.product}" → picked "${dbProduct.name}" (${candidates.length} candidates)`
        );
      }
    }

    if (!dbProduct) {
      unmatched.push(row.product);
      continue;
    }

    // Calculate base quantity
    const conversion = UOM_CONVERSIONS[row.uom];
    if (!conversion) {
      console.log(`   ❌ Unknown UOM "${row.uom}" for "${row.product}" — skipping`);
      unmatched.push(`${row.product} (unknown UOM: ${row.uom})`);
      continue;
    }

    let baseQty;
    const perUnitValue = parsePerUnit(row.perUnit, row.uom);

    if (perUnitValue !== null) {
      // TOTAL = number of packs × per-unit-value-in-base-uom
      baseQty = row.total * perUnitValue;
    } else {
      // No per-unit info — TOTAL is already in spreadsheet UOM, convert directly
      baseQty = row.total * conversion.factor;
    }

    // Round to 2 decimal places to avoid floating point issues
    baseQty = Math.round(baseQty * 100) / 100;

    matched.push({
      csvName: row.product,
      dbName: dbProduct.name,
      dbId: dbProduct.id,
      csvTotal: row.total,
      uom: row.uom,
      perUnit: row.perUnit || "(none)",
      baseQty,
      baseUom: dbProduct.baseUom,
    });
  }

  // Print matches
  console.log("─── MATCHED PRODUCTS ──────────────────────────────────────────");
  for (const m of matched) {
    const arrow =
      m.csvName.toLowerCase() !== m.dbName.toLowerCase() ? " → " + m.dbName : "";
    console.log(
      `   ✅ ${m.csvName}${arrow}: ${m.csvTotal} ${m.uom} (per-unit: ${m.perUnit}) → ${m.baseQty} ${m.baseUom}`
    );
  }

  // Print unmatched
  if (unmatched.length > 0) {
    console.log("\n─── UNMATCHED PRODUCTS ────────────────────────────────────────");
    for (const name of unmatched) {
      console.log(`   ❌ ${name}`);
    }
  }

  // Upsert stock balances
  console.log("\n─── IMPORTING STOCK BALANCES ──────────────────────────────────");
  for (const m of matched) {
    try {
      await prisma.stockBalance.upsert({
        where: {
          branchId_productId: {
            branchId: BRANCH_ID,
            productId: m.dbId,
          },
        },
        update: {
          quantity: m.baseQty,
          lastUpdated: new Date(),
        },
        create: {
          branchId: BRANCH_ID,
          productId: m.dbId,
          quantity: m.baseQty,
        },
      });
      imported++;
      console.log(`   ✅ ${m.dbName}: ${m.baseQty} ${m.baseUom}`);
    } catch (err) {
      console.error(`   ❌ Failed to upsert "${m.dbName}": ${err.message}`);
    }
  }

  // Summary
  console.log("\n═══ SUMMARY ═══════════════════════════════════════════════════");
  console.log(`   Total CSV rows (non-zero):  ${rawRows.length}`);
  console.log(`   Unique products:            ${rows.length}`);
  console.log(`   Matched:                    ${matched.length}`);
  console.log(`   Unmatched:                  ${unmatched.length}`);
  console.log(`   Imported:                   ${imported}`);
  console.log("═══════════════════════════════════════════════════════════════\n");
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
