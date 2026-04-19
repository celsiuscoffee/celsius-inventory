"use client";

import Link from "next/link";
import { User } from "lucide-react";

// Small profile icon floating at top-right of the app. Replaces the
// dedicated Profile tab in the bottom nav — tapped rarely, doesn't need
// its own nav slot.
export function ProfileFab() {
  return (
    <Link
      href="/profile"
      aria-label="Profile"
      className="fixed right-3 top-[calc(env(safe-area-inset-top)+12px)] z-40 flex h-9 w-9 items-center justify-center rounded-full bg-white text-gray-600 shadow-md ring-1 ring-gray-200 active:scale-95"
    >
      <User className="h-4 w-4" />
    </Link>
  );
}
