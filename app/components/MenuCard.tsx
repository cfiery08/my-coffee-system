"use client";
import Image from "next/image";
import SystemIcon from "@/app/components/SystemIcon";
import { useState } from "react";

type MenuItem = {
  name: string;
  desc: string;
  price: string;
  img: string;
  imgPos?: string;
  available?: boolean;
  reviewSummary?: { thumbs_up: number; thumbs_down: number };
};

type Props = {
  item: MenuItem;
  onAdd?: (quantity: number) => void;
  onAddStart?: () => boolean;
};

const LOCAL_IMAGE_FALLBACKS: Record<string, string> = {
  cappuccino: "/Cappuccino.jpg",
  espresso: "/Espresso.jpg",
  "espresso shot": "/Espresso_Shot.jpg",
  americano: "/Americano.jpg",
  "cafe latte": "/Café Latte.jpg",
  "café latte": "/Café Latte.jpg",
  "classic latte": "/classic_latte.webp",
  "cafe mocha": "/Café Mocha.webp",
  "café mocha": "/Café Mocha.webp",
  "iced americano": "/Iced Americano.jpg",
  "iced latte": "/Iced Latte.jpg",
  "iced mocha": "/Iced Mocha.jpg",
  "iced caramel macchiato": "/Iced Caramel Macchiato.jpeg",
  "caramel macchiato": "/Caramel-Macchiato.jpg",
  "cold brew": "/Cold Brew.webp",
  "coffee frappe": "/Coffee Frappe.png",
  "mocha frappe": "/Mocha Frappe.webp",
  "caramel frappe": "/Caramel Frappe.png",
  "java chip frappe": "/Java Chip Frappe.webp",
  "white chocolate frappe": "/White Chocolate Frappe.webp",
  "english breakfast tea": "/English Breakfast Tea.jpg",
  "earl grey tea": "/Earl Grey Tea.jpg",
  "iced lemon tea": "/Iced Lemon Tea.avif",
  "matcha latte": "/Matcha Latte.jpg",
  "iced matcha latte": "/Iced Matcha Latte.jpg",
  "hot chocolate": "/Hot Chocolate.webp",
  "iced chocolate": "/Iced Chocolate.webp",
  "white hot chocolate": "/White Hot Chocolate.jpg",
  "chocolate milk": "/Chocolate Milk.jpg",
  "butter croissant": "/Butter Croissant.png",
  "blueberry muffin": "/Blueberry Muffin.jpg",
  "chocolate muffin": "/Chocolate Muffin.avif",
  "chocolate chip cookie": "/Chocolate Chip Cookie.jpg",
  brownie: "/Brownie.webp",
};

