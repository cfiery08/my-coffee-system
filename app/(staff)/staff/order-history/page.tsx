"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import StoreReceipt, { type ReceiptOrder } from "@/app/components/StoreReceipt";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

const STATUS_COLOR: Record<string, { bg: string; text: string }> = {
  delivered: { bg: "#f3e9dc", text: "#68451f" },
  cancelled: { bg: "#f0ece8", text: "#75695f" },
};

type OrderItem = { id: string; menu_item_name: string; image_url: string | null; quantity: number; unit_price: number; subtotal: number };
type Order = {
  id: string; order_type: string; status: string; payment_status: string; payment_method: string | null;
  subtotal: number; total_amount: number; delivery_fee: number; contact_number: string | null; notes: string | null; delivery_address_snapshot: string | null;
  created_at: string; user_accounts: { full_name: string; email: string } | null; order_items: OrderItem[];
};

const PAGE_SIZE = 12;

export default function StaffOrderHistoryPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_type, status, payment_status, payment_method, subtotal, total_amount, delivery_fee, contact_number, notes, delivery_address_snapshot, created_at, order_items(id, menu_item_name, image_url, quantity, unit_price, subtotal)")
        .eq("order_source", "online")
        .in("order_type", ["pickup", "delivery"])
        .in("status", ["delivered", "cancelled"])
        .order("created_at", { ascending: false });
      if (error) {
        setLoadError(error.message);
        setOrders([]);
        setLoading(false);
        return;
      }

      const rows = (data as unknown as Order[]) ?? [];
      const { data: profiles, error: profilesError } = rows.length
        ? await supabase.rpc("get_order_customer_profiles", { order_ids: rows.map((order) => order.id) })
        : { data: [], error: null };
      if (profilesError) {
        setLoadError(profilesError.message);
      } else {
        setLoadError("");
      }
      const profileRows = (profiles ?? []) as { order_id: string; full_name: string; email: string }[];
      const profileByOrderId = new Map(profileRows.map((profile) => [profile.order_id, { full_name: profile.full_name, email: profile.email }]));
      setOrders(rows.map((order) => ({ ...order, user_accounts: profileByOrderId.get(order.id) ?? null })));
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

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading history...</div>;

  return (
    <div>
      <div style={{ marginBottom: "20px" }}>
        <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Order History</h1>
        <p style={{ color: "#a89080", fontSize: "13px", marginTop: "4px" }}>Completed and cancelled pickup & delivery orders</p>
      </div>

      {loadError && <div role="alert" style={{ marginBottom: 14, padding: "10px 12px", border: "1px solid #f0c9c4", borderRadius: 8, background: "#fff4f2", color: "#9b3328", fontSize: 12 }}>Could not load order customer details: {loadError}</div>}

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px", marginBottom: "24px" }}>
        {[
          { label: "Completed", value: completedCount, color: ACCENT },
          { label: "Cancelled", value: cancelledCount, color: "#9a8878" },
          { label: "Pickup Done", value: pickupCount, color: "#8c6745" },
          { label: "Delivery Done", value: deliveryCount, color: "#8c6745" },
        ].map((s) => (
            <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "16px 18px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", borderTop: `3px solid ${s.color}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#a89080", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>{s.label}</div>
              <div style={{ fontSize: "18px", fontWeight: 900, color: "#1a1008" }}>{s.value}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Compact, clearly separated filters */}
      <div style={{ display: "flex", alignItems: "end", flexWrap: "wrap", gap: "12px", marginBottom: "20px", padding: "12px 14px", border: "1px solid #eee5dc", borderRadius: "10px", background: "#fff" }}>
        <label style={{ display: "grid", gap: "5px", flex: "1 1 260px", color: "#806a56", fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Search
          <input aria-label="Search order history" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Name or order ID" style={{ boxSizing: "border-box", width: "100%", height: "36px", padding: "0 10px", border: "1px solid #e8ddd4", borderRadius: "7px", outline: "none", fontSize: "12px", fontWeight: 500, letterSpacing: 0, textTransform: "none", color: "#333", background: "#fff" }} />
        </label>
        <label style={{ display: "grid", gap: "5px", marginLeft: "auto", color: "#806a56", fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Status
          <select aria-label="Filter by order status" value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} style={{ minWidth: "130px", height: "36px", padding: "0 30px 0 10px", border: "1px solid #e8ddd4", borderRadius: "7px", background: "#fff", color: "#493526", fontSize: "12px", fontWeight: 650, letterSpacing: 0, textTransform: "none", cursor: "pointer" }}>
            <option value="All">All statuses</option>
            <option value="delivered">Delivered</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
        <label style={{ display: "grid", gap: "5px", color: "#806a56", fontSize: "10px", fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>
          Type
          <select aria-label="Filter by order type" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }} style={{ minWidth: "130px", height: "36px", padding: "0 30px 0 10px", border: "1px solid #e8ddd4", borderRadius: "7px", background: "#fff", color: "#493526", fontSize: "12px", fontWeight: 650, letterSpacing: 0, textTransform: "none", cursor: "pointer" }}>
            <option value="All Types">All types</option>
            <option value="pickup">Pickup</option>
            <option value="delivery">Delivery</option>
          </select>
        </label>
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
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "#f7f0e7", color: "#68451f" }}>
                      {isPickup ? "Pickup" : "Delivery"}
                    </span>
                  </div>
                  <div style={{ fontSize: "13px", color: "#374151", fontWeight: 600 }}>{o.user_accounts?.full_name || "Guest"}</div>
                  <div style={{ fontSize: "11px", color: "#a89080", marginTop: "2px" }}>{new Date(o.created_at).toLocaleString()}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontWeight: 900, fontSize: "16px", color: "#1a1008" }}>{peso(o.total_amount)}</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: o.payment_status === "paid" ? "#68451f" : "#8b8178" }}>{o.payment_status}</div>
                  </div>
                  <span style={{ fontSize: "11px", color: ACCENT, fontWeight: 700 }}>View details</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>

      {expanded && (() => {
        const selected = orders.find((order) => order.id === expanded);
        if (!selected) return null;
        const statusColor = STATUS_COLOR[selected.status] || STATUS_COLOR.delivered;
        return (
          <div style={{ position: "fixed", inset: 0, background: "rgba(26,16,8,0.28)", zIndex: 200, display: "flex", justifyContent: "flex-end" }} onClick={() => setExpanded(null)}>
            <aside aria-label="Order details" onClick={(event) => event.stopPropagation()} style={{ width: "min(400px, 100vw)", height: "100%", background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ebe5", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Order Details</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <button onClick={() => setReceipt({ ...selected, table_number: null, customer_name: selected.user_accounts?.full_name || "Guest", customer_email: selected.user_accounts?.email, delivery_address: selected.delivery_address_snapshot, order_items: selected.order_items || [] })} style={{ background: ACCENT, border: 0, borderRadius: 7, padding: "8px 11px", cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 750 }}>View Receipt</button>
                  <button onClick={() => setExpanded(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", fontSize: "12px", fontWeight: 700 }}>Close</button>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 900, fontSize: "16px", color: ACCENT }}>#{selected.id.slice(0, 8).toUpperCase()}</span>
                  <span style={{ fontSize: "11px", fontWeight: 800, padding: "3px 8px", borderRadius: "6px", background: statusColor.bg, color: statusColor.text, textTransform: "capitalize" }}>{selected.status}</span>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "#f7f0e7", color: "#68451f" }}>{selected.order_type === "pickup" ? "Pickup" : "Delivery"}</span>
                </div>
                <div style={{ fontSize: "11px", color: "#a89080", marginBottom: "16px" }}>{new Date(selected.created_at).toLocaleString()}</div>

                <OrderHistorySection title="Customer">
                  <OrderHistoryInfo text={selected.user_accounts?.full_name || "Guest"} />
                  <OrderHistoryInfo text={selected.user_accounts?.email || "—"} />
                  {selected.contact_number && <OrderHistoryInfo text={selected.contact_number} />}
                </OrderHistorySection>
                {selected.delivery_address_snapshot && <OrderHistorySection title="Delivery Address"><div style={{ background: "#fdf6f0", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#374151", overflowWrap: "anywhere" }}>{selected.delivery_address_snapshot}</div></OrderHistorySection>}
                {selected.notes && <OrderHistorySection title="Notes"><div style={{ background: "#f5f0ea", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#665344", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{selected.notes}</div></OrderHistorySection>}
                <OrderHistorySection title="Items">
                  {selected.order_items?.map((item) => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      <div style={{ width: 52, height: 52, flex: "0 0 52px", overflow: "hidden", borderRadius: 9, background: "#f5f0ea", border: "1px solid #eee5dc", display: "grid", placeItems: "center" }}>
                        {item.image_url ? <img src={item.image_url} alt={item.menu_item_name} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span aria-label="No product image" style={{ color: "#a89080", fontSize: 10 }}>No image</span>}
                      </div>
                      <div style={{ minWidth: 0 }}><div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008", overflowWrap: "anywhere" }}>{item.menu_item_name}</div><div style={{ fontSize: "11px", color: "#a89080", marginTop: 3 }}>Qty: {item.quantity} × {peso(item.unit_price)}</div></div>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008", whiteSpace: "nowrap" }}>{peso(item.subtotal)}</div>
                  </div>)}
                </OrderHistorySection>
                <OrderHistorySection title="Summary">
                  {Number(selected.delivery_fee) > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}><span style={{ fontSize: "13px", color: "#a89080" }}>Delivery Fee</span><span style={{ fontSize: "13px", color: "#374151" }}>{peso(selected.delivery_fee)}</span></div>}
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #f1ebe5" }}><span style={{ fontWeight: 800, fontSize: "14px", color: "#1a1008" }}>Total</span><span style={{ fontWeight: 900, fontSize: "16px", color: ACCENT }}>{peso(selected.total_amount)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}><span style={{ fontSize: "13px", color: "#a89080" }}>Payment</span><span style={{ fontSize: "13px", fontWeight: 700, color: "#68451f", textTransform: "capitalize" }}>{selected.payment_status}{selected.payment_method ? ` · ${selected.payment_method}` : ""}</span></div>
                </OrderHistorySection>
              </div>
            </aside>
          </div>
        );
      })()}

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
      {receipt && <StoreReceipt order={receipt} onClose={() => setReceipt(null)} />}
    </div>
  );
}

function OrderHistorySection({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: "16px" }}><div style={{ fontWeight: 800, fontSize: "13px", color: "#1a1008", marginBottom: "10px", paddingBottom: "6px", borderBottom: "1px solid #f1ebe5" }}>{title}</div>{children}</div>;
}

function OrderHistoryInfo({ text }: { text: string }) {
  return <div style={{ marginBottom: "6px", fontSize: "13px", color: "#374151", overflowWrap: "anywhere" }}>{text}</div>;
}
