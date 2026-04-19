import { BottomNav } from "@/components/bottom-nav";
import { ProfileFab } from "@/components/profile-fab";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto h-full max-w-lg">
      <ProfileFab />
      <main className="pb-24">{children}</main>
      <BottomNav />
    </div>
  );
}
