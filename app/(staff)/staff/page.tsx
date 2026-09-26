"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

type RecentOrder = { id: string; order_type: string; total_amount: number; created_at: string; user_accounts: { full_name: string } | null };

export default function StaffDashboard() {
  const [data, setData] = useState({
    pending: 0, confirmed: 0, preparing: 0, ready: 0, out_for_delivery: 0,
    completed_today: 0, total_today: 0, sales_today: 0, sales_week: 0, sales_month: 0,
    pickup_today: 0, delivery_today: 0,
  });
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
    const ch = supabase.channel("staff-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function load() {
    const now = new Date();
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - 7);
    const monthStart = new Date(now); monthStart.setDate(now.getDate() - 30);
    const types = ["pickup", "delivery"];

    const [
      { count: pending }, { count: confirmed }, { count: preparing },
      { count: ready }, { count: out_for_delivery },
      { data: todayOrders }, { data: weekOrders }, { data: monthOrders },
      { data: recentCompleted },
    ] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "pending").in("order_type", types),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "confirmed").in("order_type", types),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "preparing").in("order_type", types),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "ready").in("order_type", types),
      supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "out_for_delivery").in("order_type", types),
      supabase.from("orders").select("status, total_amount, order_type").in("order_type", types).gte("created_at", todayStart.toISOString()),
      supabase.from("orders").select("total_amount").in("order_type", types).gte("created_at", weekStart.toISOString()).neq("status", "cancelled"),
      supabase.from("orders").select("total_amount").in("order_type", types).gte("created_at", monthStart.toISOString()).neq("status", "cancelled"),
      supabase.from("orders").select("id, order_type, total_amount, created_at, user_accounts(full_name)").in("order_type", types).eq("status", "delivered").order("created_at", { ascending: false }).limit(5),
    ]);

    const todayArr = todayOrders ?? [];
    const completed_today = todayArr.filter((o: { status: string }) => o.status === "delivered").length;
    const sales_today = todayArr.filter((o: { status: string }) => o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const sales_week = (weekOrders ?? []).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const sales_month = (monthOrders ?? []).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const pickup_today = todayArr.filter((o: { order_type: string }) => o.order_type === "pickup").length;
    const delivery_today = todayArr.filter((o: { order_type: string }) => o.order_type === "delivery").length;

    setData({ pending: pending ?? 0, confirmed: confirmed ?? 0, preparing: preparing ?? 0, ready: ready ?? 0, out_for_delivery: out_for_delivery ?? 0, completed_today, total_today: todayArr.length, sales_today, sales_week, sales_month, pickup_today, delivery_today });
    setRecent((recentCompleted as unknown as RecentOrder[]) ?? []);
    setLoading(false);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading...</div>;

  const statusCards = [
    { label: "Pending", value: data.pending, bg: "#fff8f0", color: "#d97706", icon: "📋" },
    { label: "Confirmed", value: data.confirmed, bg: "#eff6ff", color: "#3b82f6", icon: "✔️" },
    { label: "Preparing", value: data.preparing, bg: "#fff7ed", color: "#f97316", icon: "👨🍳" },
    { label: "Ready / Out", value: data.ready + data.out_for_delivery, bg: "#f0fdf4", color: "#22c55e", icon: "🚀" },
  ];

  const salesCards = [
    { label: "Online Sales Today", value: peso(data.sales_today), icon: "💰" },
    { label: "This Week", value: peso(data.sales_week), icon: "📅" },
    { label: "This Month", value: peso(data.sales_month), icon: "📊" },
  ];

  return (
    <div>
      {/* Status Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "16px", marginBottom: "18px" }}>
        {statusCards.map((c) => (
          <div key={c.label} style={{ background: "#fff", borderRadius: "14px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${c.color}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: c.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>{c.icon}</div>
              <div>
                <div style={{ fontSize: "12px", color: "#a89080", fontWeight: 500, marginBottom: "2px" }}>{c.label}</div>
                <div style={{ fontSize: "30px", fontWeight: 900, color: "#1a1008", lineHeight: 1 }}>{c.value}</div>
              </div>
            </div>
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
                <div style={{ fontSize: "22px", fontWeight: 900, color: ACCENT, lineHeight: 1 }}>{c.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "20px" }}>
        {/* Today's Summary */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008", marginBottom: "16px" }}>Today&apos;s Online Orders Summary</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {[
              { label: "Total Online Orders", value: data.total_today, color: "#1a1008", icon: "📦" },
              { label: "Pickup Orders", value: data.pickup_today, color: "#6366f1", icon: "🏪" },
              { label: "Delivery Orders", value: data.delivery_today, color: "#f97316", icon: "🛵" },
              { label: "Sales Today", value: peso(data.sales_today), color: ACCENT, icon: "💰" },
              { label: "Pending", value: data.pending, color: "#f59e0b", icon: "⏳" },
              { label: "Out for Delivery", value: data.out_for_delivery, color: "#9333ea", icon: "🚴" },
              { label: "Completed", value: data.completed_today, color: "#22c55e", icon: "✅" },
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
          <Link href="/staff/orders" style={{ display: "block", marginTop: "16px", background: ACCENT, color: "#fff", borderRadius: "8px", padding: "12px", textAlign: "center", fontWeight: 800, fontSize: "14px", textDecoration: "none" }}>
            Manage Online Orders →
          </Link>
        </div>

        {/* Recently Completed */}
        <div style={{ background: "#fff", borderRadius: "14px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Recently Completed</div>
            <Link href="/staff/order-history" style={{ fontSize: "12px", color: ACCENT, fontWeight: 700, textDecoration: "none" }}>View All</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {recent.length === 0 && <p style={{ color: "#aaa", fontSize: "13px" }}>No completed orders yet.</p>}
            {recent.map((o) => (
              <div key={o.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f1ebe5" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{ width: "20px", height: "20px", borderRadius: "50%", background: "#22c55e", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                  <div>
                    <div style={{ fontSize: "12px", fontWeight: 700, color: "#1a1008" }}>#{o.id.slice(0, 8).toUpperCase()}</div>
                    <div style={{ fontSize: "11px", color: "#a89080", display: "flex", alignItems: "center", gap: "4px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "1px 6px", borderRadius: "10px", background: o.order_type === "pickup" ? "#ede9fe" : "#fff7ed", color: o.order_type === "pickup" ? "#6366f1" : "#f97316", textTransform: "capitalize" }}>{o.order_type}</span>
                      {o.user_accounts?.full_name || "Guest"}
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
