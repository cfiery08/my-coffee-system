"use client";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";
import SystemIcon from "@/app/components/SystemIcon";
import StoreReceipt, { type ReceiptOrder } from "@/app/components/StoreReceipt";
import styles from "./orders.module.css";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

const STATUS_COLOR: Record<string, { bg: string; text: string; border: string }> = {
  pending:   { bg: "#fff8f0", text: "#d97706", border: "#d97706" },
  confirmed: { bg: "#eff6ff", text: "#3b82f6", border: "#3b82f6" },
  preparing: { bg: "#fff7ed", text: "#f97316", border: "#f97316" },
  ready:     { bg: "#f0fdf4", text: "#16a34a", border: "#16a34a" },
  completed: { bg: "#f0fdf4", text: "#16a34a", border: "#16a34a" },
  cancelled: { bg: "#fff0f0", text: "#ef4444", border: "#ef4444" },
};
const STATUS_FLOW: Record<string, string> = {
  pending: "preparing", confirmed: "preparing", preparing: "ready", ready: "completed",
};
const ACTION_LABEL: Record<string, string> = {
  preparing: "Start Preparing", ready: "Mark Ready", completed: "Mark Completed",
};
const FILTERS = ["All", "pending", "preparing", "ready", "completed", "cancelled"];
const displayStatus = (status: string) => status === "confirmed" ? "pending" : status;

type OrderItem = { id: string; menu_item_name: string; image_url: string | null; quantity: number; unit_price: number; subtotal: number };
type Order = { id: string; cashier_id: string | null; cancellation_reason: string | null; order_type: string; status: string; payment_status: string; payment_method: string | null; total_amount: number; table_number: string | null; customer_name: string | null; contact_number: string | null; notes: string | null; created_at: string; user_accounts: { full_name: string; email: string } | null; order_items: OrderItem[] };

