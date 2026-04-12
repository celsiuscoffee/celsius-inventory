import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Celsius POS",
  description: "Celsius Coffee Point of Sale",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/images/celsius-logo-sm.jpg", type: "image/jpeg", sizes: "48x48" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-surface text-text antialiased dark">{children}</body>
    </html>
  );
}
