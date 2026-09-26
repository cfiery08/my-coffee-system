"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
type Period = "today" | "this_week" | "this_month" | "all_time";

const PERIODS: { label: string; value: Period }[] = [
  { label: "Today", value: "today" },
  { label: "This Week", value: "this_week" },
  { label: "This Month", value: "this_month" },
  { label: "All Time", value: "all_time" },
];

type TopItem = { menu_item_id: string; menu_item_name: string; qty: number; revenue: number };
type TopCustomer = { id: string; full_name: string; email: string; order_count: number; total_spent: number };

export default function AdminReportsPage() {
  const [period, setPeriod] = useState<Period>("this_month");
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState({ total: 0, dine_in: 0, pickup: 0, delivery: 0 });
  const [orders, setOrders] = useState({ total: 0, completed: 0, cancelled: 0, completion_rate: 0, cancellation_rate: 0 });
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; revenue: number }[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [statusBreakdown, setStatusBreakdown] = useState<Record<string, number>>({});

  useEffect(() => { load(); }, [period]);

  async function load() {
    setLoading(true);
    const now = new Date();
    let since: Date | null = null;
    if (period === "today") { since = new Date(now); since.setHours(0, 0, 0, 0); }
    else if (period === "this_week") { since = new Date(now); since.setDate(now.getDate() - 7); }
    else if (period === "this_month") { since = new Date(now); since.setDate(now.getDate() - 30); }

    let q = supabase.from("orders").select("id, status, order_type, total_amount, created_at, user_id");
    if (since) q = q.gte("created_at", since.toISOString());
    const { data: allOrders } = await q;
    const ords = allOrders ?? [];

    const totalRev = ords.filter((o) => o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const dineRev = ords.filter((o) => o.order_type === "dine_in" && o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const pickRev = ords.filter((o) => o.order_type === "pickup" && o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const delRev = ords.filter((o) => o.order_type === "delivery" && o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    setRevenue({ total: totalRev, dine_in: dineRev, pickup: pickRev, delivery: delRev });

    const total = ords.length;
    const completed = ords.filter((o) => o.status === "delivered").length;
    const cancelled = ords.filter((o) => o.status === "cancelled").length;
    setOrders({ total, completed, cancelled, completion_rate: total ? Math.round((completed / total) * 100) : 0, cancellation_rate: total ? Math.round((cancelled / total) * 100) : 0 });

    const sc: Record<string, number> = {};
    ords.forEach((o: { status: string }) => { sc[o.status] = (sc[o.status] || 0) + 1; });
    setStatusBreakdown(sc);

    // Daily revenue — last 30 days
    const daily = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = new Date(d); ds.setHours(0, 0, 0, 0);
      const de = new Date(d); de.setHours(23, 59, 59, 999);
      const rev = ords.filter((o: { created_at: string; status: string; total_amount: number }) => {
        const t = new Date(o.created_at);
        return t >= ds && t <= de && o.status !== "cancelled";
      }).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
      daily.push({ date: d.toLocaleDateString("en", { month: "short", day: "numeric" }), revenue: rev });
    }
    setDailyRevenue(daily);

    // Top items
    const orderIds = ords.map((o: { id: string }) => o.id);
    if (orderIds.length > 0) {
      const { data: items } = await supabase.from("order_items").select("menu_item_id, menu_item_name, quantity, subtotal").in("order_id", orderIds);
      const itemMap: Record<string, TopItem> = {};
      (items ?? []).forEach((i: { menu_item_id: string; menu_item_name: string; quantity: number; subtotal: number }) => {
        if (!itemMap[i.menu_item_id]) itemMap[i.menu_item_id] = { menu_item_id: i.menu_item_id, menu_item_name: i.menu_item_name, qty: 0, revenue: 0 };
        itemMap[i.menu_item_id].qty += i.quantity;
        itemMap[i.menu_item_id].revenue += i.subtotal;
      });
      setTopItems(Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10));
    } else { setTopItems([]); }

    // Top customers
    const custMap: Record<string, { order_count: number; total_spent: number }> = {};
    ords.filter((o: { status: string }) => o.status !== "cancelled").forEach((o: { user_id: string; total_amount: number }) => {
      if (!o.user_id) return;
      if (!custMap[o.user_id]) custMap[o.user_id] = { order_count: 0, total_spent: 0 };
      custMap[o.user_id].order_count++;
      custMap[o.user_id].total_spent += o.total_amount || 0;
    });
    const topCustIds = Object.entries(custMap).sort((a, b) => b[1].total_spent - a[1].total_spent).slice(0, 10).map(([id]) => id);
    if (topCustIds.length > 0) {
      const { data: custData } = await supabase.from("user_accounts").select("id, full_name, email").in("id", topCustIds);
      setTopCustomers((custData ?? []).map((u: { id: string; full_name: string; email: string }) => ({ ...u, ...custMap[u.id] })));
    } else { setTopCustomers([]); }

    setLoading(false);
  }

  // Revenue trend chart
  const maxRev = Math.max(...dailyRevenue.map((d) => d.revenue), 1);
  const RW = 600, RH = 160, PX = 10, PY = 20;
  const rpts = dailyRevenue.map((d, i) => ({ x: PX + (i / (dailyRevenue.length - 1)) * (RW - PX * 2), y: RH - PY - (d.revenue / maxRev) * (RH - PY * 2), ...d }));
  const rline = rpts.map((p) => `${p.x},${p.y}`).join(" ");
  const rarea = `${rpts[0]?.x},${RH - PY} ${rpts.map((p) => `${p.x},${p.y}`).join(" ")} ${rpts[rpts.length - 1]?.x},${RH - PY}`;
  const step = Math.ceil(dailyRevenue.length / 6);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
      {/* Header + period selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Analytics & Reports</h1>
          <p style={{ color: "#a89080", fontSize: "13px", marginTop: "2px" }}>Business performance overview</p>
        </div>
        <div style={{ display: "flex", gap: "4px", background: "#fff", borderRadius: "10px", padding: "4px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          {PERIODS.map((p) => (
            <button key={p.value} onClick={() => setPeriod(p.value)} style={{ padding: "7px 14px", borderRadius: "7px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 700, background: period === p.value ? ACCENT : "transparent", color: period === p.value ? "#fff" : "#555" }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#a89080" }}>Loading analytics...</div>
      ) : (<>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" }}>
          {[
            { label: "Total Revenue", value: peso(revenue.total), sub: `Dine-in ${peso(revenue.dine_in)} · Pickup ${peso(revenue.pickup)}`, color: ACCENT },
            { label: "Total Orders", value: String(orders.total), sub: `${orders.completed} completed · ${orders.cancelled} cancelled`, color: "#3b82f6" },
            { label: "Completion Rate", value: `${orders.completion_rate}%`, sub: `${orders.completed} completed orders`, color: "#22c55e" },
            { label: "Cancellation Rate", value: `${orders.cancellation_rate}%`, sub: `${orders.cancelled} cancelled orders`, color: "#f97316" },
          ].map((k) => (
            <div key={k.label} style={{ background: "#fff", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderTop: `3px solid ${k.color}` }}>
              <div style={{ fontSize: "12px", color: "#a89080", fontWeight: 600, marginBottom: "6px" }}>{k.label}</div>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#1a1008", lineHeight: 1, marginBottom: "6px" }}>{k.value}</div>
              <div style={{ fontSize: "11px", color: "#a89080" }}>{k.sub}</div>
            </div>
          ))}
        </div>

        {/* Revenue Trend + Order Breakdown */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "14px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#1a1008", marginBottom: "4px" }}>Revenue Trend</div>
            <div style={{ fontSize: "12px", color: "#a89080", marginBottom: "14px" }}>Daily breakdown (last 30 days)</div>
            <svg viewBox={`0 0 ${RW} ${RH}`} style={{ width: "100%", height: "160px" }}>
              <defs><linearGradient id="rg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={ACCENT} /><stop offset="100%" stopColor={ACCENT} stopOpacity="0" /></linearGradient></defs>
              {[0, 0.5, 1].map((t) => { const y = RH - PY - t * (RH - PY * 2); return <line key={t} x1={PX} y1={y} x2={RW - PX} y2={y} stroke="#f1ebe5" strokeWidth="1" />; })}
              <polygon points={rarea} fill="url(#rg)" opacity="0.2" />
              <polyline points={rline} fill="none" stroke={ACCENT} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
              {rpts.map((p, i) => i % step === 0 && (<text key={i} x={p.x} y={RH - 2} textAnchor="middle" fontSize="9" fill="#a89080">{p.date}</text>))}
            </svg>
          </div>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#1a1008", marginBottom: "14px" }}>Order Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {[
                { label: "Dine In", value: orders.total ? Math.round(((statusBreakdown.delivered || 0) / orders.total) * 100) : 0, color: ACCENT },
                { label: "Completed", value: orders.completion_rate, color: "#22c55e" },
                { label: "Cancelled", value: orders.cancellation_rate, color: "#94a3b8" },
              ].map((row) => (
                <div key={row.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                    <span style={{ fontWeight: 600, color: "#374151" }}>{row.label}</span>
                    <span style={{ color: row.color, fontWeight: 700 }}>{row.value}%</span>
                  </div>
                  <div style={{ height: "6px", background: "#f1ebe5", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${row.value}%`, background: row.color, borderRadius: "4px", transition: "width 0.4s" }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Top Items + Top Customers */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#1a1008", marginBottom: "14px" }}>Top Menu Items</div>
            {topItems.length === 0 && <p style={{ color: "#aaa", fontSize: "13px" }}>No order data yet.</p>}
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 60px 90px", gap: "8px", padding: "0 0 8px", borderBottom: "1px solid #f1ebe5", marginBottom: "6px" }}>
              {["#", "Item", "Sold", "Revenue"].map((h) => (<div key={h} style={{ fontSize: "11px", fontWeight: 700, color: "#a89080", textTransform: "uppercase" }}>{h}</div>))}
            </div>
            {topItems.map((item, i) => (
              <div key={item.menu_item_id} style={{ display: "grid", gridTemplateColumns: "24px 1fr 60px 90px", gap: "8px", padding: "8px 0", borderBottom: "1px solid #faf7f4", alignItems: "center" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: i === 0 ? "#fef3c7" : "#f1ebe5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, color: i === 0 ? "#d97706" : "#a89080" }}>{i + 1}</div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008" }}>{item.menu_item_name}</div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#374151" }}>{item.qty} pcs</div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: ACCENT }}>{peso(item.revenue)}</div>
              </div>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: "12px", padding: "20px 22px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ fontWeight: 800, fontSize: "15px", color: "#1a1008", marginBottom: "14px" }}>Top Customers</div>
            {topCustomers.length === 0 && <p style={{ color: "#aaa", fontSize: "13px" }}>No customer data yet.</p>}
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr 60px 90px", gap: "8px", padding: "0 0 8px", borderBottom: "1px solid #f1ebe5", marginBottom: "6px" }}>
              {["#", "Customer", "Orders", "Spent"].map((h) => (<div key={h} style={{ fontSize: "11px", fontWeight: 700, color: "#a89080", textTransform: "uppercase" }}>{h}</div>))}
            </div>
            {topCustomers.map((c, i) => (
              <div key={c.id} style={{ display: "grid", gridTemplateColumns: "24px 1fr 60px 90px", gap: "8px", padding: "8px 0", borderBottom: "1px solid #faf7f4", alignItems: "center" }}>
                <div style={{ width: "22px", height: "22px", borderRadius: "50%", background: i === 0 ? "#fef3c7" : "#f1ebe5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, color: i === 0 ? "#d97706" : "#a89080" }}>{i + 1}</div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008" }}>{c.full_name}</div>
                  <div style={{ fontSize: "11px", color: "#a89080" }}>{c.email}</div>
                </div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#374151" }}>{c.order_count}</div>
                <div style={{ fontWeight: 700, fontSize: "13px", color: ACCENT }}>{peso(c.total_spent)}</div>
              </div>
            ))}
          </div>
        </div>

      </>)}
    </div>
  );
}
