"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const NAV = [
  { href: "/store-orders", label: "Order Queue", icon: "orders" },
  { href: "/store-orders/history", label: "Order History", icon: "history" },
  { href: "/store-orders/inventory", label: "Inventory", icon: "inventory" },
  { href: "/store-orders/menu-ingredients", label: "Menu Ingredients", icon: "recipes" },
];
const ACCENT = "#7c4a1e";

export default function StoreOrderStaffLayout({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [profile, setProfile] = useState<{ full_name: string | null } | null>(null);

  useEffect(() => {
    if (!loading && (!user || (role !== "barista" && role !== "admin"))) router.replace("/");
  }, [loading, role, router, user]);

  useEffect(() => {
    if (!user) return;
    void supabase.from("user_accounts").select("full_name").eq("id", user.id).single()
      .then(({ data }) => setProfile(data));
  }, [user]);

  async function logout() {
    if (!window.confirm("Log out of the barista account?")) return;
    await supabase.auth.signOut();
    router.push("/");
  }

  const pageLabel = NAV.find((item) => item.href === pathname)?.label
    || NAV.find((item) => item.href !== "/store-orders" && pathname.startsWith(item.href))?.label
    || "Order Queue";

  if (loading) return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", background: "#f8f5f0", color: ACCENT }}>Loading barista workspace…</div>;

  return <div style={{ minHeight: "100vh", background: "#f8f5f0", color: "#1a1008", fontFamily: "Arial, sans-serif" }}>
    <aside style={{ width: 238, background: "#1a1008", color: "#fff", display: "flex", flexDirection: "column", position: "fixed", inset: "0 auto 0 0", zIndex: 100 }}>
      <div style={{ padding: "20px 18px 17px", borderBottom: "1px solid rgba(255,255,255,.08)" }}>
        <Image src="/brewora_logo.png" alt="Brewora" width={136} height={48} style={{ objectFit: "contain" }} />
        <div style={{ color: "#c49a6c", fontSize: 10, fontWeight: 800, letterSpacing: "2px", textTransform: "uppercase", marginTop: 6 }}>BARISTA WORKSPACE</div>
      </div>
      <nav aria-label="Barista navigation" style={{ flex: 1, padding: "14px 0", overflowY: "auto" }}>
        <div style={{ padding: "4px 18px 10px", color: "#806b59", fontSize: 10, fontWeight: 800, letterSpacing: "1.5px", textTransform: "uppercase" }}>Workspace</div>
        {NAV.map((item) => {
          const active = item.href === "/store-orders" ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
          return <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 18px", marginRight: active ? 10 : 0, borderRadius: active ? "0 9px 9px 0" : 0, background: active ? ACCENT : "transparent", color: active ? "#fff" : "#b6a391", textDecoration: "none", fontSize: 13, fontWeight: active ? 750 : 500, transition: "background .15s, color .15s" }}>
            <NavIcon name={item.icon} />{item.label}
          </Link>;
        })}
        <div style={{ height: 1, background: "rgba(255,255,255,.08)", margin: "10px 18px" }} />
        <button type="button" onClick={() => void logout()} style={{ display: "flex", alignItems: "center", gap: 11, width: "100%", padding: "11px 18px", border: 0, background: "transparent", color: "#b6a391", cursor: "pointer", textAlign: "left", fontSize: 13 }}>
          <NavIcon name="logout" />Logout
        </button>
      </nav>
      <div style={{ margin: "0 12px 14px", padding: 13, borderRadius: 12, background: "rgba(255,255,255,.06)", color: "#c4b3a3", fontSize: 12, lineHeight: 1.5 }}>
        <div style={{ color: "#fff", fontWeight: 800, marginBottom: 3 }}>Store operations</div>
        Prepare orders and check ingredient availability.
      </div>
    </aside>

    <div style={{ marginLeft: 238, minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header style={{ position: "sticky", top: 0, zIndex: 50, height: 66, padding: "0 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, background: "#fff", borderBottom: "1px solid #ede8e3" }}>
        <div>
          <div style={{ color: "#1a1008", fontSize: 17, fontWeight: 800 }}>{pageLabel}</div>
          <div style={{ color: "#a89080", fontSize: 12, marginTop: 2 }}>Store order preparation and inventory</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, display: "grid", placeItems: "center", borderRadius: "50%", background: ACCENT, color: "#fff", fontSize: 15, fontWeight: 800 }}>
            {profile?.full_name?.trim()?.[0]?.toUpperCase() || "B"}
          </div>
          <div>
            <div style={{ color: "#1a1008", fontSize: 13, fontWeight: 750 }}>{profile?.full_name || "Barista"}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 2, color: "#927f70", fontSize: 11 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e" }} />Barista · In-store</div>
          </div>
        </div>
      </header>
      <main style={{ flex: 1, width: "100%", maxWidth: 1600, margin: "0 auto", padding: "24px 28px", boxSizing: "border-box" }}>{children}</main>
    </div>
  </div>;
}

function NavIcon({ name }: { name: string }) {
  const common = { width: 17, height: 17, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (name === "orders") return <svg {...common}><path d="M8 4H6a2 2 0 0 0-2 2v14h16V6a2 2 0 0 0-2-2h-2"/><rect x="8" y="2" width="8" height="4" rx="1"/><path d="M8 11h8M8 15h6"/></svg>;
  if (name === "history") return <svg {...common}><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></svg>;
  if (name === "inventory") return <svg {...common}><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></svg>;
  if (name === "recipes") return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13"/><path d="M3 6h.01M3 12h.01M3 18h.01" strokeWidth="3"/></svg>;
  return <svg {...common}><path d="M10 17l5-5-5-5M15 12H3"/><path d="M12 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6"/></svg>;
}
