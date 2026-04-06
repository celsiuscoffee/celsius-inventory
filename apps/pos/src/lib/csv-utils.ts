import type { Product } from "@/types/database";

// ─── CSV Export ────────────────────────────────────────────

export function exportProductsCSV(products: Product[]): string {
  const headers = [
    "Product Name", "SKU", "Category", "Price (RM)", "Cost Price (RM)",
    "Tax Code", "Kitchen Station", "Track Stock", "Stock Level",
    "Available", "Featured", "Description", "Tags",
  ];

  const rows = products.map((p) => [
    p.name,
    p.sku ?? "",
    p.category ?? "",
    (p.price / 100).toFixed(2),
    p.cost ? (p.cost / 100).toFixed(2) : "",
    p.tax_code ?? "",
    p.kitchen_station ?? "",
    p.track_stock ? "1" : "0",
    p.stock_level?.toString() ?? "",
    p.is_available ? "1" : "0",
    p.is_featured ? "1" : "0",
    p.description ?? "",
    p.tags.join(";"),
  ]);

  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`;
    }
    return val;
  };

  const lines = [headers.map(escape).join(",")];
  for (const row of rows) {
    lines.push(row.map(escape).join(","));
  }
  return lines.join("\n");
}

export function downloadCSV(csv: string, filename: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ─── CSV Import (parse) ────────────────────────────────────

export type CSVRow = Record<string, string>;

export function parseCSV(text: string): { headers: string[]; rows: CSVRow[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length === 0) return { headers: [], rows: [] };

  const headers = parseCSVLine(lines[0]);
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const row: CSVRow = {};
    headers.forEach((h, j) => { row[h] = values[j] ?? ""; });
    rows.push(row);
  }

  return { headers, rows };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

export type ImportValidation = {
  valid: boolean;
  errors: { row: number; field: string; message: string }[];
  products: Partial<Product>[];
};

export function validateImport(rows: CSVRow[]): ImportValidation {
  const errors: ImportValidation["errors"] = [];
  const products: Partial<Product>[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2; // 1-indexed + header row

    if (!row["Product Name"]?.trim()) {
      errors.push({ row: rowNum, field: "Product Name", message: "Required" });
      continue;
    }

    const price = parseFloat(row["Price (RM)"] ?? "0");
    if (isNaN(price) || price < 0) {
      errors.push({ row: rowNum, field: "Price (RM)", message: "Invalid price" });
    }

    products.push({
      name: row["Product Name"].trim(),
      sku: row["SKU"]?.trim() || null,
      category: row["Category"]?.trim() || null,
      price: Math.round(price * 100),
      cost: row["Cost Price (RM)"] ? Math.round(parseFloat(row["Cost Price (RM)"]) * 100) : null,
      tax_code: row["Tax Code"]?.trim() || null,
      kitchen_station: row["Kitchen Station"]?.trim() || null,
      track_stock: row["Track Stock"] === "1",
      stock_level: row["Stock Level"] ? parseInt(row["Stock Level"]) : null,
      is_available: row["Available"] !== "0",
      is_featured: row["Featured"] === "1",
      description: row["Description"]?.trim() || null,
      tags: row["Tags"] ? row["Tags"].split(";").filter(Boolean) : [],
    });
  }

  return { valid: errors.length === 0, errors, products };
}
