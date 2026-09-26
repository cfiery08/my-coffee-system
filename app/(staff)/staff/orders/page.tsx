"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  pending:          { bg: "#fff8f0", text: "#d97706", border: "#d97706" },
  confirmed:        { bg: "#eff6ff", text: "#3b82f6", border: "#3b82f6" },
  preparing:        { bg: "#fff7ed", text: "#f97316", border: "#f97316" },
  ready:            { bg: "#f0fdf4", text: "#16a34a", border: "#16a34a" },
  out_for_delivery: { bg: "#faf5ff", text: "#9333ea", border: "#9333ea" },
  delivered:        { bg: "#f8fafc", text: "#94a3b8", border: "#94a3b8" },
  cancelled:        { bg: "#fff0f0", text: "#ef4444", border: "#ef4444" },
};

const STATUS_FLOW_PICKUP: Record<string, string> = {
  pending: "confirmed", confirmed: "preparing", preparing: "ready", ready: "delivered",
};
const STATUS_FLOW_DELIVERY: Record<string, string> = {
  pending: "confirmed", confirmed: "preparing", preparing: "out_for_delivery", out_for_delivery: "delivered",
};
const ACTION_LABEL: Record<string, string> = {
  confirmed: "Confirm", preparing: "Start Preparing", ready: "Ready for Pickup",
  out_for_delivery: "Out for Delivery", delivered: "Mark Delivered",
};

