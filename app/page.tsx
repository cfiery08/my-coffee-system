"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Navbar from "./components/Navbar";
import MenuCard from "./components/MenuCard";
import { supabase } from "@/lib/supabaseClient";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";

type MenuItem = { id: string; name: string; description: string; price: number; image_url: string | null };

export default function Home() {
  const [featured, setFeatured] = useState<MenuItem[]>([]);
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
    supabase
      .from("menu_items")
      .select("id, name, description, price, image_url")
      .eq("is_featured", true)
      .eq("is_available", true)
      .limit(4)
      .then(({ data }) => setFeatured(data ?? []));
  }, []);

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

      {/* Hero Section */}
      <section className="relative w-full h-[420px] overflow-hidden">
        <Image src="/homepage.png" alt="Coffee Hero" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-black/45" />
        <div className="absolute inset-0 flex flex-col justify-center px-16" style={{ maxWidth: "600px" }}>
          <p className="text-white italic font-light text-xl mb-1" style={{ fontFamily: "Georgia, serif" }}>
            Good days start with coffee.
          </p>
          <h1 className="text-white font-extrabold text-5xl leading-tight uppercase">YOUR DAILY CUP</h1>
          <div className="flex items-center gap-3 mb-3">
            <h1 className="font-extrabold text-5xl uppercase" style={{ color: "#d4900a" }}>OF COMFORT</h1>
            <Image src="/logo.png" alt="Logo" width={50} height={50} className="rounded-full object-cover flex-shrink-0" />
          </div>
          <p className="text-white/90 text-sm mb-6 leading-relaxed">
            Handcrafted coffee made with premium beans<br />and passion in every cup.
          </p>
          <div className="flex gap-4">
            <Link href="/menu" style={{ backgroundColor: "#7c4a1e" }} className="hover:opacity-90 text-white text-sm font-semibold px-7 py-2.5 rounded-full transition-opacity">
              ORDER NOW
            </Link>
            <Link href="/menu" className="border border-white text-white text-sm font-semibold px-7 py-2.5 rounded-full hover:bg-white/10 transition-colors">
              VIEW MORE
            </Link>
          </div>
        </div>
      </section>

      {/* Popular Picks */}
      <section className="px-10 py-10">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-extrabold text-gray-900 uppercase tracking-wide">Popular Picks</h2>
          <Link href="/menu" className="text-sm font-medium text-gray-700 hover:text-amber-700 flex items-center gap-1 transition-colors">
            View All →
          </Link>
        </div>

        {featured.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-10">No featured items yet.</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
            {featured.map((item) => (
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