export default function MenuCard({ item, onAdd, onAddStart }: Props) {
  const [qty, setQty] = useState(1);
  const [showDetails, setShowDetails] = useState(false);
  const [detailImageSrc, setDetailImageSrc] = useState(item.img);
  const isFrappe = item.name.toLowerCase().includes("frappe");
  const frappeImagePosition = item.name.toLowerCase() === "mocha frappe" ? "center 30%" : "center 20%";
  const available = item.available !== false;

  function handleConfirm() {
    onAdd?.(qty);
    setShowDetails(false);
    setQty(1);
  }

  const numericPrice = Number(item.price.replace(/[^\d.]/g, "")) || 0;
  const localFallback = LOCAL_IMAGE_FALLBACKS[item.name.trim().toLowerCase()] ?? "/logo.png";

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow flex flex-col overflow-hidden">
      <div className="relative w-full overflow-hidden" style={{ height: "180px" }}>
        <Image
          src={item.img}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
          style={{ objectPosition: item.imgPos ?? (isFrappe ? frappeImagePosition : "center") }}
        />
        {!available && <div className="absolute inset-0 flex items-start justify-end bg-black/20 p-2"><span className="rounded-full bg-red-700 px-3 py-1 text-xs font-bold text-white">Unavailable</span></div>}
      </div>

      <div className="flex flex-col flex-1 p-3 gap-1">
        <h3 className="font-bold text-gray-900 text-sm leading-snug">{item.name}</h3>
        <p className="text-gray-500 text-xs leading-snug flex-1">{item.desc}</p>
        {(item.reviewSummary?.thumbs_up ?? 0) + (item.reviewSummary?.thumbs_down ?? 0) > 0 && (
          <div className="mt-1 flex gap-3 text-[11px] font-semibold">
            <span className="inline-flex items-center gap-1 text-green-700"><SystemIcon name="thumbUp" size={13} /> {item.reviewSummary?.thumbs_up ?? 0}</span>
            <span className="inline-flex items-center gap-1 text-red-600"><SystemIcon name="thumbDown" size={13} /> {item.reviewSummary?.thumbs_down ?? 0}</span>
          </div>
        )}

        {!available ? <div className="mt-2 flex items-center justify-between"><span className="font-bold text-gray-900 text-sm">{item.price}</span><span className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-500">Unavailable</span></div> : (
          <div className="flex items-center justify-between mt-2">
            <span className="font-bold text-gray-900 text-sm">{item.price}</span>
            <button
              type="button"
              aria-label={`View ${item.name} details`}
              onClick={() => { if (onAddStart && !onAddStart()) return; setDetailImageSrc(item.img === "/logo.png" ? localFallback : item.img); setShowDetails(true); }}
              className="flex items-center justify-center w-7 h-7 rounded-full text-white flex-shrink-0"
              style={{ background: "#7c4a1e" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {showDetails && <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDetails(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby={`menu-item-title-${item.name.replace(/[^a-z0-9]/gi, "-")}`} className="relative grid max-h-[90vh] w-full max-w-3xl grid-cols-[0.85fr_1.15fr] overflow-y-auto rounded-2xl bg-white shadow-2xl md:grid-cols-2" onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => setShowDetails(false)} aria-label="Close item details" className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full bg-white/95 text-2xl leading-none text-[#5a3e2b] shadow hover:bg-white">×</button>
          <div className="relative min-h-[220px] bg-[#f7f2ec] md:min-h-[420px]">
            <Image src={detailImageSrc} alt={item.name} fill sizes="(max-width: 768px) 50vw, 25vw" loading="eager" fetchPriority="high" onError={() => setDetailImageSrc((current) => current === item.img ? localFallback : "/logo.png")} className="object-contain p-2 md:p-3" />
            {!available && <span className="absolute left-4 top-4 rounded-full bg-red-700 px-3 py-1 text-xs font-bold text-white">Unavailable</span>}
          </div>
          <div className="flex min-w-0 flex-col p-3 sm:p-6">
            <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#a36a35] sm:text-xs sm:tracking-[0.18em]">Brewora menu</p>
            <h2 id={`menu-item-title-${item.name.replace(/[^a-z0-9]/gi, "-")}`} className="mt-1 text-lg font-extrabold leading-tight text-[#21140b] sm:mt-2 sm:text-2xl">{item.name}</h2>
            <p className="mt-2 whitespace-pre-line text-xs leading-5 text-[#6f6257] sm:mt-3 sm:text-sm sm:leading-6">{item.desc || "Freshly prepared by Brewora."}</p>
            {(item.reviewSummary?.thumbs_up ?? 0) + (item.reviewSummary?.thumbs_down ?? 0) > 0 && <div className="mt-4 flex gap-4 text-sm font-semibold">
              <span className="inline-flex items-center gap-1 text-green-700"><SystemIcon name="thumbUp" size={15} /> {item.reviewSummary?.thumbs_up ?? 0}</span>
              <span className="inline-flex items-center gap-1 text-red-600"><SystemIcon name="thumbDown" size={15} /> {item.reviewSummary?.thumbs_down ?? 0}</span>
            </div>}
            <div className="mt-3 text-xl font-extrabold text-[#7c4a1e] sm:mt-5 sm:text-2xl">{item.price}</div>
            {!available ? <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm font-bold text-red-700">This item is currently unavailable.</p> : <>
              <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-4 sm:gap-4 sm:pt-8">
                <span className="text-xs font-semibold text-[#6f6257] sm:text-sm">Quantity</span>
                <div className="flex items-center gap-2 sm:gap-3">
                  <button type="button" onClick={() => setQty((current) => Math.max(1, current - 1))} aria-label="Decrease quantity" className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5d8ca] text-lg text-[#5a3e2b] hover:bg-[#faf7f4]">−</button>
                  <span className="min-w-6 text-center font-bold text-[#21140b]">{qty}</span>
                  <button type="button" onClick={() => setQty((current) => current + 1)} aria-label="Increase quantity" className="grid h-9 w-9 place-items-center rounded-lg border border-[#e5d8ca] text-lg text-[#5a3e2b] hover:bg-[#faf7f4]">+</button>
                </div>
              </div>
              <button type="button" onClick={handleConfirm} className="mt-3 w-full rounded-xl bg-[#7c4a1e] px-2 py-3 text-xs font-bold text-white transition-colors hover:bg-[#653b18] sm:mt-4 sm:px-4 sm:text-sm">
                Add to Cart · ₱{(numericPrice * qty).toFixed(2)}
              </button>
            </>}
          </div>
        </section>
      </div>}
    </div>
  );
}
