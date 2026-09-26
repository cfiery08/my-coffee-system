"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b", confirmed: "#3b82f6", preparing: "#f97316",
  ready: "#22c55e", delivered: "#94a3b8", cancelled: "#ef4444",
};
const STATUS_LABEL: Record<string, string> = {
  pending: "Pending", confirmed: "Confirmed", preparing: "Preparing",
  ready: "Ready", delivered: "Delivered", cancelled: "Cancelled",
};

type RecentOrder = { id: string; status: string; total_amount: number; created_at: string; user_accounts: { full_name: string } | null; order_items: { id: string }[] };
type PopularItem = { menu_item_id: string; menu_item_name: string; count: number };

export default function AdminDashboard() {
  const [stats, setStats] = useState({ orders: 0, revenue: 0, customers: 0, menuItems: 0 });
  const [salesChart, setSalesChart] = useState<{ day: string; revenue: number }[]>([]);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({});
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [popularItems, setPopularItems] = useState<PopularItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const ci = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(ci);
  }, []);

  useEffect(() => {
    load();
    const channel = supabase.channel("admin-dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  async function load() {
    const [
      { count: orderCount },
      { data: revenueData },
      { count: customerCount },
      { count: menuCount },
      { data: orders },
      { data: orderItems },
    ] = await Promise.all([
      supabase.from("orders").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("total_amount").neq("status", "cancelled"),
      supabase.from("user_accounts").select("*", { count: "exact", head: true }).eq("role", "customer"),
      supabase.from("menu_items").select("*", { count: "exact", head: true }),
      supabase.from("orders").select("id, status, total_amount, created_at, user_accounts(full_name), order_items(id)").order("created_at", { ascending: false }).limit(6),
      supabase.from("order_items").select("menu_item_id, menu_item_name"),
    ]);

    const revenue = (revenueData ?? []).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    setStats({ orders: orderCount ?? 0, revenue, customers: customerCount ?? 0, menuItems: menuCount ?? 0 });
    setRecentOrders((orders as unknown as RecentOrder[]) ?? []);

    // Status counts
    const sc: Record<string, number> = {};
    (orders as unknown as RecentOrder[] ?? []).forEach(() => {});
    const { data: allOrders } = await supabase.from("orders").select("status");
    (allOrders ?? []).forEach((o: { status: string }) => { sc[o.status] = (sc[o.status] || 0) + 1; });
    setStatusCounts(sc);

    // Sales chart — last 7 days
    const chart = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = new Date(d); ds.setHours(0, 0, 0, 0);
      const de = new Date(d); de.setHours(23, 59, 59, 999);
      const { data: dayOrders } = await supabase.from("orders").select("total_amount").gte("created_at", ds.toISOString()).lte("created_at", de.toISOString()).neq("status", "cancelled");
      const rev = (dayOrders ?? []).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
      chart.push({ day: d.toLocaleDateString("en", { weekday: "short" }), revenue: rev });
    }
    setSalesChart(chart);

    // Popular items
    const itemMap: Record<string, { name: string; count: number }> = {};
    (orderItems ?? []).forEach((i: { menu_item_id: string; menu_item_name: string }) => {
      if (!itemMap[i.menu_item_id]) itemMap[i.menu_item_id] = { name: i.menu_item_name, count: 0 };
      itemMap[i.menu_item_id].count++;
    });
    const popular = Object.entries(itemMap).map(([id, v]) => ({ menu_item_id: id, menu_item_name: v.name, count: v.count }))
      .sort((a, b) => b.count - a.count).slice(0, 5);
    setPopularItems(popular);
    setLoading(false);
  }

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "60vh", flexDirection: "column", gap: "16px" }}>
      <div style={{ width: "40px", height: "40px", border: "3px solid #ede8e3", borderTop: `3px solid ${ACCENT}`, borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <p style={{ color: "#a89080", fontSize: "14px" }}>Loading dashboard...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  // Chart SVG
  const chartData = salesChart.length >= 2 ? salesChart : [{ day: "", revenue: 0 }, { day: "", revenue: 0 }];
  const maxRev = Math.max(...chartData.map((d) => d.revenue), 1);
  const W = 580, H = 200, PAD = 30;
  const pts = chartData.map((d, i) => ({ x: PAD + (i / (chartData.length - 1)) * (W - PAD * 2), y: H - PAD - (d.revenue / maxRev) * (H - PAD * 2), ...d }));
  const polyline = pts.map((p) => `${p.x},${p.y}`).join(" ");
  const area = `${pts[0].x},${H - PAD} ${pts.map((p) => `${p.x},${p.y}`).join(" ")} ${pts[pts.length - 1].x},${H - PAD}`;

  // Donut
  const donutStatuses = ["pending", "preparing", "ready", "delivered"];
  const donutColors = ["#f59e0b", "#f97316", "#22c55e", "#94a3b8"];
  const donutTotal = donutStatuses.reduce((s, k) => s + (statusCounts[k] || 0), 0) || 1;
  const R = 70, CX = 90, CY = 90, strokeW = 28;
  let cumAngle = -Math.PI / 2;
  const donutSlices = donutStatuses.map((k, i) => {
    const val = statusCounts[k] || 0;
    const angle = (val / donutTotal) * 2 * Math.PI;
    const x1 = CX + R * Math.cos(cumAngle); const y1 = CY + R * Math.sin(cumAngle);
    cumAngle += angle;
    const x2 = CX + R * Math.cos(cumAngle); const y2 = CY + R * Math.sin(cumAngle);
    const large = angle > Math.PI ? 1 : 0;
    return { k, val, color: donutColors[i], d: `M ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2}`, angle };
  });

  const statCards = [
    { label: "Total Orders", value: stats.orders, bg: "#fdf6f0", iconBg: ACCENT, icon: <OrderIcon /> },
    { label: "Total Revenue", value: peso(stats.revenue), bg: "#fdf6f0", iconBg: "#d97706", icon: <DollarIcon /> },
    { label: "Customers", value: stats.customers, bg: "#f0fdf4", iconBg: "#22c55e", icon: <PeopleIcon /> },
    { label: "Menu Items", value: stats.menuItems, bg: "#f5f0ff", iconBg: "#8b5cf6", icon: <CoffeeIcon /> },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>

      {/* Stat Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "18px" }}>
        {statCards.map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ color: s.iconBg }}>{s.icon}</div>
              </div>
              <div>
                <div style={{ fontSize: "12px", color: "#a89080", fontWeight: 500, marginBottom: "4px" }}>{s.label}</div>
                <div style={{ fontSize: "24px", fontWeight: 900, color: "#1a1008", lineHeight: 1 }}>{s.value}</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sales Chart + Order Status */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "18px" }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008", marginBottom: "18px" }}>Sales Overview — Last 7 Days</div>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "220px" }}>
            {[0, 0.25, 0.5, 0.75, 1].map((t) => {
              const y = H - PAD - t * (H - PAD * 2);
              const val = Math.round(maxRev * t);
              return (<g key={t}><line x1={PAD} y1={y} x2={W - PAD} y2={y} stroke="#f1ebe5" strokeWidth="1" /><text x={PAD - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#a89080">{val >= 1000 ? (val / 1000).toFixed(1) + "K" : val}</text></g>);
            })}
            <polygon points={area} fill="url(#coffeeGrad)" opacity="0.2" />
            <polyline points={polyline} fill="none" stroke={ACCENT} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            {pts.map((p, i) => (<circle key={i} cx={p.x} cy={p.y} r="4" fill="#fff" stroke={ACCENT} strokeWidth="2.5" />))}
            {pts.map((p, i) => (<text key={i} x={p.x} y={H - 6} textAnchor="middle" fontSize="11" fill="#a89080">{p.day}</text>))}
            <defs><linearGradient id="coffeeGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} /><stop offset="100%" stopColor={ACCENT} stopOpacity="0" /></linearGradient></defs>
          </svg>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008", marginBottom: "18px" }}>Order Status</div>
          <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
            <svg viewBox="0 0 180 180" style={{ width: "160px", height: "160px" }}>
              {donutSlices.map((s, i) => s.angle > 0.01 ? (<path key={i} d={s.d} fill="none" stroke={s.color} strokeWidth={strokeW} strokeLinecap="butt" />) : null)}
              <text x={CX} y={CY - 6} textAnchor="middle" fontSize="22" fontWeight="900" fill="#1a1008">{donutTotal}</text>
              <text x={CX} y={CY + 14} textAnchor="middle" fontSize="11" fill="#a89080">Total</text>
            </svg>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {donutStatuses.map((k, i) => {
              const count = statusCounts[k] || 0;
              const pct = Math.round((count / donutTotal) * 100);
              return (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: donutColors[i], flexShrink: 0 }} />
                    <span style={{ fontSize: "12px", color: "#555" }}>{STATUS_LABEL[k]}</span>
                  </div>
                  <span style={{ fontSize: "12px", color: "#a89080", fontWeight: 600 }}>{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Orders + Popular Items */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "18px" }}>
        <div style={{ background: "#fff", borderRadius: "12px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Recent Orders</div>
            <Link href="/admin/orders" style={{ fontSize: "13px", color: ACCENT, fontWeight: 700, textDecoration: "none" }}>View All →</Link>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #f1ebe5" }}>
                {["Order ID", "Customer", "Items", "Amount", "Status", "Time"].map((h) => (
                  <th key={h} style={{ padding: "8px 10px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#a89080", textTransform: "uppercase", letterSpacing: "0.4px" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentOrders.length === 0 && (<tr><td colSpan={6} style={{ textAlign: "center", padding: "30px", color: "#aaa", fontSize: "13px" }}>No orders yet.</td></tr>)}
              {recentOrders.map((o) => {
                const secs = Math.round((now - new Date(o.created_at).getTime()) / 1000);
                const timeAgo = secs < 60 ? secs + "s ago" : secs < 3600 ? Math.floor(secs / 60) + " min ago" : Math.floor(secs / 3600) + " hr ago";
                const sc = STATUS_COLOR[o.status] || "#94a3b8";
                return (
                  <tr key={o.id} style={{ borderBottom: "1px solid #faf7f4" }}>
                    <td style={{ padding: "11px 10px", fontSize: "13px", fontWeight: 700, color: "#374151" }}>#{o.id.slice(0, 8).toUpperCase()}</td>
                    <td style={{ padding: "11px 10px", fontSize: "13px", color: "#374151" }}>{o.user_accounts?.full_name || "Guest"}</td>
                    <td style={{ padding: "11px 10px", fontSize: "13px", color: "#6b7280" }}>{o.order_items?.length || 0} item{o.order_items?.length !== 1 ? "s" : ""}</td>
                    <td style={{ padding: "11px 10px", fontSize: "13px", fontWeight: 600, color: "#374151" }}>{peso(o.total_amount)}</td>
                    <td style={{ padding: "11px 10px" }}><span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", background: sc + "20", color: sc, textTransform: "capitalize" }}>{o.status}</span></td>
                    <td style={{ padding: "11px 10px", fontSize: "12px", color: "#a89080" }}>{timeAgo}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div style={{ background: "#fff", borderRadius: "12px", padding: "22px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Popular Items</div>
            <Link href="/admin/menu" style={{ fontSize: "13px", color: ACCENT, fontWeight: 700, textDecoration: "none" }}>View Menu →</Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {popularItems.length === 0 && <p style={{ color: "#aaa", fontSize: "13px" }}>No order data yet.</p>}
            {popularItems.map((item, i) => (
              <div key={item.menu_item_id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "50%", background: i === 0 ? "#fef3c7" : "#f1ebe5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "13px", fontWeight: 800, color: i === 0 ? "#d97706" : "#a89080", flexShrink: 0 }}>{i + 1}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008" }}>{item.menu_item_name}</div>
                  <div style={{ fontSize: "11px", color: "#a89080", marginTop: "2px" }}>{item.count} orders</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrderIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/></svg>; }
function DollarIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v12M9 9h4.5a2.5 2.5 0 010 5H9a2.5 2.5 0 000 5H14"/></svg>; }
function PeopleIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>; }
function CoffeeIcon() { return <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8h1a4 4 0 010 8h-1"/><path d="M2 8h16v9a4 4 0 01-4 4H6a4 4 0 01-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>; }
