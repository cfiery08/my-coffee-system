"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

const NAV = [
  { href: "/staff", label: "Dashboard", icon: <HomeIcon /> },
  { href: "/staff/orders", label: "Online Orders", icon: <OrderIcon /> },
  { href: "/staff/order-history", label: "Order History", icon: <HistoryIcon /> },
  { href: "/staff/menu-reference", label: "Menu Reference", icon: <MenuIcon /> },
];

const ACCENT = "#7c4a1e";
const SIDEBAR_BG = "#1a1008";

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, role, loading } = useAuth();
  const [profile, setProfile] = useState<{ full_name: string } | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!loading && (!user || (role !== "staff" && role !== "admin"))) router.replace("/");
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_accounts").select("full_name").eq("id", user.id).single().then(({ data }) => setProfile(data));
  }, [user]);

  useEffect(() => {
    fetchPending();
    const ch = supabase.channel("staff-pending")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchPending)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function fetchPending() {
    const { count } = await supabase.from("orders").select("*", { count: "exact", head: true })
      .eq("status", "pending").in("order_type", ["pickup", "delivery"]);
    setPendingCount(count ?? 0);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const pageLabel = NAV.find((n) => pathname === n.href)?.label
    || NAV.find((n) => n.href !== "/staff" && pathname.startsWith(n.href))?.label
    || "Dashboard";

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f8f5f0" }}>
      <div style={{ width: "36px", height: "36px", border: `3px solid #e8ddd4`, borderTop: `3px solid ${ACCENT}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#f8f5f0", fontFamily: "inherit" }}>

      {/* SIDEBAR */}
      <aside style={{ width: "230px", background: SIDEBAR_BG, display: "flex", flexDirection: "column", position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 100, flexShrink: 0 }}>

        <div style={{ padding: "20px 18px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)" }}>
          <Image src="/brewora_logo.png" alt="Brewora" width={130} height={46} style={{ objectFit: "contain" }} />
          <div style={{ color: ACCENT, fontSize: "10px", fontWeight: 700, letterSpacing: "2.5px", textTransform: "uppercase", marginTop: "4px" }}>ONLINE ORDER STAFF</div>
        </div>

        <nav style={{ flex: 1, padding: "10px 0", overflowY: "auto" }}>
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/staff" && pathname.startsWith(item.href));
            const showBadge = item.href === "/staff/orders" && pendingCount > 0;
            return (
              <Link key={item.href} href={item.href} style={{
                display: "flex", alignItems: "center", gap: "11px",
                padding: "11px 18px", textDecoration: "none",
                background: active ? ACCENT : "transparent",
                color: active ? "#fff" : "#a89080",
                fontSize: "13px", fontWeight: active ? 700 : 400,
                borderRadius: active ? "0 8px 8px 0" : "0",
                marginRight: active ? "10px" : "0",
                transition: "all 0.15s",
              }}>
                <span style={{ opacity: active ? 1 : 0.7, flexShrink: 0 }}>{item.icon}</span>
                {item.label}
                {showBadge && (
                  <span style={{ marginLeft: "auto", background: active ? "#fff" : "#ef4444", color: active ? ACCENT : "#fff", borderRadius: "20px", fontSize: "10px", fontWeight: 900, padding: "1px 7px", minWidth: "18px", textAlign: "center" }}>
                    {pendingCount}
                  </span>
                )}
              </Link>
            );
          })}

          <div style={{ height: "1px", background: "rgba(255,255,255,0.07)", margin: "8px 18px" }} />

          <button onClick={handleLogout} style={{ display: "flex", alignItems: "center", gap: "11px", padding: "11px 18px", background: "transparent", border: "none", color: "#a89080", fontSize: "13px", cursor: "pointer", width: "100%" }}>
            <LogoutIcon /> Logout
          </button>
        </nav>

        <div style={{ margin: "0 12px 14px", borderRadius: "12px", overflow: "hidden", position: "relative", minHeight: "110px" }}>
          <Image src="/homepage.png" alt="coffee" fill style={{ objectFit: "cover" }} />
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)" }} />
          <div style={{ position: "relative", zIndex: 2, padding: "14px 14px" }}>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: "12px", lineHeight: 1.4, marginBottom: "2px" }}>Great coffee.</div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: "12px", lineHeight: 1.4, marginBottom: "4px" }}>Happy customers.</div>
            <div style={{ color: ACCENT, fontSize: "16px" }}>☕</div>
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ marginLeft: "230px", flex: 1, display: "flex", flexDirection: "column", minHeight: "100vh" }}>

        <header style={{ background: "#fff", borderBottom: "1px solid #ede8e3", padding: "0 28px", height: "64px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 50 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: "17px", color: "#1a1008" }}>{pageLabel}</div>
            <div style={{ fontSize: "12px", color: "#a89080", marginTop: "1px" }}>Welcome back, {profile?.full_name?.split(" ")[0] || "Staff"}! 👋</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "40px", height: "40px", borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "15px", flexShrink: 0 }}>
              {profile?.full_name?.[0]?.toUpperCase() || "S"}
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008" }}>{profile?.full_name || "Staff"}</div>
              <div style={{ fontSize: "11px", color: "#a89080", display: "flex", alignItems: "center", gap: "4px" }}>
                <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#22c55e" }} />
                Staff · Online Orders
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: "24px 28px" }}>
          {children}
        </main>
      </div>
    </div>
  );
}

function HomeIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>; }
function OrderIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>; }
function HistoryIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 102.13-9.36L1 10"/></svg>; }
function MenuIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>; }
function LogoutIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>; }
