"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import SystemIcon from "@/app/components/SystemIcon";
import StoreReceipt, { type ReceiptOrder } from "@/app/components/StoreReceipt";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  pending:   { bg: "#fff8f0", text: "#d97706", border: "#d97706" },
  confirmed: { bg: "#eff6ff", text: "#3b82f6", border: "#3b82f6" },
  preparing: { bg: "#fff7ed", text: "#f97316", border: "#f97316" },
  ready:     { bg: "#f0fdf4", text: "#16a34a", border: "#16a34a" },
  out_for_delivery: { bg: "#faf5ff", text: "#9333ea", border: "#9333ea" },
  delivered: { bg: "#f8fafc", text: "#94a3b8", border: "#94a3b8" },
  cancelled: { bg: "#fff0f0", text: "#ef4444", border: "#ef4444" },
};
const STATUS_FLOW_PICKUP: Record<string, string> = {
  pending: "confirmed", confirmed: "preparing", preparing: "ready", ready: "delivered",
};
const STATUS_FLOW_DELIVERY: Record<string, string> = {
  pending: "confirmed", confirmed: "preparing", preparing: "ready", ready: "out_for_delivery", out_for_delivery: "delivered",
};
const ACTION_LABEL: Record<string, string> = {
  confirmed: "Confirm", preparing: "Start Preparing", ready: "Mark Ready", out_for_delivery: "Mark Out for Delivery", delivered: "Mark Delivered",
};
const FILTERS = ["All", "pending", "confirmed", "preparing", "ready", "out_for_delivery", "delivered", "cancelled"];
const TYPE_FILTERS = ["All Types", "dine_in", "pickup", "delivery"];

type OrderItem = { id: string; menu_item_name: string; image_url: string | null; quantity: number; unit_price: number; subtotal: number; order_item_reviews?: { liked: boolean }[] };
type Order = { id: string; order_source: "online" | "store"; order_type: string; status: string; payment_status: string; payment_method: string | null; subtotal: number; delivery_fee: number; total_amount: number; table_number: string | null; customer_name: string | null; contact_number: string | null; notes: string | null; delivery_address_snapshot: string | null; created_at: string; user_accounts: { full_name: string; email: string } | null; order_items: OrderItem[]; order_reviews?: { rating: number; would_order_again: boolean | null; comment: string; created_at: string }[] };

