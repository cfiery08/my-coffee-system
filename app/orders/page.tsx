"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Navbar from "../components/Navbar";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

type OrderItem = { id: string; menu_item_name: string; quantity: number; unit_price: number; subtotal: number };
type Order = {
  id: string;
  order_type: string;
  status: string;
  payment_method: string | null;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  notes: string | null;
  delivery_address_snapshot: string | null;
  created_at: string;
  order_items: OrderItem[];
};

const ACCENT = "#b16b16";

const STATUS_COLOR: Record<string, string> = {
  pending: "#f59e0b",
  confirmed: "#3b82f6",
  preparing: "#f97316",
  ready: "#16a34a",
  out_for_delivery: "#9333ea",
  delivered: "#22c55e",
  cancelled: "#6b7280",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const DELIVERY_STEPS = [
  { key: "pending", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "out_for_delivery", label: "On the Way" },
  { key: "delivered", label: "Delivered" },
];

const PICKUP_STEPS = [
  { key: "pending", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "delivered", label: "Picked Up" },
];

const TERMINAL = new Set(["delivered", "cancelled"]);
const ACTIVE_STATUSES = new Set(["pending", "confirmed", "preparing", "ready", "out_for_delivery"]);

function ProgressBar({ status, orderType }: { status: string; orderType: string }) {
  const steps = orderType === "pickup" ? PICKUP_STEPS : DELIVERY_STEPS;
  const currentIdx = steps.findIndex((s) => s.key === status);
  const pct = currentIdx <= 0 ? 0 : (currentIdx / (steps.length - 1)) * 100;
  return (
    <div style={{ margin: "20px 0 8px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", position: "relative" }}>
        <div style={{ position: "absolute", top: "10px", left: "10px", right: "10px", height: "2px", background: "#f0e8df", zIndex: 0 }} />
        <div style={{ position: "absolute", top: "10px", left: "10px", height: "2px", zIndex: 1, background: ACCENT, width: `calc(${pct}% * (100% - 20px) / 100%)`, transition: "width 0.5s ease" }} />
        {steps.map((step, i) => {
          const done = i <= currentIdx;
          const active = i === currentIdx;
          return (
            <div key={step.key} style={{ display: "flex", flexDirection: "column", alignItems: "center", zIndex: 2, flex: 1 }}>
              <div style={{
                width: "20px", height: "20px", borderRadius: "50%",
                background: done ? ACCENT : "#f5ede6",
                border: `2px solid ${done ? ACCENT : "#e0d6cc"}`,
                boxShadow: active ? `0 0 0 3px ${ACCENT}33` : "none",
                transition: "all 0.3s",
              }} />
              <span style={{ marginTop: "6px", fontSize: "10px", fontWeight: active ? 700 : 400, color: done ? "#5a3e2b" : "#bbb", textAlign: "center", lineHeight: 1.3 }}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OrderDetailModal({ order, onClose, onCancel }: { order: Order; onClose: () => void; onCancel: (id: string) => void }) {
  const isCompleted = order.status === "delivered";
  const isCancelled = order.status === "cancelled";
  const statusColor = STATUS_COLOR[order.status] || "#888";

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}
      onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: "16px", width: "100%", maxWidth: "500px", maxHeight: "90vh", overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
        onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div style={{ padding: "18px 22px", borderBottom: "1px solid #f0e8df", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ color: "#21140b", fontWeight: 800, fontSize: "15px" }}>#{order.id.slice(0, 8).toUpperCase()}</div>
            <div style={{ color: "#aaa", fontSize: "12px", marginTop: "2px" }}>{new Date(order.created_at).toLocaleString()}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: `${statusColor}18`, color: statusColor, border: `1px solid ${statusColor}40`, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              {STATUS_LABEL[order.status] || order.status}
            </span>
            <button onClick={onClose} style={{ background: "none", border: "none", color: "#aaa", fontSize: "18px", cursor: "pointer" }}>✕</button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px" }}>

          {/* Progress bar */}
          {!isCancelled && !isCompleted && (
            <>
              <ProgressBar status={order.status} orderType={order.order_type} />
              <div style={{ height: "1px", background: "#f0e8df", margin: "16px 0" }} />
            </>
          )}

          {/* Order type + payment */}
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: order.order_type === "pickup" ? "rgba(99,102,241,0.1)" : `${ACCENT}18`, color: order.order_type === "pickup" ? "#6366f1" : ACCENT, border: `1px solid ${order.order_type === "pickup" ? "#6366f1" : ACCENT}40` }}>
              {order.order_type === "pickup" ? "Pick Up" : "Delivery"}
            </span>
            {order.payment_method && (
              <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: "rgba(34,197,94,0.08)", color: "#16a34a", border: "1px solid rgba(34,197,94,0.3)" }}>
                {order.payment_method === "cash" ? "Cash on Delivery" : order.payment_method === "gcash" ? "GCash" : "Card"}
              </span>
            )}
          </div>

          {/* Items */}
          <div style={{ fontSize: "11px", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "10px" }}>Items Ordered</div>
          {order.order_items.map((item) => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", padding: "8px 10px", background: "#fdf8f4", borderRadius: "8px" }}>
              <div>
                <div style={{ color: "#21140b", fontSize: "13px", fontWeight: 600 }}>{item.menu_item_name}</div>
                <div style={{ color: "#aaa", fontSize: "11px" }}>Qty: {item.quantity} × ₱{item.unit_price.toFixed(2)}</div>
              </div>
              <div style={{ color: "#5a3e2b", fontSize: "13px", fontWeight: 700 }}>₱{item.subtotal.toFixed(2)}</div>
            </div>
          ))}

          {/* Totals */}
          <div style={{ borderTop: "1px solid #f0e8df", paddingTop: "12px", marginTop: "8px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
              <span style={{ color: "#aaa", fontSize: "12px" }}>Subtotal</span>
              <span style={{ color: "#5a3e2b", fontSize: "12px" }}>₱{order.subtotal.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
              <span style={{ color: "#aaa", fontSize: "12px" }}>Delivery fee</span>
              <span style={{ color: "#5a3e2b", fontSize: "12px" }}>{order.delivery_fee > 0 ? `₱${order.delivery_fee.toFixed(2)}` : "Free"}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span style={{ color: "#21140b", fontWeight: 800, fontSize: "14px" }}>Total</span>
              <span style={{ color: ACCENT, fontWeight: 900, fontSize: "16px" }}>₱{order.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {/* Delivery address */}
          {order.delivery_address_snapshot && (
            <div style={{ marginTop: "14px", background: "#fdf8f4", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px" }}>
              <div style={{ color: "#aaa", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Delivery Address</div>
              <div style={{ color: "#21140b", fontSize: "13px" }}>{order.delivery_address_snapshot}</div>
            </div>
          )}

          {/* Notes */}
          {order.notes && (
            <div style={{ marginTop: "10px", background: "#fdf8f4", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px" }}>
              <div style={{ color: "#aaa", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Notes</div>
              <div style={{ color: "#5a3e2b", fontSize: "12px", lineHeight: 1.5, whiteSpace: "pre-line" }}>{order.notes}</div>
            </div>
          )}

          {/* Cancel button */}
          {order.status === "pending" && (
            <button
              onClick={() => { onCancel(order.id); onClose(); }}
              style={{ width: "100%", marginTop: "16px", background: "transparent", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", padding: "11px", color: "#ef4444", fontWeight: 700, fontSize: "12px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px" }}
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function OrdersPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "active" | "completed" | "cancelled">("all");
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("id, order_type, status, payment_method, payment_status, subtotal, delivery_fee, total_amount, notes, delivery_address_snapshot, created_at, order_items(id, menu_item_name, quantity, unit_price, subtotal)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setOrders((data as Order[]) ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/login"); return; }
    if (user) fetchOrders();
  }, [user, authLoading, fetchOrders, router]);

  const handleCancel = useCallback(async (orderId: string) => {
    setCancellingId(orderId);
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", orderId);
    setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: "cancelled" } : o));
    setCancellingId(null);
  }, []);

  const filteredOrders = orders.filter((o) => {
    if (filter === "active") return ACTIVE_STATUSES.has(o.status);
    if (filter === "completed") return o.status === "delivered";
    if (filter === "cancelled") return o.status === "cancelled";
    return true;
  });

  const counts = {
    all: orders.length,
    active: orders.filter((o) => ACTIVE_STATUSES.has(o.status)).length,
    completed: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
  };

  return (
    <main className="min-h-screen bg-[#f7f0e7] font-sans">
      <Navbar />

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-[#21140b] uppercase tracking-wide">My Orders</h1>
          <p className="text-sm text-[#7a5c44] mt-1">Track and review your order history</p>
        </div>

        {/* Filter tabs */}
        {!loading && orders.length > 0 && (
          <div className="flex gap-2 mb-6 flex-wrap">
            {([
              { key: "all", label: "All Orders", color: "#5a3e2b" },
              { key: "active", label: "Active", color: "#f59e0b" },
              { key: "completed", label: "Completed", color: "#16a34a" },
              { key: "cancelled", label: "Cancelled", color: "#6b7280" },
            ] as const).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold border transition-all"
                style={{
                  borderColor: filter === f.key ? f.color : "#e0d6cc",
                  background: filter === f.key ? `${f.color}18` : "#fff",
                  color: filter === f.key ? f.color : "#7a5c44",
                }}
              >
                {f.label}
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-bold" style={{ background: filter === f.key ? f.color : "#e0d6cc", color: filter === f.key ? "#fff" : "#7a5c44" }}>
                  {counts[f.key]}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: `${ACCENT} transparent transparent transparent` }} />
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-[#aaa] text-sm mb-4">You have no orders yet.</p>
            <Link href="/menu">
              <button className="text-white text-sm font-bold px-6 py-2.5 rounded-full hover:opacity-90 transition-opacity" style={{ background: ACCENT }}>
                Order Now
              </button>
            </Link>
          </div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-[#aaa] text-sm">No {filter} orders found.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-[#f0e8df] overflow-hidden shadow-sm">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.7fr_0.7fr] px-5 py-3 border-b border-[#f0e8df] bg-[#fdf8f4]">
              {["Order", "Date", "Type", "Status", "Total", ""].map((h) => (
                <div key={h} className="text-[11px] font-bold text-[#aaa] uppercase tracking-wide">{h}</div>
              ))}
            </div>

            {filteredOrders.map((order, idx) => {
              const statusColor = STATUS_COLOR[order.status] || "#888";
              const isLast = idx === filteredOrders.length - 1;
              return (
                <div
                  key={order.id}
                  className="grid grid-cols-1 md:grid-cols-[1.6fr_1fr_0.8fr_0.9fr_0.7fr_0.7fr] px-5 py-4 items-center transition-colors hover:bg-[#fdf8f4] cursor-pointer"
                  style={{ borderBottom: isLast ? "none" : "1px solid #f5ede6" }}
                  onClick={() => setDetailOrder(order)}
                >
                  {/* Order ID + items */}
                  <div>
                    <div className="font-bold text-[#21140b] text-sm">#{order.id.slice(0, 8).toUpperCase()}</div>
                    <div className="text-[11px] text-[#aaa] mt-0.5">
                      {order.order_items.slice(0, 2).map((i) => i.menu_item_name).join(", ")}
                      {order.order_items.length > 2 ? ` +${order.order_items.length - 2}` : ""}
                    </div>
                  </div>

                  {/* Date */}
                  <div>
                    <div className="text-sm text-[#5a3e2b]">{new Date(order.created_at).toLocaleDateString()}</div>
                    <div className="text-[11px] text-[#aaa]">{new Date(order.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</div>
                  </div>

                  {/* Type */}
                  <div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: order.order_type === "pickup" ? "rgba(99,102,241,0.1)" : `${ACCENT}18`, color: order.order_type === "pickup" ? "#6366f1" : ACCENT }}>
                      {order.order_type === "pickup" ? "Pick Up" : "Delivery"}
                    </span>
                  </div>

                  {/* Status */}
                  <div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: `${statusColor}18`, color: statusColor }}>
                      {STATUS_LABEL[order.status] || order.status}
                    </span>
                  </div>

                  {/* Total */}
                  <div className="font-bold text-sm" style={{ color: ACCENT }}>₱{order.total_amount.toFixed(2)}</div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 items-end" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => setDetailOrder(order)}
                      className="text-[11px] font-semibold px-3 py-1 rounded border border-[#e0d6cc] text-[#7a5c44] hover:border-[#b16b16] transition-colors"
                    >
                      Details
                    </button>
                    {order.status === "pending" && (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="text-[11px] font-semibold px-3 py-1 rounded border text-red-400 border-red-200 hover:border-red-400 transition-colors disabled:opacity-50"
                      >
                        {cancellingId === order.id ? "..." : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          onClose={() => setDetailOrder(null)}
          onCancel={handleCancel}
        />
      )}
    </main>
  );
}
