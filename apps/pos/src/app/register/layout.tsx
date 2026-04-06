"use client";

import { POSProvider } from "@/lib/pos-context";

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <POSProvider>{children}</POSProvider>;
}
