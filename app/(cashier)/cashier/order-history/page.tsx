"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
const ORDER_TYPE_LABEL: Record<string, string> = { dine_in: "Dine in", pickup: "Pickup", delivery: "Delivery", takeout: "Takeout" };
const orderTypeLabel = (type: string) => ORDER_TYPE_LABEL[type] || "Takeout";
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  pending:   { bg: "#fff8f0", text: "#d97706" },
  confirmed: { bg: "#eff6ff", text: "#3b82f6" },
  preparing: { bg: "#fff7ed", text: "#f97316" },
  ready:     { bg: "#f0fdf4", text: "#16a34a" },
  completed: { bg: "#f0fdf4", text: "#22c55e" },
  cancelled: { bg: "#fff0f0", text: "#ef4444" },
};

type OrderItem = { id: string; menu_item_name: string; image_url: string | null; quantity: number; unit_price: number; subtotal: number };
type Order = { id: string; order_type: string; status: string; payment_status: string; payment_method: string | null; total_amount: number; table_number: string | null; customer_name: string | null; contact_number: string | null; cancellation_reason: string | null; notes: string | null; created_at: string; user_accounts: { full_name: string; email: string } | null; order_items: OrderItem[] };

const FILTERS = ["All", "completed", "cancelled"];
const PAGE_SIZE = 12;

