"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Navbar } from "@/components/Navbar";
import { useAuth } from "@/store/auth";

const TRAVELER_ONLY_PREFIXES = ["/discover", "/trips", "/messages", "/groups"];

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const token = useAuth((s) => s.token);
  const role = useAuth((s) => s.user?.role);
  const isAdmin = role?.toLowerCase() === "admin";
  const [ready, setReady] = useState(false);

  const isTravelerOnlyRoute = TRAVELER_ONLY_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix + "/")
  );

  // Wait for the persisted session to load before deciding whether to redirect.
  useEffect(() => {
    if (useAuth.persist.hasHydrated()) setReady(true);
    return useAuth.persist.onFinishHydration(() => setReady(true));
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!token) {
      router.replace("/login");
    } else if (isAdmin && isTravelerOnlyRoute) {
      router.replace("/moderation");
    }
  }, [ready, token, isAdmin, isTravelerOnlyRoute, router]);

  if (!ready || !token) return null;
  if (isAdmin && isTravelerOnlyRoute) return null;

  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </>
  );
}
