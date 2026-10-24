"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import Navbar from "../components/Navbar";
import { supabase } from "@/lib/supabaseClient";
import SystemIcon from "@/app/components/SystemIcon";
import { useAuth } from "@/lib/AuthContext";

type ItemReview = { liked: boolean };
type OrderItem = { id: string; menu_item_id: string | null; menu_item_name: string; image_url: string | null; menu_items?: { image_url: string | null } | null; quantity: number; unit_price: number; subtotal: number; review: ItemReview | null };
type OrderReview = { rating: number; would_order_again: boolean | null; comment: string; created_at: string };
type Order = {
  id: string;
  order_type: string;
  status: string;
  payment_method: string | null;
  payment_status: string;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  contact_number: string | null;
  notes: string | null;
  delivery_address_snapshot: string | null;
  created_at: string;
  review: OrderReview | null;
  order_items: OrderItem[];
};

const ACCENT = "#b16b16";
const CUSTOMER_CANCEL_WINDOW_MS = 10_000;

function cancelSecondsRemaining(order: Order, now: number) {
  return Math.max(0, Math.ceil((new Date(order.created_at).getTime() + CUSTOMER_CANCEL_WINDOW_MS - now) / 1000));
}

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

function OrderDetailModal({ order, onClose, onCancel, onRate, now }: { order: Order; onClose: () => void; onCancel: (id: string) => void; onRate: () => void; now: number }) {
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
            <button onClick={onClose} aria-label="Close review" style={{ background: "none", border: "none", color: "#aaa", cursor: "pointer", display: "flex" }}><SystemIcon name="x" size={18} /></button>
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
                {(item.image_url ?? item.menu_items?.image_url) ? <Image src={(item.image_url ?? item.menu_items?.image_url)!} alt={item.menu_item_name} width={52} height={52} sizes="52px" unoptimized fetchPriority="high" style={{ width: 52, height: 52, objectFit: "cover", borderRadius: 8, marginBottom: 6 }} /> : null}
                <div style={{ color: "#21140b", fontSize: "13px", fontWeight: 600 }}>{item.menu_item_name}</div>
                <div style={{ color: "#aaa", fontSize: "11px" }}>Qty: {item.quantity} × ₱{item.unit_price.toFixed(2)}</div>
              </div>
              <div style={{ color: "#5a3e2b", fontSize: "13px", fontWeight: 700 }}>₱{item.subtotal.toFixed(2)}</div>
            </div>
          ))}

          {isCompleted && (
            <div style={{ marginTop: 14, padding: 12, borderRadius: 10, background: "#fffaf0", border: "1px solid #f2dfbc" }}>
              {order.review ? (
                <>
                  <div style={{ display: "flex", color: "#f59e0b" }}>{[1, 2, 3, 4, 5].map((star) => <SystemIcon key={star} name="star" size={16} style={{ color: star <= order.review!.rating ? "#f59e0b" : "#e5e7eb", fill: star <= order.review!.rating ? "#f59e0b" : "none" }} />)}</div>
                  {order.review.would_order_again !== null && <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 4, fontSize: 12, color: "#6b5642" }}><SystemIcon name={order.review.would_order_again ? "thumbUp" : "thumbDown"} size={14} /> {order.review.would_order_again ? "Would order again" : "Would not order again"}</div>}
                  {order.review.comment && <p style={{ margin: "8px 0 0", color: "#6b5642", fontSize: 12 }}>{order.review.comment}</p>}
                  <button onClick={onRate} style={{ marginTop: 8, border: 0, padding: 0, background: "none", color: ACCENT, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Edit your review</button>
                </>
              ) : <button onClick={onRate} style={{ width: "100%", border: `1px solid ${ACCENT}`, borderRadius: 8, padding: 10, color: ACCENT, background: "white", fontWeight: 700, cursor: "pointer" }}>Rate this order</button>}
            </div>
          )}

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
          {order.contact_number && (
            <div style={{ marginTop: "14px", background: "#fdf8f4", border: "1px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px" }}>
              <div style={{ color: "#aaa", fontSize: "11px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: "4px" }}>Contact Number</div>
              <div style={{ color: "#21140b", fontSize: "13px" }}>{order.contact_number}</div>
            </div>
          )}

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
          {order.status === "pending" && order.payment_method !== "gcash" && cancelSecondsRemaining(order, now) > 0 ? (
            <button
              onClick={() => { onCancel(order.id); onClose(); }}
              style={{ width: "100%", marginTop: "16px", background: "transparent", border: "1px solid rgba(239,68,68,0.4)", borderRadius: "8px", padding: "11px", color: "#ef4444", fontWeight: 700, fontSize: "12px", cursor: "pointer", textTransform: "uppercase", letterSpacing: "1px" }}
            >
              Cancel Order · {cancelSecondsRemaining(order, now)}s
            </button>
          ) : order.status === "pending" && order.payment_method !== "gcash" ? (
            <button type="button" disabled aria-disabled="true" style={{ width: "100%", marginTop: "16px", background: "#f3f4f6", border: "1px solid #e5e7eb", borderRadius: "8px", padding: "11px", color: "#9ca3af", fontWeight: 700, fontSize: "12px", cursor: "not-allowed", textTransform: "uppercase", letterSpacing: "1px" }}>
              Cancel Order
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ReviewModal({
  order,
  onClose,
  onSubmitted,
  onItemReviewed,
}: {
  order: Order;
  onClose: () => void;
  onSubmitted: (orderId: string, review: OrderReview) => void;
  onItemReviewed: (orderId: string, itemId: string, liked: boolean) => void;
}) {
  const [rating, setRating] = useState(order.review?.rating ?? 0);
  const [wouldOrderAgain, setWouldOrderAgain] = useState<boolean | null>(order.review?.would_order_again ?? null);
  const [comment, setComment] = useState(order.review?.comment ?? "");
  const [saving, setSaving] = useState(false);
  const [savingItem, setSavingItem] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function saveItemVote(item: OrderItem, liked: boolean) {
    setSavingItem(item.id);
    setError("");
    const { error: rpcError } = await supabase.rpc("submit_order_item_review", { p_order_item_id: item.id, p_liked: liked });
    if (rpcError) setError(rpcError.message);
    else onItemReviewed(order.id, item.id, liked);
    setSavingItem(null);
  }

  async function submitReview() {
    if (!rating) { setError("Select a star rating for your order."); return; }
    setSaving(true);
    setError("");
    const { error: rpcError } = await supabase.rpc("submit_order_review", {
      p_order_id: order.id,
      p_rating: rating,
      p_would_order_again: wouldOrderAgain,
      p_comment: comment.trim(),
    });
    if (rpcError) setError(rpcError.message);
    else {
      onSubmitted(order.id, { rating, would_order_again: wouldOrderAgain, comment: comment.trim(), created_at: new Date().toISOString() });
      onClose();
    }
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-labelledby="review-title" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-7" onClick={(event) => event.stopPropagation()}>
        <div className="mb-5 flex items-center justify-between gap-3">
          <div><h2 id="review-title" className="text-lg font-extrabold text-[#21140b]">Rate Your Order</h2><p className="text-xs text-[#9a8777]">Order #{order.id.slice(0, 8).toUpperCase()}</p></div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full px-2 py-1 text-xl text-[#8b7766] hover:bg-[#f7f0e7]">×</button>
        </div>

        <h3 className="mb-2 text-sm font-bold text-[#5a3e2b]">Rate each item</h3>
        <div className="mb-5 space-y-2">
          {order.order_items.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-xl bg-[#faf7f4] p-2.5">
            {(item.image_url ?? item.menu_items?.image_url) ? <Image src={(item.image_url ?? item.menu_items?.image_url)!} alt={item.menu_item_name} width={48} height={48} sizes="48px" quality={65} fetchPriority="high" className="h-12 w-12 rounded-lg object-cover" /> : <div className="grid h-12 w-12 place-items-center rounded-lg bg-[#f1ebe5]"><SystemIcon name="coffee" size={22} /></div>}
            <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-[#21140b]">{item.menu_item_name}</p><p className="text-xs text-[#9a8777]">Qty: {item.quantity}</p></div>
            {item.review ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#8b7766]">Your vote: <SystemIcon name={item.review.liked ? "thumbUp" : "thumbDown"} size={13} /></span> : null}
            <div className="flex gap-1">
              {[true, false].map((liked) => <button key={String(liked)} type="button" disabled={savingItem === item.id} onClick={() => void saveItemVote(item, liked)} aria-label={liked ? `Like ${item.menu_item_name}` : `Dislike ${item.menu_item_name}`} className={`rounded-lg border px-2 py-1 text-sm ${item.review?.liked === liked ? liked ? "border-green-500 bg-green-50" : "border-red-400 bg-red-50" : "border-[#eadfd5] bg-white"}`}>
                <SystemIcon name={liked ? "thumbUp" : "thumbDown"} size={16} />
              </button>)}
            </div>
          </div>)}
        </div>

        <h3 className="mb-2 text-sm font-bold text-[#5a3e2b]">Overall experience</h3>
        <div className="mb-5 flex gap-1" role="radiogroup" aria-label="Overall rating">
          {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" role="radio" aria-checked={rating === star} aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => setRating(star)} className={`transition-colors ${star <= rating ? "text-amber-400" : "text-gray-200"}`}><SystemIcon name="star" size={28} style={{ fill: star <= rating ? "currentColor" : "none" }} /></button>)}
        </div>
        <h3 className="mb-2 text-sm font-bold text-[#5a3e2b]">Would you order again?</h3>
        <div className="mb-5 flex gap-2">
          {[true, false].map((answer) => <button key={String(answer)} type="button" onClick={() => setWouldOrderAgain(wouldOrderAgain === answer ? null : answer)} className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${wouldOrderAgain === answer ? answer ? "border-green-500 bg-green-50 text-green-700" : "border-red-400 bg-red-50 text-red-700" : "border-[#eadfd5] text-[#776555]"}`}><SystemIcon name={answer ? "thumbUp" : "thumbDown"} size={16} /> {answer ? "Yes" : "No"}</button>)}
        </div>
        <label htmlFor="order-review-comment" className="mb-2 block text-sm font-bold text-[#5a3e2b]">Comment <span className="font-normal text-[#9a8777]">(optional)</span></label>
        <textarea id="order-review-comment" value={comment} maxLength={1000} onChange={(event) => setComment(event.target.value)} rows={4} placeholder="Tell us what you liked or what we can improve..." className="mb-1 w-full resize-y rounded-lg border border-[#eadfd5] p-3 text-sm outline-none focus:border-[#b16b16]" />
        <p className="mb-4 text-right text-xs text-[#9a8777]">{comment.length}/1000</p>
        {error && <p role="alert" className="mb-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-700">{error}</p>}
        <button type="button" onClick={() => void submitReview()} disabled={saving} className="w-full rounded-lg bg-[#7c4a1e] py-3 text-sm font-extrabold text-white disabled:opacity-60">{saving ? "Saving..." : order.review ? "Update Review" : "Submit Review"}</button>
      </section>
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
  const [ratingOrder, setRatingOrder] = useState<Order | null>(null);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [cancellationError, setCancellationError] = useState("");
  const [gcashMessage, setGcashMessage] = useState("");
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, []);

  // Warm the browser cache while the order list is visible, before an order
  // detail modal is opened. The detail image uses the original URL as well.
  useEffect(() => {
    if (!orders.length) return;
    const imageUrls = new Set(
      orders.flatMap((order) => order.order_items
        .map((item) => item.image_url ?? item.menu_items?.image_url)
        .filter((url): url is string => Boolean(url)))
    );
    imageUrls.forEach((url) => {
      const image = new window.Image();
      image.decoding = "async";
      image.setAttribute("fetchpriority", "low");
      image.src = url;
    });
  }, [orders]);

  const fetchOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("orders")
      .select("id, order_type, status, payment_method, payment_status, subtotal, delivery_fee, total_amount, contact_number, notes, delivery_address_snapshot, created_at, order_items(id, menu_item_id, menu_item_name, image_url, quantity, unit_price, subtotal, menu_items(image_url))")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    const rows = (data ?? []) as unknown as Order[];
    const ids = rows.map((order) => order.id);
    const itemIds = rows.flatMap((order) => order.order_items.map((item) => item.id));
    const [orderReviewResult, itemReviewResult] = ids.length ? await Promise.all([
      supabase.from("order_reviews").select("order_id, rating, would_order_again, comment, created_at").in("order_id", ids),
      supabase.from("order_item_reviews").select("order_item_id, liked").in("order_item_id", itemIds),
    ]) : [{ data: [], error: null }, { data: [], error: null }];
    const reviewsByOrder = new Map((orderReviewResult.data ?? []).map((review) => [review.order_id, review as OrderReview]));
    const reviewsByItem = new Map((itemReviewResult.data ?? []).map((review) => [review.order_item_id, { liked: review.liked }]));
    const hydratedOrders = rows.map((order) => ({
      ...order,
      review: reviewsByOrder.get(order.id) ?? null,
      order_items: order.order_items.map((item) => ({ ...item, review: reviewsByItem.get(item.id) ?? null })),
    }));
    setOrders(hydratedOrders);
    setDetailOrder((current) => current ? hydratedOrders.find((order) => order.id === current.id) ?? current : null);
    setRatingOrder((current) => current ? hydratedOrders.find((order) => order.id === current.id) ?? current : null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!authLoading && !user) { router.replace("/login"); return; }
    if (user) fetchOrders();
  }, [user, authLoading, fetchOrders, router]);

  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    const paymentResult = params.get("payment");
    if (paymentResult !== "gcash-success" && paymentResult !== "gcash-cancelled") return;
    const orderId = params.get("order_id");
    window.history.replaceState({}, "", "/orders");

    if (paymentResult === "gcash-cancelled") {
      setGcashMessage("GCash checkout was cancelled. This order is still unpaid.");
      return;
    }

    setGcashMessage("");
    let attempts = 0;
    const poll = window.setInterval(async () => {
      attempts += 1;
      if (orderId) {
        const { data } = await supabase.from("orders").select("payment_status").eq("id", orderId).maybeSingle();
        if (data?.payment_status === "paid") {
          setGcashMessage("GCash payment confirmed. Your order is paid.");
          await fetchOrders();
          window.clearInterval(poll);
          return;
        }
      }
      if (attempts >= 12) {
        window.clearInterval(poll);
      }
    }, 2500);
    return () => window.clearInterval(poll);
  }, [user, fetchOrders]);

  const handleCancel = useCallback(async (orderId: string) => {
    setCancellationError("");
    setCancellingId(orderId);
    const cutoff = new Date(Date.now() - CUSTOMER_CANCEL_WINDOW_MS).toISOString();
    const { data, error } = await supabase.from("orders").update({ status: "cancelled" })
      .eq("id", orderId).eq("status", "pending").gt("created_at", cutoff).select("id").maybeSingle();
    if (error || !data) setCancellationError("The cancellation window expired, or this order is no longer pending.");
    await fetchOrders();
    setCancellingId(null);
  }, [fetchOrders]);

  function handleReviewSubmitted(orderId: string, review: OrderReview) {
    setOrders((previous) => previous.map((order) => order.id === orderId ? { ...order, review } : order));
    setDetailOrder((previous) => previous?.id === orderId ? { ...previous, review } : previous);
    setRatingOrder((previous) => previous?.id === orderId ? { ...previous, review } : previous);
  }

  function handleItemReviewed(orderId: string, itemId: string, liked: boolean) {
    const apply = (order: Order) => order.id !== orderId ? order : {
      ...order,
      order_items: order.order_items.map((item) => item.id === itemId ? { ...item, review: { liked } } : item),
    };
    setOrders((previous) => previous.map(apply));
    setDetailOrder((previous) => previous ? apply(previous) : previous);
    setRatingOrder((previous) => previous ? apply(previous) : previous);
  }

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
        {gcashMessage && <p role="status" className="mb-4 rounded-lg border border-[#e8ddd4] bg-white px-3 py-2.5 text-sm text-[#5a3e2b]">{gcashMessage}</p>}
        {cancellationError && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{cancellationError}</p>}

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
                    {order.status === "delivered" && !order.review && <button onClick={() => setRatingOrder(order)} className="rounded border border-amber-300 px-3 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-50">Rate Order</button>}
                    {order.status === "pending" && order.payment_method !== "gcash" && cancelSecondsRemaining(order, now) > 0 ? (
                      <button
                        onClick={() => handleCancel(order.id)}
                        disabled={cancellingId === order.id}
                        className="text-[11px] font-semibold px-3 py-1 rounded border text-red-400 border-red-200 hover:border-red-400 transition-colors disabled:opacity-50"
                      >
                        {cancellingId === order.id ? "..." : `Cancel · ${cancelSecondsRemaining(order, now)}s`}
                      </button>
                    ) : order.status === "pending" && order.payment_method !== "gcash" ? (
                      <button type="button" disabled aria-disabled="true" className="cursor-not-allowed rounded border border-gray-200 bg-gray-100 px-3 py-1 text-[11px] font-semibold text-gray-400">
                        Cancel
                      </button>
                    ) : null}
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
          onRate={() => setRatingOrder(detailOrder)}
          now={now}
        />
      )}
      {ratingOrder && <ReviewModal order={ratingOrder} onClose={() => setRatingOrder(null)} onSubmitted={handleReviewSubmitted} onItemReviewed={handleItemReviewed} />}
    </main>
  );
}
