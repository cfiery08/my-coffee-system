"use client";
import Image from "next/image";
import { useState } from "react";
import Navbar from "../components/Navbar";
import MenuCard from "../components/MenuCard";

const menuItems = [
  {
    name: "Caramel Macchiato",
    desc: "Espresso, steamed milk, and sweet caramel drizzle.",
    price: "₱145.00",
    img: "/Caramel-Macchiato.jpg",
    imgPos: "50% 60%",
    category: "Espresso",
  },
  {
    name: "Classic Latte",
    desc: "Smooth espresso with creamy steamed milk.",
    price: "₱135.00",
    img: "/classic_latte.webp",
    imgPos: "center",
    category: "Espresso",
  },
  {
    name: "Mocha Frappe",
    desc: "Rich chocolate, espresso, and creamy blended ice.",
    price: "₱155.00",
    img: "/Mocha_Frappe.png",
    imgPos: "center",
    category: "Cold brews",
  },
  {
    name: "Matcha Latte",
    desc: "Smooth espresso with creamy milk and a hint of sweetness.",
    price: "₱150.00",
    img: "/Matcha_Latte.jpg",
    imgPos: "center",
    category: "Matcha",
  },
  {
    name: "Espresso Shot",
    desc: "Pure, bold espresso with a rich crema on top.",
    price: "₱95.00",
    img: "/Espresso_Shot.jpg",
    imgPos: "center",
    category: "Espresso",
  },
  {
    name: "Cappuccino",
    desc: "Equal parts espresso, steamed milk, and thick foam.",
    price: "₱130.00",
    img: "/Cappuccino.jpg",
    imgPos: "center",
    category: "Espresso",
  },
  {
    name: "Iced Americano",
    desc: "Chilled espresso shots over ice with cold water.",
    price: "₱120.00",
    img: "/Iced_Americano.jpg",
    imgPos: "center",
    category: "Cold brews",
  },
  {
    name: "Cold Brew",
    desc: "Slow-steeped coffee, smooth and naturally sweet.",
    price: "₱140.00",
    img: "/Cold_Brew.jpg",
    imgPos: "center",
    category: "Cold brews",
  },
  {
    name: "Matcha Frappe",
    desc: "Blended matcha with milk and ice, topped with cream.",
    price: "₱160.00",
    img: "/Matcha_Frappe_v2.jpg",
    imgPos: "center",
    category: "Matcha",
  },
  {
    name: "Matcha Espresso",
    desc: "Bold espresso layered over smooth matcha milk.",
    price: "₱165.00",
    img: "/Matcha_Espresso_v2.jpg",
    imgPos: "center",
    category: "Matcha",
  },
  {
    name: "Chamomile Tea",
    desc: "Soothing floral chamomile, served hot or iced.",
    price: "₱110.00",
    img: "/Chamomile_Tea.jpg",
    imgPos: "center",
    category: "Tea",
  },
  {
    name: "Earl Grey Latte",
    desc: "Fragrant Earl Grey tea with steamed milk and honey.",
    price: "₱125.00",
    img: "/Earl_Grey_Latte.jpg",
    imgPos: "center",
    category: "Tea",
  },
];

const categories = ["All", "Espresso", "Cold brews", "Matcha", "Tea"];

export default function MenuPage() {
  const [active, setActive] = useState("All");

  const filtered = active === "All" ? menuItems : menuItems.filter((i) => i.category === active);

  return (
    <div className="min-h-screen bg-white font-sans">
      <Navbar />

      {/* Menu Header Banner */}
      <section className="relative w-full h-[260px] overflow-hidden">
        <Image src="/menuback.png" alt="Menu Banner" fill className="object-cover object-center" priority />
        <div className="absolute inset-0 bg-black/30" />
        <div className="absolute inset-0 flex flex-col justify-center px-12" style={{ maxWidth: "520px" }}>
          {/* OUR MENU label */}
          <div className="flex items-center gap-2 mb-3">
            <Image src="/logo.png" alt="Logo" width={38} height={38} className="rounded-full object-cover flex-shrink-0" />
            <span className="font-extrabold text-sm tracking-widest uppercase" style={{ color: "#d4900a" }}>
              OUR MENU
            </span>
          </div>
          <h2 className="text-white font-extrabold text-4xl leading-tight mb-1">
            Made with quality,
          </h2>
          <p className="text-3xl italic font-semibold mb-3" style={{ color: "#d4900a", fontFamily: "Georgia, serif" }}>
            served with heart.
          </p>
          <p className="text-white/85 text-xs leading-relaxed" style={{ maxWidth: "320px" }}>
            Explore our selection of premium coffee and delightful treats, crafted with passion and the finest ingredients.
          </p>
        </div>
      </section>

      {/* Category Filter + Items */}
      <section className="px-10 py-8">
        {/* Filter tabs */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActive(cat)}
                className={`px-5 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                  active === cat
                    ? "bg-amber-700 border-amber-700 text-white"
                    : "bg-white border-gray-300 text-gray-700 hover:border-amber-700 hover:text-amber-700"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
          <a href="#" className="text-sm font-medium text-gray-700 hover:text-amber-700 flex items-center gap-1 transition-colors">
            View All →
          </a>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
          {filtered.map((item) => (
            <MenuCard key={item.name} item={item} />
          ))}
        </div>
      </section>
    </div>
  );
}
