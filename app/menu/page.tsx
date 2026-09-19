"use client";
import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import MenuCard from "../components/MenuCard";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";

type Category = { id: string; name: string };
type MenuItem = { id: string; name: string; description: string; price: number; image_url: string | null; category_id: string };

export default function MenuPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [active, setActive] = useState("All");
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; text: string }[]>([]);
  const toastIdRef = useRef(0);
  const { add } = useCart();
  const { session } = useAuth();
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
      setCategories(cats ?? []);
      setItems(menuItems ?? []);
      setLoading(false);
    }
    load();
  }, []);

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
        <Image src="/menuback.png" alt="Menu Banner" fill className="object-cover object-center" priority />
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
                }}
                onAdd={(qty) => addToCart(item, qty)}
                onAddStart={() => { if (!session) { router.push("/login"); return false; } return true; }}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
