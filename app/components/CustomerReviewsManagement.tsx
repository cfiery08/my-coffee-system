"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import SystemIcon from "@/app/components/SystemIcon";

type OrderReview = {
  order_id: string;
  customer_name: string;
  rating: number;
  would_order_again: boolean | null;
  comment: string;
  created_at: string;
};
type ItemReview = {
  order_item_id: string;
  order_id: string;
  menu_item_name: string;
  image_url: string | null;
  liked: boolean;
  customer_name: string;
  created_at: string;
};

const ACCENT = "#7c4a1e";

export default function CustomerReviewsManagement() {
  const [tab, setTab] = useState<"orders" | "items">("orders");
  const [orderReviews, setOrderReviews] = useState<OrderReview[]>([]);
  const [itemReviews, setItemReviews] = useState<ItemReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [ordersResult, itemsResult] = await Promise.all([
      supabase.rpc("list_order_reviews_for_staff"),
      supabase.rpc("list_item_reviews_for_staff"),
    ]);
    if (ordersResult.error || itemsResult.error) {
      setError(ordersResult.error?.message || itemsResult.error?.message || "Could not load customer reviews.");
    } else {
      setError("");
      setOrderReviews((ordersResult.data ?? []) as OrderReview[]);
      setItemReviews((itemsResult.data ?? []) as ItemReview[]);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const average = orderReviews.length
    ? orderReviews.reduce((sum, review) => sum + review.rating, 0) / orderReviews.length
    : 0;

  return (
    <div className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-[#21140b]">Customer Reviews</h1>
          <p className="mt-1 text-sm text-[#8b7766]">Read order feedback and individual menu item ratings.</p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-[#e5d7ca] bg-white px-4 py-2 text-sm font-semibold text-[#5a3e2b] hover:bg-[#faf7f4]">Refresh</button>
      </header>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">Could not load reviews: {error}. Run the customer reviews migration in Supabase.</div>}

      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Order reviews" value={orderReviews.length} />
        <Summary label="Average rating" value={orderReviews.length ? `${average.toFixed(1)} / 5` : "—"} />
        <Summary label="Item ratings" value={itemReviews.length} />
      </div>

      <div className="flex gap-2 border-b border-[#e9ddd2]">
        {([{ id: "orders", label: `Order Reviews (${orderReviews.length})` }, { id: "items", label: `Item Ratings (${itemReviews.length})` }] as const).map((item) => (
          <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`border-b-2 px-4 py-3 text-sm font-bold ${tab === item.id ? "border-[#7c4a1e] text-[#7c4a1e]" : "border-transparent text-[#8b7766] hover:text-[#5a3e2b]"}`}>
            {item.label}
          </button>
        ))}
      </div>

      {loading ? <p className="py-12 text-center text-sm text-[#8b7766]">Loading reviews...</p> : tab === "orders" ? (
        orderReviews.length === 0 ? <Empty>No order reviews yet.</Empty> :
          <div className="grid gap-3 lg:grid-cols-2">
            {orderReviews.map((review) => <article key={review.order_id} className="rounded-xl border border-[#eee3d9] bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-[#21140b]">{review.customer_name}</p>
                  <p className="text-xs text-[#9a8777]">Order #{review.order_id.slice(0, 8).toUpperCase()} · {new Date(review.created_at).toLocaleString()}</p>
                </div>
                <span className="inline-flex whitespace-nowrap">{[1, 2, 3, 4, 5].map((star) => <SystemIcon key={star} name="star" size={14} style={{ color: star <= review.rating ? "#f59e0b" : "#e5e7eb", fill: star <= review.rating ? "#f59e0b" : "none" }} />)}</span>
              </div>
              <div className="mt-3 flex items-center gap-2 text-sm text-[#665344]">
                {review.would_order_again === null ? <span>No repeat-order vote</span> : <span className="inline-flex items-center gap-1"><SystemIcon name={review.would_order_again ? "thumbUp" : "thumbDown"} size={15} /> {review.would_order_again ? "Would order again" : "Would not order again"}</span>}
              </div>
              {review.comment && <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5a4a3d]">“{review.comment}”</p>}
            </article>)}
          </div>
      ) : itemReviews.length === 0 ? <Empty>No menu item ratings yet.</Empty> : (
        <div className="overflow-hidden rounded-xl border border-[#eee3d9] bg-white shadow-sm">
          <div className="divide-y divide-[#f0e8df]">
            {itemReviews.map((review) => <div key={review.order_item_id} className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-5">
              {review.image_url ? <img src={review.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#f7f0e7]"><SystemIcon name="coffee" size={22} /></div>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-[#21140b]">{review.menu_item_name}</p>
                <p className="text-xs text-[#9a8777]">{review.customer_name} · Order #{review.order_id.slice(0, 8).toUpperCase()} · {new Date(review.created_at).toLocaleDateString()}</p>
              </div>
              <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${review.liked ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}><SystemIcon name={review.liked ? "thumbUp" : "thumbDown"} size={14} /> {review.liked ? "Liked" : "Disliked"}</span>
            </div>)}
          </div>
        </div>
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number | string }) {
  return <div className="rounded-xl border border-[#eee3d9] bg-white p-4 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wide text-[#9a8777]">{label}</p><p className="mt-1 text-2xl font-extrabold text-[#21140b]">{value}</p></div>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-[#dfcdbd] bg-white py-14 text-center text-sm text-[#8b7766]">{children}</div>;
}