export default function CashierOrdersPage() {
  const { user, role } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("All");
  const [typeFilter, setTypeFilter] = useState<"all" | "dine_in" | "takeout">("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Order | null>(null);
  const [updating, setUpdating] = useState(false);
  const [page, setPage] = useState(1);
  const [receipt, setReceipt] = useState<ReceiptOrder | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Order | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const PAGE_SIZE = 10;

  const load = useCallback(async () => {
    const { data } = await supabase
      .from("orders")
      .select("id, cashier_id, cancellation_reason, order_type, status, payment_status, payment_method, subtotal, delivery_fee, total_amount, table_number, customer_name, contact_number, notes, created_at, user_accounts!orders_user_id_fkey(full_name, email), order_items(id, menu_item_name, image_url, quantity, unit_price, subtotal)")
      .eq("order_source", "store")
      .order("created_at", { ascending: false });
    setOrders((data as unknown as Order[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const ch = supabase.channel("cashier-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  async function handleStatus(id: string, newStatus: string) {
    if (role !== "barista" && role !== "admin") return;
    if (newStatus === "cancelled") {
      const order = orders.find((item) => item.id === id);
      if (order) {
        setCancelTarget(order);
        setCancelReason("");
        setCancelError("");
      }
      return;
    }
    setUpdating(true);
    await supabase.from("orders").update({ status: newStatus }).eq("id", id);
    await supabase.from("order_status_history").insert({ order_id: id, status: newStatus, changed_by: user?.id });
    await load();
    setSelected((prev) => prev?.id === id ? { ...prev, status: newStatus } : prev);
    setUpdating(false);
  }

  async function confirmCancellation() {
    if (role === "barista") {
      setCancelError("Baristas cannot cancel orders.");
      return;
    }
    if (!cancelTarget || !user || !cancelReason.trim() || updating) {
      if (!cancelReason.trim()) setCancelError("Enter a reason to cancel this order.");
      return;
    }
    setUpdating(true);
    setCancelError("");
    const reason = cancelReason.trim();
    const { error } = await supabase.from("orders").update({ status: "cancelled", cancellation_reason: reason }).eq("id", cancelTarget.id);
    if (error) {
      setCancelError(error.message);
      setUpdating(false);
      return;
    }
    await supabase.from("order_status_history").insert({ order_id: cancelTarget.id, status: "cancelled", changed_by: user.id });
    await load();
    setSelected((prev) => prev?.id === cancelTarget.id ? { ...prev, status: "cancelled", cancellation_reason: reason } : prev);
    setCancelTarget(null);
    setCancelReason("");
    setUpdating(false);
  }

  async function handleMarkPaid(id: string) {
    if (role !== "admin") return;
    await supabase.from("orders").update({ payment_status: "paid" }).eq("id", id);
    await load();
    setSelected((prev) => prev?.id === id ? { ...prev, payment_status: "paid" } : prev);
  }

  const filtered = orders.filter((o) => {
    const matchFilter = filter === "All" || displayStatus(o.status) === filter;
    const matchType = typeFilter === "all" || (typeFilter === "dine_in"
      ? o.order_type === "dine_in"
      : o.order_type !== "dine_in");
    const matchSearch = search === "" ||
      (o.user_accounts?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
      o.id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchType && matchSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading orders...</div>;

  const sc = selected ? (STATUS_COLOR[displayStatus(selected.status)] || STATUS_COLOR.pending) : null;

  return (
    <div style={{ position: "relative", height: "calc(100vh - 112px)", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#1a1008", margin: "0 0 1px" }}>Store Orders</h1>
            <p style={{ color: "#a89080", fontSize: "12px", margin: 0 }}>{filtered.length} of {orders.length} orders</p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderRadius: "8px", padding: "7px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", width: "240px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search name or ID..." style={{ border: "none", outline: "none", fontSize: "12px", color: "#333", background: "transparent", width: "100%" }} />
          </div>
        </div>

        {/* Order type filters for baristas */}
        {role === "barista" && (
          <div aria-label="Filter orders by type" style={{ display: "flex", gap: "7px", marginBottom: "8px" }}>
            {([
              ["all", "All types"],
              ["takeout", "Takeout"],
              ["dine_in", "Dine in"],
            ] as const).map(([value, label]) => {
              const count = value === "all" ? orders.length : orders.filter((o) =>
                value === "dine_in" ? o.order_type === "dine_in" : o.order_type !== "dine_in"
              ).length;
              return (
                <button key={value} onClick={() => { setTypeFilter(value); setPage(1); }} style={{
                  padding: "6px 12px", borderRadius: "8px", border: `1px solid ${typeFilter === value ? ACCENT : "#eadbd4"}`,
                  cursor: "pointer", fontSize: "12px", fontWeight: 750, whiteSpace: "nowrap",
                  background: typeFilter === value ? "#fdf6f0" : "#fff",
                  color: typeFilter === value ? ACCENT : "#6b5b50",
                }}>
                  {label} <span style={{ opacity: 0.75 }}>({count})</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Status filter tabs */}
        <div style={{ display: "flex", gap: "5px", marginBottom: "12px", overflowX: "auto", paddingBottom: "2px" }}>
          {FILTERS.map((f) => {
            const count = f === "All" ? orders.length : orders.filter((o) => displayStatus(o.status) === f).length;
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
            const shownStatus = displayStatus(o.status);
            const osc = STATUS_COLOR[shownStatus] || STATUS_COLOR.pending;
            const mins = Math.round((Date.now() - new Date(o.created_at).getTime()) / 60000);
            const timeAgo = mins < 60 ? `${mins}m ago` : `${Math.round(mins / 60)}h ago`;
            const isSelected = selected?.id === o.id;
            const nextStatus = role === "barista" || role === "admin" ? STATUS_FLOW[o.status] : undefined;

            return (
              <article key={o.id} className={`${styles.orderCard} ${isSelected ? styles.orderCardSelected : ""}`} style={{
                background: "#fff", borderRadius: "12px", padding: "16px 18px",
                boxShadow: isSelected ? `0 0 0 2px ${ACCENT}` : "0 1px 4px rgba(0,0,0,0.06)",
                borderLeft: `4px solid ${osc.border}`,
                display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(150px, auto)", gap: "16px", alignItems: "center",
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "5px", flexWrap: "wrap" }}>
                    <span className={styles.statusLabel}>ORDER STATUS</span>
                    <span style={{ fontSize: "13px", fontWeight: 850, padding: "6px 12px", borderRadius: "20px", background: osc.bg, color: osc.text, textTransform: "capitalize", letterSpacing: ".2px" }}>{shownStatus.replaceAll("_", " ")}</span>
                    <span style={{ fontWeight: 900, fontSize: "14px", color: "#1a1008" }}>#{o.id.slice(0, 8).toUpperCase()}</span>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 8px", borderRadius: "6px", background: "#fdf6f0", color: ACCENT, textTransform: "capitalize" }}>{o.order_type === "dine_in" ? "Dine in" : "Takeout"}</span>
                    {o.table_number && <span style={{ fontSize: "11px", color: "#a89080" }}>Table {o.table_number}</span>}
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: "11px", color: "#a89080" }}><SystemIcon name="clock" size={12} /> {timeAgo}</span>
                  </div>
                  <div style={{ fontWeight: 750, fontSize: "15px", color: "#302116", margin: "9px 0 7px" }}>{o.customer_name || o.user_accounts?.full_name || "Guest"}</div>
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
                    {o.payment_status === "unpaid" && role === "admin" && (
                      <button onClick={(e) => { e.stopPropagation(); handleMarkPaid(o.id); }}
                        style={{ background: "#f0fdf4", color: "#22c55e", border: "none", borderRadius: "8px", padding: "7px 10px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                        Paid
                      </button>
                    )}
                    {o.status === "pending" && ((role === "cashier" && o.cashier_id === user?.id) || role === "admin") && (
                      <button onClick={(e) => { e.stopPropagation(); setCancelTarget(o); setCancelReason(""); setCancelError(""); }}
                        style={{ background: "#fff5f3", color: "#9c5145", border: "1px solid #eadbd4", borderRadius: "8px", padding: "7px 10px", fontWeight: 700, fontSize: "12px", cursor: "pointer" }}>
                        Cancel
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : o); }}
                      style={{ background: isSelected ? ACCENT : "#f1ebe5", color: isSelected ? "#fff" : "#555", border: "none", borderRadius: "8px", padding: "7px 12px", fontWeight: 600, fontSize: "12px", cursor: "pointer" }}>
                      {isSelected ? "Close" : "Details"}
                    </button>
                  </div>
                </div>
              </article>
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

      {selected && sc && (
        <div className={styles.drawerBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>
          <aside className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="order-detail-title">
            <header className={styles.drawerHeader}>
              <div><span className={styles.drawerEyebrow}>STORE ORDER</span><h2 id="order-detail-title">Order details</h2></div>
              <button className={styles.closeButton} onClick={() => setSelected(null)} aria-label="Close order details"><SystemIcon name="x" size={19} /></button>
            </header>
            <div className={styles.drawerBody}>
              <section className={styles.orderHero}>
                <div className={styles.orderHeroTop}>
                  <strong>#{selected.id.slice(0, 8).toUpperCase()}</strong>
                  <span className={styles.statusPill} style={{ background: sc.bg, color: sc.text }}>{displayStatus(selected.status)}</span>
                </div>
                <div className={styles.orderMeta}>
                  <span>{selected.order_type === "dine_in" ? "Dine in" : "Takeout"}</span>
                  {selected.table_number && <><i /> <span>Table {selected.table_number}</span></>}
                  <i /><span>{new Date(selected.created_at).toLocaleString()}</span>
                </div>
              </section>

              <section className={styles.detailSection}>
                <h3>Customer</h3>
                <div className={styles.customerName}><SystemIcon name="user" size={17} />{selected.customer_name || selected.user_accounts?.full_name || "Walk-in customer"}</div>
                {selected.contact_number && <div className={styles.contactLine}><SystemIcon name="phone" size={15} />{selected.contact_number}</div>}
              </section>

              <section className={styles.detailSection}>
                <h3>Items <span>{selected.order_items?.length ?? 0}</span></h3>
                <div className={styles.itemList}>
                  {selected.order_items?.map((item) => (
                    <div className={styles.itemRow} key={item.id}>
                      {item.image_url ? <img src={item.image_url} alt="" className={styles.itemImage} /> : <span className={styles.itemImagePlaceholder}><SystemIcon name="coffee" size={17} /></span>}
                      <div className={styles.itemDescription}><strong>{item.menu_item_name}</strong><span>{item.quantity} × {peso(item.unit_price)}</span></div>
                      <strong className={styles.itemSubtotal}>{peso(item.subtotal)}</strong>
                    </div>
                  ))}
                  {!selected.order_items?.length && <p className={styles.noItems}>No items recorded for this order.</p>}
                </div>
              </section>

              {selected.notes && <section className={styles.noteSection}><h3>Order note</h3><p>{selected.notes}</p></section>}
              {selected.cancellation_reason && <section className={styles.noteSection}><h3>Cancellation reason</h3><p>{selected.cancellation_reason}</p></section>}

              <section className={styles.paymentSummary}>
                <div className={styles.paymentMethodRow}>
                  <span>Payment</span><strong>{selected.payment_method || "—"}</strong>
                  <span className={selected.payment_status === "paid" ? styles.paidBadge : styles.unpaidBadge}>{selected.payment_status}</span>
                </div>
                <div className={styles.totalRow}><span>Total</span><strong>{peso(selected.total_amount)}</strong></div>
              </section>
            </div>
            <footer className={styles.drawerActions}>
              <button className={styles.primaryAction} onClick={() => setReceipt(selected)}>View receipt</button>
              {STATUS_FLOW[selected.status] && (role === "barista" || role === "admin") && (
                <button className={styles.primaryAction} onClick={() => handleStatus(selected.id, STATUS_FLOW[selected.status])} disabled={updating}>
                  {updating ? "Updating…" : ACTION_LABEL[STATUS_FLOW[selected.status]]}
                </button>
              )}
              {selected.payment_status === "unpaid" && role === "admin" && <button className={styles.paidAction} onClick={() => handleMarkPaid(selected.id)}>Mark as paid</button>}
              {selected.status === "pending" && ((role === "cashier" && selected.cashier_id === user?.id) || role === "admin") && <button className={styles.cancelAction} onClick={() => { setCancelTarget(selected); setCancelReason(""); setCancelError(""); }} disabled={updating}>Cancel order</button>}
            </footer>
          </aside>
        </div>
      )}
      {receipt && <StoreReceipt order={receipt} onClose={() => setReceipt(null)} />}
      {cancelTarget && <div className={styles.cancelBackdrop} role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !updating) setCancelTarget(null); }}>
        <section className={styles.cancelDialog} role="dialog" aria-modal="true" aria-labelledby="cancel-order-title">
          <h2 id="cancel-order-title">Cancel order #{cancelTarget.id.slice(0, 8).toUpperCase()}?</h2>
          <p>This order is recorded as paid. Handle any cash refund or GCash reversal separately.</p>
          <label htmlFor="cancel-order-reason">Reason <span>Required</span></label>
          <textarea id="cancel-order-reason" value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} rows={3} maxLength={300} placeholder="Why is this order being cancelled?" />
          {cancelError && <div role="alert" className={styles.cancelError}>{cancelError}</div>}
          <div className={styles.cancelDialogActions}>
            <button type="button" onClick={() => setCancelTarget(null)} disabled={updating}>Keep order</button>
            <button type="button" onClick={confirmCancellation} disabled={updating}>{updating ? "Cancelling…" : "Confirm cancellation"}</button>
          </div>
        </section>
      </div>}
    </div>
  );
}