function isCashOnDelivery(order: Order) {
  const method = (order.payment_method ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
  const orderType = order.order_type.trim().toLowerCase();
  return orderType !== "dine_in" && (!method || ["cash", "cod", "cash_on_delivery"].includes(method));
}

const canMarkOrderPaid = (order: Order) => !isCashOnDelivery(order) && order.payment_method?.trim().toLowerCase() !== "gcash";

function getNextStatus(order: Order) {
  const flow = order.order_type === "delivery" ? STATUS_FLOW_DELIVERY : STATUS_FLOW_PICKUP;
  return flow[order.status];
}

export default function AdminOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [filter, setFilter] = useState("All");
  const [sourceTab, setSourceTab] = useState<"online" | "store">("online");
  const [typeFilter, setTypeFilter] = useState("All Types");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);
  const [updating, setUpdating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("id, order_source, order_type, status, payment_status, payment_method, subtotal, delivery_fee, total_amount, table_number, customer_name, contact_number, notes, delivery_address_snapshot, created_at, order_reviews(rating, would_order_again, comment, created_at), order_items(id, menu_item_name, image_url, quantity, unit_price, subtotal, order_item_reviews(liked))")
      .order("created_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
    } else {
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
      const profileByOrderId = new Map<string, { full_name: string; email: string }>(profileRows.map((profile) => [profile.order_id, { full_name: profile.full_name, email: profile.email }]));
      const refreshedOrders = rows.map((order) => ({ ...order, user_accounts: profileByOrderId.get(order.id) ?? null }));
      setOrders(refreshedOrders);
      setSelected((current) => current ? refreshedOrders.find((order) => order.id === current.id) ?? null : null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function handleStatus(id: string, newStatus: string) {
    setUpdating(true);
    const order = orders.find((item) => item.id === id);
    const updates = { status: newStatus, ...(newStatus === "delivered" && order && isCashOnDelivery(order) ? { payment_status: "paid" } : {}) };
    await supabase.from("orders").update(updates).eq("id", id);
    await supabase.from("order_status_history").insert({ order_id: id, status: newStatus, changed_by: user?.id });
    await load();
    setUpdating(false);
  }

  async function handleMarkPaid(id: string) {
    const order = orders.find((item) => item.id === id);
    if (!order || !canMarkOrderPaid(order)) return;
    await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id);
    await load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from("orders").delete().eq("id", deleteId);
    if (selected?.id === deleteId) setSelected(null);
    setDeleteId(null);
    load();
  }

  const filtered = orders.filter((o) => {
    const matchSource = o.order_source === sourceTab;
    const matchFilter = filter === "All" || o.status === filter;
    const matchSearch = search === "" ||
      (o.customer_name || o.user_accounts?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      (o.user_accounts?.email || "").toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchSource && matchFilter && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading orders...</div>;

  const sc = selected ? (STATUS_COLOR[selected.status] || STATUS_COLOR.pending) : null;

  return (
    <div style={{ position: "relative", height: "calc(100vh - 112px)", display: "flex", flexDirection: "column" }}>
      {loadError && <div role="alert" style={{ marginBottom: "10px", padding: "10px 14px", borderRadius: "8px", background: "#fff0f0", color: "#b91c1c", fontSize: "13px" }}>Could not load orders: {loadError}. Check the Supabase orders and order_items read policies.</div>}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#1a1008", margin: "0 0 1px" }}>Manage Orders</h1>
            <p style={{ color: "#a89080", fontSize: "12px", margin: 0 }}>{filtered.length} {sourceTab} orders</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderRadius: "8px", padding: "7px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", width: "240px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name, email, ID..." style={{ border: "none", outline: "none", fontSize: "12px", color: "#333", background: "transparent", width: "100%" }} />
          </div>
        </div>

        <div role="tablist" aria-label="Order source" style={{ display: "flex", gap: 8, marginBottom: 10, borderBottom: "1px solid #e8ddd4", paddingBottom: 8 }}>
          {(["online", "store"] as const).map((source) => {
            const count = orders.filter((order) => order.order_source === source).length;
            return <button key={source} role="tab" aria-selected={sourceTab === source} onClick={() => { setSourceTab(source); setPage(1); setSelected(null); }} style={{ padding: "8px 14px", border: 0, borderBottom: sourceTab === source ? `3px solid ${ACCENT}` : "3px solid transparent", background: "transparent", color: sourceTab === source ? ACCENT : "#8b7768", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
              {source === "online" ? "Online Orders" : "Store Orders"} ({count})
            </button>;
          })}
        </div>

        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: "5px", marginBottom: "12px", overflowX: "auto", paddingBottom: "2px" }}>
          {FILTERS.map((f) => {
            const count = f === "All" ? orders.filter((o) => o.order_source === sourceTab).length : orders.filter((o) => o.order_source === sourceTab && o.status === f).length;
            return (
              <button key={f} onClick={() => { setFilter(f); setPage(1); }} style={{
                padding: "5px 12px", borderRadius: "20px", border: "none", cursor: "pointer",
                fontSize: "11px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                background: filter === f ? ACCENT : "#fff",
                color: filter === f ? "#fff" : "#555",
                boxShadow: filter === f ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
                textTransform: "capitalize",
              }}>
                {f} ({count})
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

            return (
              <div key={o.id} style={{
                background: "#fff", borderRadius: "12px", padding: "16px 18px",
                boxShadow: isSelected ? `0 0 0 2px ${ACCENT}` : "0 1px 4px rgba(0,0,0,0.06)",
                borderLeft: `4px solid ${osc.border}`,
                display: "grid", gridTemplateColumns: "1fr auto", gap: "14px", alignItems: "center",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "12px", fontWeight: 800, padding: "3px 10px", borderRadius: "6px", background: osc.bg, color: osc.text, textTransform: "capitalize" }}>{o.status}</span>
                    <span style={{ fontWeight: 900, fontSize: "14px", color: "#1a1008" }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "#fdf6f0", color: ACCENT, textTransform: "capitalize" }}>{o.order_type.replace("_", " ")}</span>
                    {o.table_number && <span style={{ fontSize: "11px", color: "#a89080" }}>Table {o.table_number}</span>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "11px", color: "#a89080" }}><SystemIcon name="clock" size={12} /> {timeAgo}</span>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "14px", color: "#374151", marginBottom: "4px" }}>{o.customer_name || o.user_accounts?.full_name || "Guest"}</div>
                  <div style={{ fontSize: "12px", color: "#6b7280", display: "flex", gap: "10px", flexWrap: "wrap" }}>
                    {o.order_items?.slice(0, 3).map((item, i) => <span key={i}>• {item.quantity}× {item.menu_item_name}</span>)}
                    {(o.order_items?.length || 0) > 3 && <span style={{ color: "#a89080" }}>+{o.order_items.length - 3} more</span>}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "8px", flexShrink: 0 }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "11px", color: "#a89080" }}>Total</div>
                    <div style={{ fontWeight: 900, fontSize: "18px", color: "#1a1008" }}>{peso(o.total_amount)}</div>
                    <div style={{ fontSize: "11px", fontWeight: 700, color: o.payment_status === "paid" ? "#22c55e" : "#ef4444" }}>{o.payment_status}</div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    {nextStatus && (
                      <button onClick={(e) => { e.stopPropagation(); handleStatus(o.id, nextStatus); }} disabled={updating}
                        style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: "8px", padding: "7px 12px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                        {ACTION_LABEL[nextStatus]}
                      </button>
                    )}
                    {o.payment_status === "unpaid" && canMarkOrderPaid(o) && (
                      <button onClick={(e) => { e.stopPropagation(); handleMarkPaid(o.id); }}
                        style={{ background: "#f0fdf4", color: "#22c55e", border: "none", borderRadius: "8px", padding: "7px 10px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                        Mark Paid
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : o); }}
                      style={{ background: isSelected ? ACCENT : "#f1ebe5", color: isSelected ? "#fff" : "#555", border: "none", borderRadius: "8px", padding: "7px 12px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                      {isSelected ? "Close" : "Details"}
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); setDeleteId(o.id); }}
                      style={{ background: "#fff0f0", color: "#ef4444", border: "none", borderRadius: "8px", padding: "7px 10px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                      <SystemIcon name="x" size={16} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
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
        <div style={{ position: "fixed", top: 0, right: 0, width: "380px", height: "100vh", background: "#fff", boxShadow: "-4px 0 24px rgba(0,0,0,0.12)", display: "flex", flexDirection: "column", zIndex: 200 }}>
          <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ebe5", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Order Details</div>
            <button onClick={() => setSelected(null)} aria-label="Close order details" style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", display: "flex" }}><SystemIcon name="x" size={18} /></button>
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px" }}>
            <div style={{ background: "#faf7f3", border: "1px solid #eee5dc", borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <div style={{ fontWeight: 900, fontSize: 16, color: ACCENT }}>#{selected.id.slice(0, 8).toUpperCase()}</div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, fontWeight: 800, padding: "4px 8px", borderRadius: 6, background: sc.bg, color: sc.text, textTransform: "capitalize" }}>{selected.status.replaceAll("_", " ")}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6, background: "#fdf6f0", color: ACCENT, textTransform: "capitalize" }}>{selected.order_type.replaceAll("_", " ")}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 6, background: selected.order_source === "online" ? "#eff6ff" : "#f3f4f6", color: selected.order_source === "online" ? "#315c9b" : "#555" }}>{selected.order_source === "online" ? "Online order" : "Store order"}</span>
              </div>
              <div style={{ fontSize: 11, color: "#a89080", marginTop: 8 }}>{new Date(selected.created_at).toLocaleString()}</div>
            </div>

            <Section title="Customer">
              <InfoRow icon={<SystemIcon name="user" size={16} />} text={selected.customer_name?.trim() || selected.user_accounts?.full_name?.trim() || (selected.order_source === "store" ? "Walk-in customer" : "Guest customer")} />
              {selected.order_source === "online" && selected.user_accounts?.email?.trim() && <InfoRow icon={<SystemIcon name="mail" size={16} />} text={selected.user_accounts.email.trim()} />}
              {selected.contact_number?.trim() && <InfoRow icon={<SystemIcon name="phone" size={16} />} text={selected.contact_number.trim()} />}
            </Section>

            {selected.order_source === "online" && selected.order_type === "delivery" && selected.delivery_address_snapshot?.trim() && <Section title="Delivery address"><div style={{ background: "#fdf6f0", border: "1px solid #e8ddd4", borderRadius: 8, padding: "10px 12px", fontSize: 13, color: "#374151", overflowWrap: "anywhere" }}>{selected.delivery_address_snapshot.trim()}</div></Section>}
            {selected.order_source === "store" && selected.table_number?.trim() && <Section title="Table"><InfoRow icon={<SystemIcon name="chair" size={16} />} text={`Table ${selected.table_number.trim()}`} /></Section>}
            {selected.notes && <Section title="Notes"><div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#92400e", whiteSpace: "pre-line", overflowWrap: "anywhere" }}>{selected.notes}</div></Section>}

            <Section title="Items">
              {selected.order_items?.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 10, padding: 8, border: "1px solid #f1ebe5", borderRadius: 9 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    {item.image_url ? <img src={item.image_url} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 7, flexShrink: 0 }} /> : <div style={{ width: 48, height: 48, borderRadius: 7, background: "#f5f0ea", flexShrink: 0 }} />}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1008" }}>{item.menu_item_name}</div>
                      <div style={{ fontSize: 11, color: "#a89080", marginTop: 3 }}>Qty: {item.quantity} × {peso(item.unit_price)}</div>
                    </div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "#1a1008", whiteSpace: "nowrap" }}>{peso(item.subtotal)}</div>
                </div>
              ))}
            </Section>

            {selected.order_source === "online" && selected.order_reviews?.[0] && <Section title="Customer Review">
              <div style={{ display: "flex" }}>{[1, 2, 3, 4, 5].map((star) => <SystemIcon key={star} name="star" size={16} style={{ color: star <= selected.order_reviews![0].rating ? "#f59e0b" : "#e5e7eb", fill: star <= selected.order_reviews![0].rating ? "#f59e0b" : "none" }} />)}</div>
              {selected.order_reviews[0].would_order_again !== null && <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 12, color: "#665344" }}><SystemIcon name={selected.order_reviews[0].would_order_again ? "thumbUp" : "thumbDown"} size={14} /> {selected.order_reviews[0].would_order_again ? "Would order again" : "Would not order again"}</div>}
              {selected.order_reviews[0].comment && <p style={{ marginTop: 8, color: "#665344", fontSize: 13 }}>{selected.order_reviews[0].comment}</p>}
            </Section>}
            {selected.order_source === "online" && selected.order_items.some((item) => item.order_item_reviews?.length) && <Section title="Item Ratings">
              {selected.order_items.map((item) => item.order_item_reviews?.[0] && <p key={item.id} style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6, color: "#776555", fontSize: 12 }}>{item.menu_item_name}: <SystemIcon name={item.order_item_reviews[0].liked ? "thumbUp" : "thumbDown"} size={13} /> {item.order_item_reviews[0].liked ? "Liked" : "Disliked"}</p>)}
            </Section>}

            <Section title="Summary">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#a89080" }}>Subtotal</span><span style={{ fontSize: 13, color: "#374151" }}>{peso(selected.subtotal)}</span>
              </div>
              {selected.order_source === "online" && selected.delivery_fee > 0 && <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, color: "#a89080" }}>Delivery fee</span><span style={{ fontSize: 13, color: "#374151" }}>{peso(selected.delivery_fee)}</span>
              </div>}
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #f1ebe5" }}>
                <span style={{ fontWeight: 800, fontSize: "14px", color: "#1a1008" }}>Total</span>
                <span style={{ fontWeight: 900, fontSize: "16px", color: ACCENT }}>{peso(selected.total_amount)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: "6px" }}>
                <span style={{ fontSize: "13px", color: "#a89080" }}>Payment status</span>
                <span style={{ fontSize: "13px", fontWeight: 700, color: selected.payment_status === "paid" ? "#22c55e" : "#ef4444", textTransform: "capitalize" }}>{selected.payment_status}</span>
              </div>
              {selected.payment_method?.trim() && <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontSize: 13, color: "#a89080" }}>Payment method</span><span style={{ fontSize: 13, fontWeight: 700, color: "#374151", textTransform: "capitalize" }}>{selected.payment_method.trim()}</span></div>}
            </Section>
          </div>

          <div style={{ padding: "14px 20px", borderTop: "1px solid #f1ebe5", display: "flex", flexDirection: "column", gap: "8px" }}>
            {selected.order_source === "online" && ["confirmed", "preparing", "ready", "out_for_delivery", "delivered"].includes(selected.status) && (
              <button onClick={() => setReceipt({ ...selected, customer_name: selected.customer_name || selected.user_accounts?.full_name || "Guest", customer_email: selected.user_accounts?.email, delivery_address: selected.delivery_address_snapshot, order_items: selected.order_items })}
                style={{ width: "100%", background: "#fdf6f0", color: ACCENT, border: "1px solid #e8ddd4", borderRadius: "8px", padding: "11px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                View / Print Receipt
              </button>
            )}
            {getNextStatus(selected) && (
              <button onClick={() => handleStatus(selected.id, getNextStatus(selected)!)} disabled={updating}
                style={{ width: "100%", background: ACCENT, color: "#fff", border: "none", borderRadius: "8px", padding: "13px", fontWeight: 800, fontSize: "14px", cursor: "pointer" }}>
                {ACTION_LABEL[getNextStatus(selected)!]}
              </button>
            )}
            {selected.payment_status === "unpaid" && canMarkOrderPaid(selected) && (
              <button onClick={() => handleMarkPaid(selected.id)}
                style={{ width: "100%", background: "#f0fdf4", color: "#22c55e", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "11px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>
                Mark as Paid
              </button>
            )}
            {!["cancelled", "delivered"].includes(selected.status) && (
              <button onClick={() => handleStatus(selected.id, "cancelled")} disabled={updating || selected.status !== "pending"}
                style={{ width: "100%", background: "transparent", color: selected.status === "pending" ? "#a89080" : "#c8b8ac", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "11px", fontWeight: 600, fontSize: "13px", cursor: selected.status === "pending" ? "pointer" : "not-allowed", opacity: selected.status === "pending" ? 1 : 0.4 }}>
                {selected.status === "pending" ? "Cancel Order" : "Cannot Cancel"}
              </button>
            )}
          </div>
        </div>
      )}

      {receipt && <StoreReceipt order={receipt} onClose={() => setReceipt(null)} />}

      {/* Delete Confirm */}
      {deleteId && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "14px", padding: "32px", width: "100%", maxWidth: "400px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h2 style={{ fontWeight: 900, fontSize: "18px", color: "#1a1008", marginBottom: "12px" }}>Delete Order?</h2>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={{ background: "#f1ebe5", color: "#555", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleDelete} style={{ background: "#ef4444", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, fontSize: "13px", cursor: "pointer" }}>Delete</button>
            </div>
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
function InfoRow({ icon, text }: { icon: React.ReactNode; text: string }) {
  return <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", fontSize: "13px", color: "#374151" }}><span>{icon}</span><span>{text}</span></div>;
}
