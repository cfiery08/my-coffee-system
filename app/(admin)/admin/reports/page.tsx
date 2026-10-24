"use client";
import { useCallback, useEffect, useState } from "react";
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
type ReportOrder = { id: string; status: string; order_type: string; order_source: "online" | "store"; total_amount: number; created_at: string; user_id: string | null };

export default function AdminReportsPage() {
  const [period, setPeriod] = useState<Period>("this_month");
  const [loading, setLoading] = useState(true);
  const [revenue, setRevenue] = useState({ total: 0, dine_in: 0, pickup: 0, delivery: 0 });
  const [orders, setOrders] = useState({ total: 0, completed: 0, cancelled: 0, completion_rate: 0, cancellation_rate: 0 });
  const [dailyRevenue, setDailyRevenue] = useState<{ date: string; revenue: number }[]>([]);
  const [topItems, setTopItems] = useState<TopItem[]>([]);
  const [topCustomers, setTopCustomers] = useState<TopCustomer[]>([]);
  const [sourceBreakdown, setSourceBreakdown] = useState({ online: { orders: 0, revenue: 0 }, store: { orders: 0, revenue: 0 } });
  const [loadError, setLoadError] = useState("");

  const load = useCallback(async (showLoading = true) => {
    if (showLoading) setLoading(true);
    setLoadError("");
    const now = new Date();
    let since: Date | null = null;
    if (period === "today") { since = new Date(now); since.setHours(0, 0, 0, 0); }
    else if (period === "this_week") { since = new Date(now); since.setDate(now.getDate() - 7); }
    else if (period === "this_month") { since = new Date(now); since.setDate(now.getDate() - 30); }

    const ords: ReportOrder[] = [];
    for (let offset = 0; ; offset += 1000) {
      let q = supabase.from("orders").select("id, status, order_type, order_source, total_amount, created_at, user_id").order("created_at", { ascending: true }).range(offset, offset + 999);
      if (since) q = q.gte("created_at", since.toISOString());
      const { data, error } = await q;
      if (error) { setLoadError(error.message); setLoading(false); return; }
      ords.push(...((data ?? []) as ReportOrder[]));
      if (!data || data.length < 1000) break;
    }

    const totalRev = ords.filter((o) => o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const dineRev = ords.filter((o) => o.order_type === "dine_in" && o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const pickRev = ords.filter((o) => (o.order_type === "pickup" || o.order_type === "takeout") && o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    const delRev = ords.filter((o) => o.order_type === "delivery" && o.status !== "cancelled").reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
    setRevenue({ total: totalRev, dine_in: dineRev, pickup: pickRev, delivery: delRev });

    const total = ords.length;
    const completed = ords.filter((o) => o.status === "delivered" || o.status === "completed").length;
    const cancelled = ords.filter((o) => o.status === "cancelled").length;
    setOrders({ total, completed, cancelled, completion_rate: total ? Math.round((completed / total) * 100) : 0, cancellation_rate: total ? Math.round((cancelled / total) * 100) : 0 });

    const bySource = { online: { orders: 0, revenue: 0 }, store: { orders: 0, revenue: 0 } };
    ords.forEach((order) => {
      const source = order.order_source === "store" ? "store" : "online";
      bySource[source].orders++;
      if (order.status !== "cancelled") bySource[source].revenue += Number(order.total_amount) || 0;
    });
    setSourceBreakdown(bySource);

    // Daily revenue — last 30 days
    let trendOrders = ords;
    if (period === "today" || period === "this_week") {
      const trendSince = new Date(); trendSince.setDate(trendSince.getDate() - 30);
      trendOrders = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("orders").select("status, total_amount, created_at").gte("created_at", trendSince.toISOString()).order("created_at", { ascending: true }).range(offset, offset + 999);
        if (error) { setLoadError(error.message); setLoading(false); return; }
        trendOrders.push(...((data ?? []) as typeof trendOrders));
        if (!data || data.length < 1000) break;
      }
    }

    const daily = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const ds = new Date(d); ds.setHours(0, 0, 0, 0);
      const de = new Date(d); de.setHours(23, 59, 59, 999);
      const rev = trendOrders.filter((o) => {
        const t = new Date(o.created_at);
        return t >= ds && t <= de && o.status !== "cancelled";
      }).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
      daily.push({ date: d.toLocaleDateString("en", { month: "short", day: "numeric" }), revenue: rev });
    }
    setDailyRevenue(daily);

    // Top items use only non-cancelled online and store orders.
    const orderIds = ords.filter((order) => order.status !== "cancelled").map((order) => order.id);
    const itemMap: Record<string, TopItem> = {};
    for (let start = 0; start < orderIds.length; start += 100) {
      const batch = orderIds.slice(start, start + 100);
      for (let offset = 0; ; offset += 1000) {
        const { data: items, error } = await supabase.from("order_items").select("menu_item_id, menu_item_name, quantity, subtotal").in("order_id", batch).range(offset, offset + 999);
        if (error) { setLoadError(error.message); setLoading(false); return; }
        (items ?? []).forEach((item) => {
          const key = item.menu_item_id || item.menu_item_name;
          if (!itemMap[key]) itemMap[key] = { menu_item_id: key, menu_item_name: item.menu_item_name, qty: 0, revenue: 0 };
          itemMap[key].qty += Number(item.quantity) || 0;
          itemMap[key].revenue += Number(item.subtotal) || 0;
        });
        if (!items || items.length < 1000) break;
      }
    }
    setTopItems(Object.values(itemMap).sort((a, b) => b.qty - a.qty).slice(0, 10));

    // Top customers
    const custMap: Record<string, { order_count: number; total_spent: number }> = {};
    ords.filter((o) => o.status !== "cancelled").forEach((o) => {
      if (!o.user_id) return;
      if (!custMap[o.user_id]) custMap[o.user_id] = { order_count: 0, total_spent: 0 };
      custMap[o.user_id].order_count++;
      custMap[o.user_id].total_spent += o.total_amount || 0;
    });
    const topCustIds = Object.entries(custMap).sort((a, b) => b[1].total_spent - a[1].total_spent).slice(0, 10).map(([id]) => id);
    if (topCustIds.length > 0) {
      const { data: custData, error } = await supabase.rpc("admin_list_existing_customer_accounts");
      if (error) {
        setLoadError(`Could not load top customer profiles: ${error.message}. Run supabase_customer_management_migration.sql in Supabase SQL Editor.`);
        setTopCustomers([]);
      } else {
        const topCustIdSet = new Set(topCustIds);
        const profiles = (custData ?? []) as { id: string; full_name: string | null; email: string | null }[];
        setTopCustomers(profiles
          .filter((profile) => topCustIdSet.has(profile.id))
          .map((profile) => ({
            id: profile.id,
            full_name: profile.full_name || "Customer",
            email: profile.email || "",
            ...custMap[profile.id],
          })));
      }
    } else { setTopCustomers([]); }

    setLoading(false);
  }, [period]);

  useEffect(() => {
    queueMicrotask(() => { void load(true); });
    const channel = supabase.channel("admin-reports-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => { void load(false); })
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, () => { void load(false); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

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

      {loadError && <div role="alert" style={{ border: "1px solid #fecaca", background: "#fef2f2", color: "#991b1b", borderRadius: 8, padding: "10px 12px", fontSize: 13 }}>{loadError}</div>}

      {loading ? (
        <div style={{ textAlign: "center", padding: "60px", color: "#a89080" }}>Loading analytics...</div>
      ) : (<>

        {/* KPI Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "14px" }}>
          {[
            { label: "Total Revenue", value: peso(revenue.total), sub: `Dine-in ${peso(revenue.dine_in)} · Takeout ${peso(revenue.pickup)} · Delivery ${peso(revenue.delivery)}`, color: ACCENT },
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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: "14px" }}>
          {(["online", "store"] as const).map((source) => (
            <div key={source} style={{ background: "#fff", borderRadius: 12, padding: "16px 20px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", borderLeft: `3px solid ${source === "store" ? "#7c3aed" : "#4f46e5"}` }}>
              <div style={{ color: "#a89080", fontSize: 12, fontWeight: 700, textTransform: "capitalize" }}>{source} orders</div>
              <div style={{ marginTop: 5, color: "#1a1008", fontSize: 22, fontWeight: 900 }}>{sourceBreakdown[source].orders} <span style={{ color: "#a89080", fontSize: 12, fontWeight: 600 }}>orders</span></div>
              <div style={{ marginTop: 3, color: ACCENT, fontSize: 13, fontWeight: 700 }}>{peso(sourceBreakdown[source].revenue)} revenue excluding cancelled orders</div>
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
                { label: "In Progress", value: orders.total ? Math.round(((orders.total - orders.completed - orders.cancelled) / orders.total) * 100) : 0, color: ACCENT },
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
            {topCustomers.length === 0 && <p style={{ color: "#aaa", fontSize: "13px" }}>No linked customer orders in this period.</p>}
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
