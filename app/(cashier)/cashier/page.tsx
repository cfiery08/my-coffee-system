"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type RecentOrder = { id: string; total_amount: number; created_at: string; table_number: string | null; user_accounts: { full_name: string } | null };

export default function CashierDashboard() {
  const [data, setData] = useState({ pending: 0, preparing: 0, ready: 0, completed_today: 0, total_today: 0, sales_today: 0, sales_week: 0, sales_month: 0 });
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const ch = supabase.channel("cashier-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30);

    const [
      { count: pending },
      { count: preparing },
      { count: ready },
      { data: todayOrders },
      { data: weekOrders },
      { data: monthOrders },
      { data: recentCompleted },
    ] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending").eq("order_type", "dine_in"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "preparing").eq("order_type", "dine_in"),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "ready").eq("order_type", "dine_in"),
      supabase.from("orders").select("status, total_amount").eq("order_type", "dine_in").gte("created_at", todayStart.toISOString()),
      supabase.from("orders").select("total_amount").eq("order_type", "dine_in").gte("created_at", weekStart.toISOString()).neq("status", "cancelled"),
      supabase.from("orders").select("total_amount").eq("order_type", "dine_in").gte("created_at", monthStart.toISOString()).neq("status", "cancelled"),
      supabase.from("orders").select("id, total_amount, created_at, table_number, user_accounts(full_name)").eq("order_type", "dine_in").eq("status", "delivered").order("created_at", { ascending: false }).limit(5),
    ]);

    const todayArr = todayOrders ?? [];
    const completed_today = todayArr.filter((o: { status: string }) => o.status === "delivered").length;
    const sales_today = todayArr.filter((o: { status: string }) => o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const sales_week = (weekOrders ?? []).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const sales_month = (monthOrders ?? []).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);

    setData({ pending: pending ?? 0, preparing: preparing ?? 0, ready: ready ?? 0, completed_today, total_today: todayArr.length, sales_today, sales_week, sales_month });
    setRecent((recentCompleted as unknown as RecentOrder[]) ?? []);
    setLoading(false);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading...</div>;

  const cards = [
    { label: "Pending", value: data.pending, sub: "Dine-in waiting", bg: "#fff8f0", icon: "📋" },
    { label: "Preparing", value: data.preparing, sub: "Being made now", bg: "#fff7ed", icon: "👨‍🍳" },
    { label: "Ready to Serve", value: data.ready, sub: "Ready at the counter", bg: "#f0fdf4", icon: "🛎️" },
    { label: "Served Today", value: data.completed_today, sub: "Completed dine-in", bg: "#f5f0ff", icon: "✅" },
  ];

  const salesCards = [
    { label: "Dine-In Sales Today", value: peso(data.sales_today), icon: "💰" },
    { label: "This Week", value: peso(data.sales_week), icon: "📅" },
    { label: "This Month", value: peso(data.sales_month), icon: "📊" },
  ];

  return (
    <div>
      {/* Quick action */}
      <div style={{ marginBottom: "20px" }}>
        <Link href="/cashier/pos" style={{
          display: "inline-flex", alignItems: "center", gap: "10px",
          background: ACCENT, color: "#fff", borderRadius: "10px",
          padding: "14px 24px", textDecoration: "none", fontWeight: 800, fontSize: "15px",
          boxShadow: "0 4px 14px rgba(124,74,30,0.35)",
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          New Dine-In Order (POS)
        </Link>
      </div>

      {/* Status Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "18px" }}>
        {cards.map((c) => (
          <div key={c.label} style={{ background: "#fff", borderRadius: "14px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "50px", height: "50px", borderRadius: "14px", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", flexShrink: 0 }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: "12px", color: "#a89080", fontWeight: 500, marginBottom: "2px" }}>{c.label}</div>
                <div style={{ fontSize: "30px", fontWeight: 900, color: "#1a1008", lineHeight: 1 }}>{c.value}</div>
              </div>
            </div>
            <div style={{ fontSize: "11px", color: "#a89080", marginTop: "8px" }}>{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Sales Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "22px" }}>
        {salesCards.map((c) => (
          <div key={c.label} style={{ background: "#fff", borderRadius: "14px", padding: "18px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "26px" }}>{c.icon}</span>
              <div>
                <div style={{ fontSize: "12px", color: "#a89080", fontWeight: 500, marginBottom: "2px" }}>{c.label}</div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: ACCENT, lineHeight: 1 }}>{c.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "20px" }}>
        {/* Today's Summary */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008", marginBottom: "16px" }}>Today&apos;s Dine-In Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { label: "Total Dine-In Orders", value: data.total_today, color: "#1a1008", icon: "📦" },
              { label: "Sales Today", value: peso(data.sales_today), color: ACCENT, icon: "💰" },
              { label: "Pending", value: data.pending, color: "#f59e0b", icon: "⏳" },
              { label: "Preparing", value: data.preparing, color: "#f97316", icon: "👨‍🍳" },
              { label: "Ready to Serve", value: data.ready, color: "#22c55e", icon: "🛎️" },
              { label: "Served", value: data.completed_today, color: "#8b5cf6", icon: "✅" },
            ].map((row) => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#faf7f4", borderRadius: "8px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <span style={{ fontSize: "16px" }}>{row.icon}</span>
                  <span style={{ fontSize: "13px", color: "#555", fontWeight: 500 }}>{row.label}</span>
                </div>
                <span style={{ fontSize: "16px", fontWeight: 800, color: row.color }}>{row.value}</span>
              </div>
            ))}
          </div>
          <Link href="/cashier/orders" style={{ display: "block", marginTop: "16px", background: ACCENT, color: "#fff", borderRadius: "8px", padding: "12px", textAlign: "center", fontWeight: 800, fontSize: "14px", textDecoration: "none" }}>
            View Dine-In Orders →
          </Link>
        </div>

        {/* Recently Served */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Recently Served</div>
            <Link href="/cashier/order-history" style={{ fontSize: "12px", color: ACCENT, fontWeight: 700, textDecoration: "none" }}>View All</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recent.length === 0 && <p style={{ color: "#aaa", fontSize: "13px" }}>No completed dine-in orders yet.</p>}
            {recent.map((o) => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1ebe5" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#1a1008" }}>#{o.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: "11px", color: "#a89080" }}>
                      {o.table_number ? `Table ${o.table_number}` : o.user_accounts?.full_name || "Walk-in"}
                    </div>
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: ACCENT }}>₱{Number(o.total_amount).toFixed(0)}</div>
                  <div style={{ fontSize: "11px", color: "#a89080" }}>{new Date(o.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
