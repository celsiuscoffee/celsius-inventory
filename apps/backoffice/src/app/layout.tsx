import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Celsius Ops — Backoffice",
  description: "Unified backoffice for Celsius Coffee",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
