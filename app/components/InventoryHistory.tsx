"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type Movement = {
  id: string;
  inventory_id: number | null;
  ingredient_name_snapshot: string | null;
  unit_snapshot: string | null;
  movement_type: string;
  quantity_change: number;
  note: string | null;
  created_at: string;
};
type InventoryItem = { inventory_id: number; ingredient_name: string; unit: string };

const formatQty = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });
const movementLabels: Record<string, string> = {
  stock_in: "Stock received",
  initial_stock: "Opening stock",
  order_consumption: "Order consumption",
  order_cancellation_return: "Cancellation return",
};
function noteField(note: string | null, label: string) {
  const field = note?.split("|").map((part) => part.trim()).find((part) => part.toLowerCase().startsWith(`${label.toLowerCase()}:`));
  return field ? field.slice(field.indexOf(":") + 1).trim() : "—";
}
function readableNote(note: string | null) {
  if (!note) return "—";
  const demoOpening = note.match(/^Demo opening balance for school project:\s*(.+?);\s*replace with counted stock$/i);
  if (demoOpening) return `Opening stock entered during initial setup: ${demoOpening[1]}. Verify against a physical count.`;
  return note;
}

export default function InventoryHistory() {
  const [movements, setMovements] = useState<Movement[]>([]);
  const [inventory, setInventory] = useState<Map<number, InventoryItem>>(new Map());
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const [movementResult, inventoryResult] = await Promise.all([
        supabase.from("inventory_movements")
          .select("id, inventory_id, ingredient_name_snapshot, unit_snapshot, movement_type, quantity_change, note, created_at")
          .order("created_at", { ascending: false }).limit(500),
        supabase.from("inventory").select("inventory_id, ingredient_name, unit"),
      ]);
      if (!active) return;
      if (movementResult.error || inventoryResult.error) {
        setError(movementResult.error?.message || inventoryResult.error?.message || "Could not load inventory history.");
      } else {
        setMovements((movementResult.data ?? []) as Movement[]);
        setInventory(new Map(((inventoryResult.data ?? []) as InventoryItem[]).map((item) => [item.inventory_id, item])));
      }
      setLoading(false);
    }
    void load();
    return () => { active = false; };
  }, []);

  const types = useMemo(() => Array.from(new Set(movements.map((move) => move.movement_type))).sort(), [movements]);
  const filtered = movements.filter((move) => {
    const ingredient = (move.inventory_id === null ? undefined : inventory.get(move.inventory_id))?.ingredient_name ?? move.ingredient_name_snapshot ?? "Unknown ingredient";
    const matchesSearch = `${ingredient} ${move.note ?? ""}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (typeFilter === "all" || move.movement_type === typeFilter);
  });

  return <section className="space-y-6">
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a56831]">Stock control</p>
      <h1 className="mt-1 text-2xl font-extrabold text-[#21140b]">Inventory History</h1>
      <p className="mt-1 text-sm text-[#7d6b5c]">Review stock received, recipe deductions, and cancellation returns.</p>
    </header>
    {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}
    <div className="flex flex-wrap gap-3 rounded-xl border border-[#eee5dc] bg-white p-4 shadow-sm">
      <input aria-label="Search inventory history" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search ingredient, note, or order ID" className="min-w-[240px] flex-1 rounded-lg border border-[#e6d9cc] px-3 py-2 text-sm outline-none focus:border-[#9a6333]" />
      <select aria-label="Filter movement type" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)} className="rounded-lg border border-[#e6d9cc] bg-white px-3 py-2 text-sm">
        <option value="all">All movement types</option>
        {types.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
      </select>
      <span className="self-center text-xs text-[#847365]">{filtered.length} records</span>
    </div>
    <div className="overflow-hidden rounded-xl border border-[#eee5dc] bg-white shadow-sm">
      {loading ? <div className="p-12 text-center text-sm text-[#806e5e]">Loading inventory history…</div>
        : filtered.length === 0 ? <div className="p-12 text-center text-sm text-[#806e5e]">No inventory movements match your search.</div>
          : <div className="overflow-x-auto"><table className="w-full min-w-[920px] table-fixed text-left text-sm">
            <colgroup><col className="w-[155px]" /><col className="w-[160px]" /><col className="w-[125px]" /><col className="w-[220px]" /><col className="w-[125px]" /><col /></colgroup>
            <thead className="bg-[#faf7f3] text-[11px] uppercase tracking-wide text-[#887869]"><tr><th className="px-4 py-3">Date</th><th className="px-4 py-3">Ingredient</th><th className="px-4 py-3">Quantity change</th><th className="px-4 py-3">Package breakdown</th><th className="px-4 py-3 text-left">Movement</th><th className="px-4 py-3">Details</th></tr></thead>
            <tbody>{filtered.map((move) => {
              const item = move.inventory_id === null ? undefined : inventory.get(move.inventory_id);
              const amount = Number(move.quantity_change);
              const isReceipt = move.movement_type === "stock_in" || move.movement_type === "initial_stock";
              return <tr key={move.id} className="border-t border-[#f1ebe5] align-top hover:bg-[#fdfbf9]">
                <td className="px-4 py-3 text-xs leading-5 text-[#665548]">{new Date(move.created_at).toLocaleString()}</td>
                <td className="px-4 py-3 font-semibold text-[#2b1a0e]">{item?.ingredient_name ?? move.ingredient_name_snapshot ?? (move.inventory_id === null ? "Deleted ingredient" : `Ingredient ${move.inventory_id}`)}</td>
                <td className={`whitespace-nowrap px-4 py-3 font-bold ${amount < 0 ? "text-red-700" : "text-green-700"}`}>{amount > 0 ? "+" : ""}{formatQty(amount)} {item?.unit ?? move.unit_snapshot ?? ""}</td>
                <td className="px-4 py-3">{isReceipt ? <div className="space-y-1 text-xs leading-4 text-[#59483b]">
                  <p><span className="font-semibold text-[#8b7766]">Package:</span> {noteField(move.note, "Package type")}</p>
                  <p><span className="font-semibold text-[#8b7766]">Count:</span> {noteField(move.note, "Number of packages")}</p>
                  <p><span className="font-semibold text-[#8b7766]">Per package:</span> {noteField(move.note, "Quantity per package")}</p>
                </div> : <span className="text-xs text-[#9a8776]">Not applicable</span>}</td>
                <td className={`px-4 py-3 text-left align-top text-xs font-semibold whitespace-nowrap ${amount < 0 ? "text-red-800" : "text-green-800"}`}>{movementLabels[move.movement_type] ?? move.movement_type.replaceAll("_", " ")}</td>
                <td className="break-words px-4 py-3 text-xs leading-5 text-[#665548]">{readableNote(move.note)}</td>
              </tr>;
            })}</tbody>
          </table></div>}
    </div>
  </section>;
}
