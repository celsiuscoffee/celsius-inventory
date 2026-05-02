import type { Metadata } from "next";
import { Toaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Celsius POS",
  description: "Celsius Coffee Point of Sale",
  icons: {
    icon: "/icon.png",
    apple: "/images/celsius-logo-sm.jpg",
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
      <body className="bg-surface text-text antialiased dark">
        {children}
        <Toaster
          position="top-center"
          richColors
          closeButton
          duration={3500}
          toastOptions={{
            // POS runs on SUNMI tablets — bigger fonts/touch targets help.
            style: { fontSize: "1rem" },
          }}
        />
      </body>
    </html>
  );
}