export default function CashierOrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("orders")
        .select("id, order_type, status, payment_status, payment_method, total_amount, table_number, customer_name, contact_number, cancellation_reason, notes, created_at, user_accounts!orders_user_id_fkey(full_name, email), order_items(id, menu_item_name, image_url, quantity, unit_price, subtotal)")
        .eq("order_source", "store")
        .in("status", ["completed", "cancelled"])
        .order("created_at", { ascending: false });
      setOrders((data as unknown as Order[]) ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = orders.filter((o) => {
    const matchFilter = filter === "All" || o.status === filter;
    const matchSearch = search === "" ||
      (o.customer_name || o.user_accounts?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const totalRevenue = orders.filter((o) => o.status === "completed").reduce((s, o) => s + o.total_amount, 0);
  const completedCount = orders.filter((o) => o.status === "completed").length;
  const cancelledCount = orders.filter((o) => o.status === "cancelled").length;

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading history...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Order History</h1>
          <p style={{ color: "#a89080", fontSize: "13px", marginTop: "4px" }}>Completed and cancelled orders</p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Completed", value: completedCount, color: ACCENT },
          { label: "Total Cancelled", value: cancelledCount, color: "#9a8878" },
          { label: "Revenue (Completed)", value: peso(totalRevenue), color: "#8c6745" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", borderTop: `3px solid ${s.color}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#a89080", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{s.label}</div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#1a1008" }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", alignItems: "center" }}>
        <div style={{ display: "flex", gap: "5px" }}>
          {FILTERS.map((f) => (
            <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
              padding: "7px 16px", borderRadius: "20px", border: "none", cursor: "pointer",
              fontSize: "12px", fontWeight: 700, textTransform: "capitalize",
              background: filter === f ? ACCENT : "#fff",
              color: filter === f ? "#fff" : "#555",
              boxShadow: filter === f ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              {f}
            </button>
          ))}
        </div>
        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", maxWidth: "280px" }}>
          <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or ID..." style={{ border: "none", outline: "none", fontSize: "12px", color: "#333", background: "transparent", width: "100%" }} />
        </div>
      </div>

      {/* Orders list */}
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {paginated.length === 0 && <div style={{ textAlign: "center", padding: "60px", color: "#aaa", fontSize: "14px" }}>No orders found.</div>}
        {paginated.map((o) => {
          const osc = STATUS_COLOR[o.status] || STATUS_COLOR.completed;
          const isExpanded = expanded === o.id;
          return (
            <div key={o.id} style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
              <div
                onClick={() => setExpanded(isExpanded ? null : o.id)}
                style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "16px", alignItems: "center", padding: "16px 18px", cursor: "pointer" }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, padding: "3px 10px", borderRadius: "6px", background: osc.bg, color: osc.text, textTransform: "capitalize" }}>{o.status}</span>
                    <span style={{ fontWeight: 900, fontSize: "14px", color: "#1a1008" }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "#fdf6f0", color: ACCENT }}>{orderTypeLabel(o.order_type)}</span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>{o.customer_name || o.user_accounts?.full_name || "Guest"}</div>
                  <div style={{ fontSize: "11px", color: "#a89080", marginTop: "2px" }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: "16px", color: "#1a1008" }}>{peso(o.total_amount)}</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: o.payment_status === "paid" ? "#22c55e" : "#ef4444" }}>{o.payment_status}</div>
                  </div>
                  <span style={{ minWidth: "78px", color: ACCENT, fontSize: "11px", fontWeight: 700, textAlign: "right" }}>View details</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {expanded && (() => {
        const selected = orders.find((order) => order.id === expanded);
        if (!selected) return null;
        const statusColor = STATUS_COLOR[selected.status] || STATUS_COLOR.completed;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(26,16,8,0.28)", zIndex: 200, display: "flex", justifyContent: "flex-end" }} onClick={() => setExpanded(null)}>
            <aside aria-label="Order details" onClick={(event) => event.stopPropagation()} style={{ width: "min(400px, 100vw)", height: "100%", background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ebe5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Order Details</div>
                <button onClick={() => setExpanded(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", fontSize: "12px", fontWeight: 700 }}>Close</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
                <div style={{ background: "#faf7f3", border: "1px solid #eee5dc", borderRadius: 10, padding: 12, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 900, fontSize: 16, color: ACCENT }}>#{selected.id.slice(0, 8).toUpperCase()}</span>
                    <span style={{ fontSize: 11, fontWeight: 800, padding: "3px 8px", borderRadius: 6, background: statusColor.bg, color: statusColor.text, textTransform: "capitalize" }}>{selected.status}</span>
                  </div>
                  <div style={{ fontSize: 11, color: "#806e5e", marginTop: 8 }}>{new Date(selected.created_at).toLocaleString()}</div>
                </div>
                <OrderHistorySection title="Customer">
                  <div style={{ background: "#faf7f3", border: "1px solid #eee5dc", borderRadius: 8, padding: "10px 12px" }}>
                    <div style={{ color: "#3f3024", fontSize: 14, fontWeight: 700 }}>{selected.customer_name || selected.user_accounts?.full_name || "Guest"}</div>
                    {selected.contact_number && <div style={{ color: "#806e5e", fontSize: 12, marginTop: 5 }}>Contact: {selected.contact_number}</div>}
                  </div>
                </OrderHistorySection>
                <OrderHistorySection title="Order setup">
                  <div style={{ display: "grid", gridTemplateColumns: selected.table_number ? "1fr 1fr" : "1fr", gap: 8 }}>
                    <div style={{ background: "#faf7f3", borderRadius: 8, padding: "9px 10px" }}><div style={{ color: "#a89080", fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Type</div><div style={{ color: "#3f3024", fontSize: 13, fontWeight: 700 }}>{orderTypeLabel(selected.order_type)}</div></div>
                    {selected.table_number && <div style={{ background: "#faf7f3", borderRadius: 8, padding: "9px 10px" }}><div style={{ color: "#a89080", fontSize: 10, fontWeight: 800, textTransform: "uppercase", marginBottom: 4 }}>Table</div><div style={{ color: "#3f3024", fontSize: 13, fontWeight: 700 }}>Table {selected.table_number}</div></div>}
                  </div>
                </OrderHistorySection>
                {selected.notes && <OrderHistorySection title="Notes"><div style={{ background: "#f5f0ea", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#665344", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{selected.notes}</div></OrderHistorySection>}
                {selected.cancellation_reason && <OrderHistorySection title="Cancellation reason"><div style={{ background: "#fff5f3", border: "1px solid #f0d8d3", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#8f473c", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{selected.cancellation_reason}</div></OrderHistorySection>}
                <OrderHistorySection title="Items">
                  {selected.order_items?.map((item) => <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, padding: 8, border: "1px solid #f1ebe5", borderRadius: 9 }}>
                    {item.image_url ? <img src={item.image_url} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} /> : <div style={{ width: 48, height: 48, borderRadius: 7, background: "#f5f0ea", flexShrink: 0 }} />}
                    <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontWeight: 700, fontSize: 13, color: "#1a1008" }}>{item.menu_item_name}</div><div style={{ fontSize: 11, color: "#a89080", marginTop: 3 }}>{item.quantity} × {peso(item.unit_price)}</div></div>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "#1a1008", whiteSpace: "nowrap" }}>{peso(item.subtotal)}</div>
                  </div>)}
                </OrderHistorySection>
                <OrderHistorySection title="Summary">
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, borderTop: "1px solid #f1ebe5" }}><span style={{ fontSize: 13, color: "#806e5e" }}>Payment method</span><span style={{ fontSize: 13, fontWeight: 700, color: "#3f3024", textTransform: "capitalize" }}>{selected.payment_method || "—"}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 7 }}><span style={{ fontSize: 13, color: "#806e5e" }}>Payment status</span><span style={{ fontSize: 12, fontWeight: 800, color: selected.payment_status === "paid" ? "#16803c" : "#b45309", textTransform: "capitalize" }}>{selected.payment_status}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, paddingTop: 10, borderTop: "1px solid #f1ebe5" }}><span style={{ fontWeight: 800, fontSize: 14, color: "#1a1008" }}>Total</span><span style={{ fontWeight: 900, fontSize: 17, color: ACCENT }}>{peso(selected.total_amount)}</span></div>
                </OrderHistorySection>
              </div>
            </aside>
          </div>
        );
      })()}

      {/* Pagination */}
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

function OrderHistorySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "16px" }}><div style={{ fontWeight: 800, fontSize: "13px", color: "#1a1008", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #f1ebe5" }}>{title}</div>{children}</div>;
}