const FILTERS = ["All", "pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];
const TYPE_FILTERS = ["All Types", "pickup", "delivery"];

type OrderItem = { id: string; menu_item_name: string; quantity: number; unit_price: number; subtotal: number };
type Order = {
  id: string; order_type: string; status: string; payment_status: string; payment_method: string | null;
  total_amount: number; delivery_fee: number; notes: string | null; delivery_address_snapshot: string | null;
  created_at: string; user_accounts: { full_name: string; email: string } | null; order_items: OrderItem[];
};

export default function StaffOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, order_type, status, payment_status, payment_method, total_amount, delivery_fee, notes, delivery_address_snapshot, created_at, user_accounts(full_name, email), order_items(id, menu_item_name, quantity, unit_price, subtotal)")
      .in("order_type", ["pickup", "delivery"])
      .order("created_at", { ascending: false });
    setOrders((data as unknown as Order[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("staff-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function handleStatus(id: string, orderType: string, newStatus: string) {
    setUpdating(true);
    await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    await supabase.from("order_status_history").insert({ order_id: id, status: newStatus, changed_by: user?.id });
    await load();
    setSelected((prev) => prev?.id === id ? { ...prev, status: newStatus } : prev);
    setUpdating(false);
  }

  async function handleMarkPaid(id: string) {
    await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id);
    await load();
    setSelected((prev) => prev?.id === id ? { ...prev, payment_status: "paid" } : prev);
  }

  function getNextStatus(order: Order): string | undefined {
    const flow = order.order_type === "delivery" ? STATUS_FLOW_DELIVERY : STATUS_FLOW_PICKUP;
    return flow[order.status];
  }

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

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading orders...</div>;

  const sc = selected ? (STATUS_COLOR[selected.status] || STATUS_COLOR.pending) : null;

  return (
    <div style={{ position: "relative", height: "calc(100vh - 112px)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#1a1008", margin: "0 0 1px" }}>Online Orders</h1>
            <p style={{ color: "#a89080", fontSize: "12px", margin: 0 }}>{filtered.length} of {orders.length} · Pickup & Delivery</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderRadius: "8px", padding: "7px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", width: "220px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or ID..." style={{ border: "none", outline: "none", fontSize: "12px", color: "#333", background: "transparent", width: "100%" }} />
          </div>
        </div>

        {/* Type filter */}
        <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
          {TYPE_FILTERS.map((t) => {
            const count = t === "All Types" ? orders.length : orders.filter((o) => o.order_type === t).length;
            const color = t === "pickup" ? "#6366f1" : t === "delivery" ? "#f97316" : "#555";
            return (
              <button key={t} onClick={() => { setTypeFilter(t); setPage(1); }} style={{
                padding: "5px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
                fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap",
                background: typeFilter === t ? color : "#fff",
                color: typeFilter === t ? "#fff" : color,
                boxShadow: typeFilter === t ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
                textTransform: "capitalize",
              }}>
                {t === "pickup" ? "🏪 Pickup" : t === "delivery" ? "🛵 Delivery" : "All Types"} ({count})
              </button>
            );
          })}
        </div>

        {/* Status filter */}
        <div style={{ display: "flex", gap: "5px", marginBottom: "12px", overflowX: "auto", paddingBottom: "2px" }}>
          {FILTERS.map((f) => {
            const count = f === "All" ? orders.length : orders.filter((o) => o.status === f).length;
            return (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
                padding: "5px 12px", borderRadius: "20px", border: "none", cursor: "pointer",
                fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                background: filter === f ? ACCENT : "#fff",
                color: filter === f ? "#fff" : "#555",
                boxShadow: filter === f ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
                textTransform: "capitalize",
              }}>
                {f.replace("_", " ")} ({count})
              </button>
            );
          })}
        </div>

        {/* Order cards */}
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
          {paginated.length === 0 && <div style={{ textAlign: "center", padding: "60px", color: "#aaa", fontSize: "14px" }}>No orders found.</div>}
          {paginated.map((o) => {
            const osc = STATUS_COLOR[o.status] || STATUS_COLOR.pending;
            const mins = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
            const timeAgo = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
            const isSelected = selected?.id === o.id;
            const nextStatus = getNextStatus(o);
            const isPickup = o.order_type === "pickup";
            return (
              <div key={o.id} style={{
                background: "#fff", borderRadius: "12px", padding: "16px 18px",
                boxShadow: isSelected ? `0 0 0 2px ${ACCENT}` : "0 1px 4px rgba(0,0,0,0.06)",
                borderLeft: `4px solid ${osc.border}`,
                display: "grid", gridTemplateColumns: "1fr auto", gap: "14px", alignItems: "center",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, padding: "3px 10px", borderRadius: "6px", background: osc.bg, color: osc.text, textTransform: "capitalize" }}>{o.status.replace("_", " ")}</span>
                    <span style={{ fontWeight: 900, fontSize: "14px", color: "#1a1008" }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: isPickup ? "#ede9fe" : "#fff7ed", color: isPickup ? "#6366f1" : "#f97316" }}>
                      {isPickup ? "🏪 Pickup" : "🛵 Delivery"}
                    </span>
                    <span style={{ fontSize: "11px", color: "#a89080" }}>🕐 {timeAgo}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#374151", marginBottom: "4px" }}>{o.user_accounts?.full_name || "Guest"}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {o.order_items?.slice(0, 3).map((item, i) => <span key={i}>• {item.quantity}× {item.menu_item_name}</span>)}
                    {(o.order_items?.length || 0) > 3 && <span style={{ color: "#a89080" }}>+{o.order_items.length - 3} more</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: "18px", color: "#1a1008" }}>{peso(o.total_amount)}</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: o.payment_status === "paid" ? "#22c55e" : "#ef4444" }}>{o.payment_status}</div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {nextStatus && (
                      <button onClick={(e) => { e.stopPropagation(); handleStatus(o.id, o.order_type, nextStatus); }} disabled={updating}
                        style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 12px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                        {ACTION_LABEL[nextStatus]}
                      </button>
                    )}
                    {o.payment_status === "unpaid" && (
                      <button onClick={(e) => { e.stopPropagation(); handleMarkPaid(o.id); }}
                        style={{ background: "#f0fdf4", color: "#22c55e", border: "none", borderRadius: "8px", padding: "7px 10px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                        Paid
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : o); }}
                      style={{ background: isSelected ? ACCENT : "#f1ebe5", color: isSelected ? "#fff" : "#555", border: "none", borderRadius: "8px", padding: "7px 12px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                      {isSelected ? "Close" : "Details"}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 4px", fontSize: "12px", color: "#a89080" }}>
            <span>Showing {filtered.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: page === 1 ? "#f1ebe5" : "#fff", color: page === 1 ? "#c8b8ac" : "#374151", fontWeight: 700, fontSize: "12px", cursor: page === 1 ? "default" : "pointer" }}>← Prev</button>
              <span style={{ fontWeight: 700, color: "#374151", padding: "5px 8px" }}>{page} / {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                style={{ padding: "5px 12px", borderRadius: "6px", border: "none", background: page === totalPages ? "#f1ebe5" : "#fff", color: page === totalPages ? "#c8b8ac" : "#374151", fontWeight: 700, fontSize: "12px", cursor: page === totalPages ? "default" : "pointer" }}>Next →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Details Drawer */}
      {selected && sc && (
        <div style={{ position: "fixed", top: 0, right: 0, width: "400px", height: "100vh", background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", zIndex: 200 }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ebe5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Order Details</div>
            <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", fontSize: "18px" }}>✕</button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
              <span style={{ fontWeight: 900, fontSize: "16px", color: ACCENT }}>#{selected.id.slice(0, 8).toUpperCase()}</span>
              <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", background: sc.bg, color: sc.text, textTransform: "capitalize" }}>{selected.status.replace("_", " ")}</span>
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: selected.order_type === "pickup" ? "#ede9fe" : "#fff7ed", color: selected.order_type === "pickup" ? "#6366f1" : "#f97316" }}>
                {selected.order_type === "pickup" ? "🏪 Pickup" : "🛵 Delivery"}
              </span>
            </div>
            <div style={{ fontSize: "11px", color: "#a89080", marginBottom: "16px" }}>{new Date(selected.created_at).toLocaleString()}</div>

            <Section title="Customer">
              <InfoRow icon="👤" text={selected.user_accounts?.full_name || "Guest"} />
              <InfoRow icon="📧" text={selected.user_accounts?.email || "—"} />
            </Section>

            {selected.delivery_address_snapshot && (
              <Section title="Delivery Address">
                <div style={{ background: "#fdf6f0", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#374151" }}>
                  📍 {selected.delivery_address_snapshot}
                </div>
              </Section>
            )}

            {selected.notes && (
              <Section title="Notes">
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#92400e", whiteSpace: "pre-line" }}>{selected.notes}</div>
              </Section>
            )}

            <Section title="Items">
              {selected.order_items?.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008" }}>{item.menu_item_name}</div>
                    <div style={{ fontSize: "11px", color: "#a89080" }}>Qty: {item.quantity} × {peso(item.unit_price)}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008" }}>{peso(item.subtotal)}</div>
                </div>
              ))}
            </Section>

            <Section title="Summary">
              {selected.delivery_fee > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ fontSize: "13px", color: "#a89080" }}>Delivery Fee</span>
                  <span style={{ fontSize: "13px", color: "#374151" }}>{peso(selected.delivery_fee)}</span>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #f1ebe5" }}>
                <span style={{ fontWeight: 800, fontSize: "14px", color: "#1a1008" }}>Total</span>
                <span style={{ fontWeight: 900, fontSize: "16px", color: ACCENT }}>{peso(selected.total_amount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                <span style={{ fontSize: "13px", color: "#a89080" }}>Payment</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: selected.payment_status === "paid" ? "#22c55e" : "#ef4444" }}>
                  {selected.payment_status}{selected.payment_method ? ` · ${selected.payment_method}` : ""}
                </span>
              </div>
            </Section>
          </div>

          <div style={{ padding: "14px 20px", borderTop: "1px solid #f1ebe5", display: "flex", flexDirection: "column", gap: "8px" }}>
            {getNextStatus(selected) && (
              <button onClick={() => handleStatus(selected.id, selected.order_type, getNextStatus(selected)!)} disabled={updating}
                style={{ width: "100%", background: ACCENT, color: "#fff", border: "none", borderRadius: "8px", padding: "13px", fontWeight: 800, fontSize: "14px", cursor: "pointer" }}>
                {ACTION_LABEL[getNextStatus(selected)!]}
              </button>
            )}
            {selected.payment_status === "unpaid" && (
              <button onClick={() => handleMarkPaid(selected.id)}
                style={{ width: "100%", background: "#f0fdf4", color: "#22c55e", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "11px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                Mark as Paid
              </button>
            )}
            {!["cancelled", "delivered"].includes(selected.status) && (
              <button onClick={() => handleStatus(selected.id, selected.order_type, "cancelled")} disabled={updating || selected.status !== "pending"}
                style={{ width: "100%", background: "transparent", color: selected.status === "pending" ? "#a89080" : "#c8b8ac", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "11px", fontWeight: 600, fontSize: "13px", cursor: selected.status === "pending" ? "pointer" : "not-allowed", opacity: selected.status === "pending" ? 1 : 0.4 }}>
                {selected.status === "pending" ? "Cancel Order" : "Cannot Cancel"}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "16px" }}>
      <div style={{ fontWeight: 800, fontSize: "13px", color: "#1a1008", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #f1ebe5" }}>{title}</div>
      {children}
    </div>
  );
}
function InfoRow({ icon, text }: { icon: string; text: string }) {
  return <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "13px", color: "#374151" }}><span>{icon}</span><span>{text}</span></div>;
}
