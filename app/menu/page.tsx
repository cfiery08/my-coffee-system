"use client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import SystemIcon from "@/app/components/SystemIcon";
import MenuCard from "../components/MenuCard";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";

type Category = { id: string; name: string };
type MenuItem = { id: string; name: string; description: string; price: number; image_url: string | null; category_id: string; available: boolean };
type MenuReviewSummary = { thumbs_up: number; thumbs_down: number };
type PublicReview = { customer_name: string; is_own?: boolean; rating: number; would_order_again: boolean | null; comment: string; created_at: string };

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [active, setActive] = useState("All");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const [reviewSummary, setReviewSummary] = useState<Record<string, MenuReviewSummary>>({});
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [showReviews, setShowReviews] = useState(false);
  const toastIdRef = useRef(0);
  const { add } = useCart();
  const { session, loading: authLoading } = useAuth();
  const router = useRouter();

  function addToCart(item: MenuItem, quantity: number) {
    if (!session) { router.push("/login"); return; }
    add({ id: item.id, name: item.name, price: item.price, image_url: item.image_url ?? undefined }, quantity);
    const id = ++toastIdRef.current;
    setToasts((prev) => [...prev, { id, text: `${item.name} added to cart` }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2500);
  }

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: menuItems }] = await Promise.all([
        supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
        supabase.from("menu_items").select("id, name, description, price, image_url, category_id").eq("is_available", true),
      ]);

      const rows = menuItems ?? [];
      const [{ data: unavailableRows }, { data: itemReviewRows }] = await Promise.all([
        supabase.rpc("get_unavailable_menu_item_ids", { p_menu_item_ids: rows.map((item) => item.id) }),
        supabase.rpc("get_menu_item_review_summary", { p_menu_item_ids: rows.map((item) => item.id) }),
      ]);
      const unavailableIds = new Set((unavailableRows ?? []).map((row: { menu_item_id: string }) => row.menu_item_id));
      const summaryMap: Record<string, MenuReviewSummary> = {};
      (itemReviewRows ?? []).forEach((row: { menu_item_id: string; thumbs_up: number; thumbs_down: number }) => {
        summaryMap[row.menu_item_id] = { thumbs_up: Number(row.thumbs_up), thumbs_down: Number(row.thumbs_down) };
      });
      setCategories(cats ?? []);
      setItems(rows.map((item) => ({ ...item, available: !unavailableIds.has(item.id) })));
      setReviewSummary(summaryMap);
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    supabase.rpc("get_public_order_reviews").then(({ data }) => {
      if (!cancelled) setReviews((data ?? []) as PublicReview[]);
    });
    return () => { cancelled = true; };
  }, [authLoading, session?.user.id]);

  const filtered = active === "All" ? items : items.filter((i) => {
    const cat = categories.find((c) => c.id === i.category_id);
    return cat?.name === active;
  });

  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* Floating toasts */}
      <div style={{ position: "fixed", bottom: "28px", right: "28px", zIndex: 999, display: "flex", flexDirection: "column", gap: "8px", alignItems: "flex-end", pointerEvents: "none" }}>
        {toasts.map((t) => (
          <div key={t.id} style={{ background: "#21140b", color: "#fff", padding: "12px 20px", borderRadius: "8px", fontWeight: 600, fontSize: "13px", boxShadow: "0 4px 16px rgba(0,0,0,0.25)", borderLeft: "4px solid #b16b16" }}>
            {t.text}
          </div>
        ))}
      </div>

      {/* Menu Header Banner */}
      <section className="relative w-full h-[260px] overflow-hidden">
        <Image src="/finalmenuback.png" alt="Menu Banner" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex flex-col justify-center px-12" style={{ maxWidth: "520px" }}>
          <div className="flex items-center gap-2 mb-3">
            <Image src="/logo.png" alt="Logo" width={38} height={38} className="rounded-full object-cover flex-shrink-0" />
            <span className="font-extrabold text-sm tracking-widest uppercase" style={{ color: "#d4900a" }}>OUR MENU</span>
          </div>
          <h2 className="text-white font-extrabold text-4xl leading-tight mb-1">Made with quality,</h2>
          <p className="text-3xl italic font-semibold mb-3" style={{ color: "#d4900a", fontFamily: "Georgia, serif" }}>served with heart.</p>
          <p className="text-white/85 text-xs leading-relaxed" style={{ maxWidth: "320px" }}>
            Explore our selection of premium coffee and delightful treats, crafted with passion and the finest ingredients.
          </p>
        </div>
      </section>

      {/* Category Filter + Items */}
      <section className="px-10 py-8">
        {reviews.length > 0 && <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#eadfd5] bg-[#fffaf5] px-4 py-3">
          <span className="inline-flex text-amber-500">{[1, 2, 3, 4, 5].map((star) => <SystemIcon key={star} name="star" size={15} style={{ color: star <= Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) ? "#f59e0b" : "#e5e7eb", fill: star <= Math.round(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length) ? "#f59e0b" : "none" }} />)}</span>
          <strong className="text-sm text-[#21140b]">{(reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length).toFixed(1)} / 5</strong>
          <span className="text-xs text-[#8b7766]">{reviews.length} customer review{reviews.length === 1 ? "" : "s"}</span>
          <button type="button" onClick={() => setShowReviews(true)} className="ml-auto text-xs font-bold text-[#7c4a1e] underline underline-offset-2">View reviews</button>
        </div>}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {["All", ...categories.map((c) => c.name)].map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  active === cat ? "bg-amber-700 border-amber-700 text-white" : "bg-white border-gray-300 text-gray-700 hover:border-amber-700 hover:text-amber-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-20">No items available.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {filtered.map((item) => (
              <MenuCard
                key={item.id}
                item={{
                  name: item.name,
                  desc: item.description,
                  price: `₱${item.price.toFixed(2)}`,
                  img: item.image_url ?? "/logo.png",
                  available: item.available,
                  reviewSummary: reviewSummary[item.id],
                }}
                onAdd={(qty) => addToCart(item, qty)}
                onAddStart={() => { if (!session) { router.push("/login"); return false; } return true; }}
              />
            ))}
          </div>
        )}
      </section>

      {showReviews && <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-4" onClick={() => setShowReviews(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="public-reviews-title" className="max-h-[82vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(event) => event.stopPropagation()}>
          <header className="flex items-center justify-between border-b border-[#f0e8df] px-5 py-4">
            <div><h2 id="public-reviews-title" className="font-extrabold text-[#21140b]">Customer Reviews</h2><p className="text-xs text-[#8b7766]">{reviews.length} review{reviews.length === 1 ? "" : "s"} · Names are shown anonymously</p></div>
            <button type="button" onClick={() => setShowReviews(false)} aria-label="Close reviews" className="rounded-full px-2 py-1 text-xl text-[#8b7766] hover:bg-[#f7f0e7]">×</button>
          </header>
          <div className="max-h-[65vh] space-y-3 overflow-y-auto p-5">
            {reviews.map((review, index) => <article key={`${review.created_at}-${index}`} className="rounded-xl border border-[#eee3d9] bg-[#fffdfa] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <strong className="text-sm text-[#21140b]">{review.is_own ? "You" : review.customer_name}</strong>
                <span className="inline-flex">{[1, 2, 3, 4, 5].map((star) => <SystemIcon key={star} name="star" size={14} style={{ color: star <= review.rating ? "#f59e0b" : "#e5e7eb", fill: star <= review.rating ? "#f59e0b" : "none" }} />)}</span>
              </div>
              <p className="mt-1 flex items-center gap-2 text-xs text-[#9a8777]">{new Date(review.created_at).toLocaleDateString()}{review.would_order_again !== null && <span className="inline-flex items-center gap-1"><SystemIcon name={review.would_order_again ? "thumbUp" : "thumbDown"} size={13} /> {review.would_order_again ? "Would order again" : "Would not order again"}</span>}</p>
              {review.comment ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-[#5a4a3d]">“{review.comment}”</p> : <p className="mt-3 text-xs italic text-[#9a8777]">No written comment.</p>}
            </article>)}
            {reviews.length === 0 && <p className="py-10 text-center text-sm text-[#8b7766]">No customer reviews yet.</p>}
          </div>
        </section>
      </div>}
    </div>
  );
}
