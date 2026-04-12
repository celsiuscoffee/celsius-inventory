"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useCartStore } from "@/store/cart";

const STORE_MAP: Record<string, { id: string; name: string; address: string }> = {
  "shah-alam": { id: "shah-alam", name: "Celsius Shah Alam", address: "Shah Alam, Selangor" },
  "conezion":  { id: "conezion",  name: "Celsius Conezion",  address: "Conezion, Putrajaya" },
  "tamarind":  { id: "tamarind",  name: "Celsius Tamarind Square", address: "Tamarind Square, Cyberjaya" },
};

/**
 * /table/[storeId]/[tableId]
 *
 * Customer scans QR at their table → lands here → auto-sets store + table
 * → redirects to menu. Example: /table/shah-alam/T3
 */
export default function TableLandingPage() {
  const router = useRouter();
  const params = useParams();
  const setSelectedStore = useCartStore((s) => s.setSelectedStore);
  const setDineIn = useCartStore((s) => s.setDineIn);

  const storeId = params.storeId as string;
  const tableId = (params.tableId as string)?.toUpperCase();
  const storeInfo = STORE_MAP[storeId];

  useEffect(() => {
    if (!storeInfo) return;

    // Set store context
    setSelectedStore({
      id: storeInfo.id,
      name: storeInfo.name,
      address: storeInfo.address,
      lat: 0,
      lng: 0,
      pickupTime: "~10 min",
      isOpen: true,
      isBusy: false,
    });

    // Set dine-in with table number
    setDineIn(tableId);

    // Redirect to menu
    router.replace(`/menu?store=${storeInfo.id}`);
  }, [storeInfo, tableId, setSelectedStore, setDineIn, router]);

  if (!storeInfo) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950 p-6">
        <div className="text-center">
          <p className="text-lg font-semibold text-white">Invalid QR Code</p>
          <p className="mt-2 text-sm text-gray-400">This table QR code is not recognized.</p>
          <a href="/" className="mt-4 inline-block rounded-lg bg-amber-600 px-6 py-2 text-sm font-medium text-white">
            Go to Home
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-950">
      <div className="text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
        <p className="mt-4 text-sm text-gray-400">Setting up Table {tableId}...</p>
      </div>
    </div>
  );
}
