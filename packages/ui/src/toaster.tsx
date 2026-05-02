"use client";

// Wraps sonner's Toaster with brand-aligned defaults so apps don't have to
// configure tokens individually. Each app mounts <Toaster /> once in its
// root layout. Use the named `toast` export here (or import from sonner
// directly — same module) for fire-and-forget messages.
//
// Why sonner:
//  - already installed in pos + loyalty, so we standardize on what's there
//  - works server-component-friendly (renders in client island)
//  - supports promise toasts (toast.promise) which we'll want for slow ops

import { Toaster as Sonner, toast } from "sonner";
import type { ComponentProps } from "react";

type SonnerProps = ComponentProps<typeof Sonner>;

export function Toaster(props: SonnerProps) {
  return (
    <Sonner
      // Bottom-right is least disruptive on data-heavy admin screens; for
      // the loyalty + order apps which are mobile-first, sonner auto-flips
      // to top via media query — leave default position.
      position="bottom-right"
      richColors
      closeButton
      duration={4000}
      // Map sonner's CSS vars to our existing theme tokens so dark mode
      // and brand accent colors flow through without extra config.
      style={
        {
          "--normal-bg":   "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      toastOptions={{
        classNames: {
          toast:
            "rounded-xl ring-1 ring-foreground/10 shadow-lg font-sans text-sm",
          title: "font-medium",
          description: "text-muted-foreground",
        },
      }}
      {...props}
    />
  );
}

export { toast };
