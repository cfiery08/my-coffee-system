"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  delivered: { bg: "#f0fdf4", text: "#22c55e" },
  cancelled: { bg: "#fff0f0", text: "#ef4444" },
};

type OrderItem = { id: string; menu_item_name: string; quantity: number; unit_price: number; subtotal: number };
type Order = {
  id: string; order_type: string; status: string; payment_status: string; payment_method: string | null;
  total_amount: number; delivery_fee: number; notes: string | null; delivery_address_snapshot: string | null;
  created_at: string; user_accounts: { full_name: string; email: string } | null; order_items: OrderItem[];
};

const FILTERS = ["All", "delivered", "cancelled"];
const TYPE_FILTERS = ["All Types", "pickup", "delivery"];
const PAGE_SIZE = 12;

export default function StaffOrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select("id, order_type, status, payment_status, payment_method, total_amount, delivery_fee, notes, delivery_address_snapshot, created_at, user_accounts(full_name, email), order_items(id, menu_item_name, quantity, unit_price, subtotal)")
        .in("order_type", ["pickup", "delivery"])
        .in("status", ["delivered", "cancelled"])
        .order("created_at", { ascending: false });
      setOrders((data as unknown as Order[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = orders.filter((o) => {
    const matchStatus = filter === "All" || o.status === filter;
    const matchType = typeFilter === "All Types" || o.order_type === typeFilter;
    const matchSearch = search === "" ||
      (o.user_accounts?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchType && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const completedCount = orders.filter((o) => o.status === "delivered").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;
  const pickupCount = orders.filter((o) => o.order_type === "pickup" && o.status === "delivered").length;
  const deliveryCount = orders.filter((o) => o.order_type === "delivery" && o.status === "delivered").length;
  const totalRevenue = orders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.total_amount, 0);

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading history...</div>;

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Order History</h1>
        <p style={{ color: "#a89080", fontSize: "13px", marginTop: "4px" }}>Completed and cancelled pickup & delivery orders</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: "14px", marginBottom: "24px" }}>
        {[
          { label: "Completed", value: completedCount, icon: "✅", color: "#22c55e" },
          { label: "Cancelled", value: cancelledCount, icon: "❌", color: "#ef4444" },
          { label: "Pickup Done", value: pickupCount, icon: "🏪", color: "#6366f1" },
          { label: "Delivery Done", value: deliveryCount, icon: "🛵", color: "#f97316" },
          { label: "Revenue", value: peso(totalRevenue), icon: "💰", color: ACCENT },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", borderTop: `3px solid ${s.color}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#a89080", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{s.label}</div>
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#1a1008" }}>{s.value}</div>
            </div>
            <span style={{ fontSize: "22px" }}>{s.icon}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "5px" }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
              padding: "7px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 700, textTransform: "capitalize",
              background: filter === f ? ACCENT : "#fff",
              color: filter === f ? "#fff" : "#555",
              boxShadow: filter === f ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
            }}>{f}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: "5px" }}>
          {TYPE_FILTERS.map((t) => {
            const color = t === "pickup" ? "#6366f1" : t === "delivery" ? "#f97316" : "#555";
            return (
              <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }} style={{
                padding: "7px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
                fontSize: "12px", fontWeight: 700, textTransform: "capitalize",
                background: typeFilter === t ? color : "#fff",
                color: typeFilter === t ? "#fff" : color,
                boxShadow: typeFilter === t ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                {t === "pickup" ? "🏪 Pickup" : t === "delivery" ? "🛵 Delivery" : "All Types"}
              </button>
            );
          })}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, minWidth: "200px", maxWidth: "280px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or ID..." style={{ border: "none", outline: "none", fontSize: "12px", color: "#333", background: "transparent", width: "100%" }} />
        </div>
      </div>

      {/* Orders list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {paginated.length === 0 && <div style={{ textAlign: "center", padding: "60px", color: "#aaa", fontSize: "14px" }}>No orders found.</div>}
        {paginated.map((o) => {
          const osc = STATUS_COLOR[o.status] || STATUS_COLOR.delivered;
          const isExpanded = expanded === o.id;
          const isPickup = o.order_type === "pickup";
          return (
            <div key={o.id} style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div onClick={() => setExpanded(isExpanded ? null : o.id)}
                style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "center", padding: "16px 18px", cursor: "pointer" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, padding: "3px 10px", borderRadius: "6px", background: osc.bg, color: osc.text, textTransform: "capitalize" }}>{o.status}</span>
                    <span style={{ fontWeight: 900, fontSize: "14px", color: "#1a1008" }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: isPickup ? "#ede9fe" : "#fff7ed", color: isPickup ? "#6366f1" : "#f97316" }}>
                      {isPickup ? "🏪 Pickup" : "🛵 Delivery"}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>{o.user_accounts?.full_name || "Guest"}</div>
                  <div style={{ fontSize: "11px", color: "#a89080", marginTop: "2px" }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: "16px", color: "#1a1008" }}>{peso(o.total_amount)}</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: o.payment_status === "paid" ? "#22c55e" : "#ef4444" }}>{o.payment_status}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2" style={{ transform: isExpanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </div>

              {isExpanded && (
                <div style={{ borderTop: "1px solid #f1ebe5", padding: "14px 18px", background: "#faf7f4" }}>
                  {o.delivery_address_snapshot && (
                    <div style={{ fontSize: "12px", color: "#374151", marginBottom: "10px", background: "#fff", border: "1px solid #e8ddd4", borderRadius: "6px", padding: "8px 10px" }}>
                      📍 {o.delivery_address_snapshot}
                    </div>
                  )}
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#a89080", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>Items</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {o.order_items?.map((item) => (
                      <div key={item.id} style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                        <span style={{ color: "#374151" }}>{item.menu_item_name} <span style={{ color: "#a89080" }}>× {item.quantity}</span></span>
                        <span style={{ fontWeight: 700, color: "#1a1008" }}>{peso(item.subtotal)}</span>
                      </div>
                    ))}
                  </div>
                  {o.notes && <div style={{ marginTop: "10px", fontSize: "12px", color: "#92400e", background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "6px", padding: "8px 10px", whiteSpace: "pre-line" }}>{o.notes}</div>}
                  <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid #ede8e3", display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "14px" }}>
                    <span style={{ color: "#1a1008" }}>Total</span>
                    <span style={{ color: ACCENT }}>{peso(o.total_amount)}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 4px", fontSize: "12px", color: "#a89080", marginTop: "8px" }}>
          <span>Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
          <div style={{ display: "flex", gap: "6px" }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: page === 1 ? "#f1ebe5" : "#fff", color: page === 1 ? "#c8b8ac" : "#374151", fontWeight: 700, fontSize: "12px", cursor: page === 1 ? "default" : "pointer" }}>← Prev</button>
            <span style={{ fontWeight: 700, color: "#374151", padding: "5px 8px" }}>{page} / {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: page === totalPages ? "#f1ebe5" : "#fff", color: page === totalPages ? "#c8b8ac" : "#374151", fontWeight: 700, fontSize: "12px", cursor: page === totalPages ? "default" : "pointer" }}>Next →</button>
          </div>
        </div>
      )}
    </div>
  );
}
