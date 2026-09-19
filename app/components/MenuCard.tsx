"use client";
import Image from "next/image";
import { useState } from "react";

type MenuItem = {
  name: string;
  desc: string;
  price: string;
  img: string;
  imgPos?: string;
};

type Props = {
  item: MenuItem;
  onAdd?: (quantity: number) => void;
  onAddStart?: () => boolean;
};

export default function MenuCard({ item, onAdd, onAddStart }: Props) {
  const [qty, setQty] = useState(1);
  const [selecting, setSelecting] = useState(false);

  function handleConfirm() {
    onAdd?.(qty);
    setSelecting(false);
    setQty(1);
  }

  return (
    <div className="bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow flex flex-col overflow-hidden">
      <div className="relative w-full overflow-hidden" style={{ height: "180px" }}>
        <Image
          src={item.img}
          alt={item.name}
          fill
          sizes="(max-width: 768px) 50vw, 25vw"
          className="object-cover"
          style={{ objectPosition: item.imgPos ?? "center" }}
        />
      </div>

      <div className="flex flex-col flex-1 p-3 gap-1">
        <h3 className="font-bold text-gray-900 text-sm leading-snug">{item.name}</h3>
        <p className="text-gray-500 text-xs leading-snug flex-1">{item.desc}</p>

        {!selecting ? (
          <div className="flex items-center justify-between mt-2">
            <span className="font-bold text-gray-900 text-sm">{item.price}</span>
            <button
              onClick={() => { if (onAddStart && !onAddStart()) return; setSelecting(true); }}
              className="flex items-center justify-center w-7 h-7 rounded-full text-white flex-shrink-0"
              style={{ background: "#7c4a1e" }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
            </button>
          </div>
        ) : (
          <div className="mt-2 flex items-center gap-1.5">
            <button
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              className="w-7 h-7 rounded border border-gray-300 text-gray-600 flex items-center justify-center text-sm hover:border-amber-700 transition-colors flex-shrink-0"
            >
              −
            </button>
            <span className="text-sm font-semibold w-5 text-center text-gray-800">{qty}</span>
            <button
              onClick={() => setQty((q) => q + 1)}
              className="w-7 h-7 rounded border border-gray-300 text-gray-600 flex items-center justify-center text-sm hover:border-amber-700 transition-colors flex-shrink-0"
            >
              +
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white"
              style={{ background: "#7c4a1e" }}
            >
              Add {qty}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
