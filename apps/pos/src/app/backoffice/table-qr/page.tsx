"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import QRCode from "qrcode";

const OUTLETS = [
  { id: "shah-alam", name: "Celsius Shah Alam" },
  { id: "conezion", name: "Celsius Conezion" },
  { id: "tamarind", name: "Celsius Tamarind Square" },
] as const;

const BASE_URL = "https://order.celsiuscoffee.com";

function buildTableUrl(outletId: string, tableId: string) {
  return `${BASE_URL}/table/${outletId}/${tableId}`;
}

export default function TableQRPage() {
  const [selectedOutlet, setSelectedOutlet] = useState<string>(OUTLETS[0].id);
  const [tableCount, setTableCount] = useState(10);
  const [generated, setGenerated] = useState(false);
  const canvasRefs = useRef<Map<string, HTMLCanvasElement>>(new Map());
  const printRef = useRef<HTMLDivElement>(null);

  const tables = Array.from({ length: tableCount }, (_, i) => `T${i + 1}`);
  const outletName = OUTLETS.find((o) => o.id === selectedOutlet)?.name ?? "";

  const generate = useCallback(() => {
    setGenerated(true);
  }, []);

  // Render QR codes into canvases after generation
  useEffect(() => {
    if (!generated) return;
    tables.forEach((tableId) => {
      const canvas = canvasRefs.current.get(tableId);
      if (!canvas) return;
      const url = buildTableUrl(selectedOutlet, tableId);
      QRCode.toCanvas(canvas, url, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#ffffff" },
      });
    });
  }, [generated, selectedOutlet, tableCount]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePrint = () => {
    window.print();
  };

  const downloadSingle = async (tableId: string) => {
    const url = buildTableUrl(selectedOutlet, tableId);
    const dataUrl = await QRCode.toDataURL(url, { width: 400, margin: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${selectedOutlet}-${tableId}.png`;
    a.click();
  };

  return (
    <div className="p-6">
      <h1 className="text-xl font-bold text-text">Table QR Codes</h1>
      <p className="mt-1 text-sm text-text-muted">
        Generate QR codes for dine-in table ordering. Customers scan → see menu → order & pay on their phone.
      </p>

      {/* Controls */}
      <div className="mt-6 flex flex-wrap items-end gap-4 print:hidden">
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">Outlet</label>
          <select
            value={selectedOutlet}
            onChange={(e) => { setSelectedOutlet(e.target.value); setGenerated(false); }}
            className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text"
          >
            {OUTLETS.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-text-muted">Number of Tables</label>
          <input
            type="number"
            min={1}
            max={50}
            value={tableCount}
            onChange={(e) => { setTableCount(Math.max(1, Math.min(50, Number(e.target.value)))); setGenerated(false); }}
            className="w-24 rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text"
          />
        </div>
        <button
          onClick={generate}
          className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-white hover:bg-brand/90"
        >
          Generate QR Codes
        </button>
        {generated && (
          <button
            onClick={handlePrint}
            className="rounded-lg border border-border px-5 py-2 text-sm font-medium text-text hover:bg-surface-hover"
          >
            Print All
          </button>
        )}
      </div>

      {/* QR Grid */}
      {generated && (
        <div ref={printRef} className="mt-8 grid grid-cols-2 gap-6 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 print:grid-cols-3 print:gap-4">
          {tables.map((tableId) => {
            const url = buildTableUrl(selectedOutlet, tableId);
            return (
              <div
                key={tableId}
                className="flex flex-col items-center rounded-xl border border-border bg-white p-4 print:break-inside-avoid print:border print:shadow-none"
              >
                <canvas
                  ref={(el) => { if (el) canvasRefs.current.set(tableId, el); }}
                  className="h-[200px] w-[200px]"
                />
                <p className="mt-3 text-lg font-bold text-gray-900">{tableId}</p>
                <p className="text-xs text-gray-500">{outletName}</p>
                <p className="mt-1 max-w-[180px] truncate text-[10px] text-gray-400">{url}</p>
                <button
                  onClick={() => downloadSingle(tableId)}
                  className="mt-2 text-xs text-brand hover:underline print:hidden"
                >
                  Download PNG
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
