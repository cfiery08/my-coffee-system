"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type InventoryRow = {
  inventory_id: number;
  ingredient_name: string;
  quantity: number;
  unit: string;
  reorder_level: number;
  status: "available" | "unavailable" | "low_stock";
  updated_at: string;
};
type IngredientForm = { ingredient_name: string; unit: string; purchase_unit: string; base_quantity_per_purchase: string; initial_purchases: string; reorder_level: string; status: InventoryRow["status"] };
const BLANK: IngredientForm = { ingredient_name: "", unit: "g", purchase_unit: "Pack", base_quantity_per_purchase: "", initial_purchases: "0", reorder_level: "0", status: "available" };
const unitOptions = ["g", "ml", "pcs"];
const formatQty = (n: number) => Number(n).toLocaleString(undefined, { maximumFractionDigits: 3 });

function SelectChevron() {
  return <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute right-3 top-[2.55rem] h-4 w-4 text-[#806e5e]"><path fillRule="evenodd" d="M5.22 7.47a.75.75 0 0 1 1.06 0L10 11.19l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 8.53a.75.75 0 0 1 0-1.06Z" clipRule="evenodd" /></svg>;
}

function stockState(row: InventoryRow) {
  if (row.status === "unavailable") return { label: "Unavailable", color: "#b91c1c", bg: "#fef2f2" };
  if (row.status === "low_stock") return { label: "Low stock", color: "#b45309", bg: "#fff7ed" };
  return { label: "Available", color: "#15803d", bg: "#f0fdf4" };
}

export default function InventoryManagement({ canManage }: { canManage: boolean }) {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [statusFilterOpen, setStatusFilterOpen] = useState(false);
  const [modal, setModal] = useState<"add" | "edit" | "restock" | null>(null);
  const [selected, setSelected] = useState<InventoryRow | null>(null);
  const [form, setForm] = useState<IngredientForm>(BLANK);
  const [receiveQuantity, setReceiveQuantity] = useState("1");
  const [receivePurchaseUnit, setReceivePurchaseUnit] = useState("");
  const [receiveConversion, setReceiveConversion] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const inventoryResult = await supabase.from("inventory")
      .select("inventory_id, ingredient_name, quantity, unit, reorder_level, status, updated_at")
      .order("ingredient_name");
    const error = inventoryResult.error;
    if (error) setLoadError(error.message);
    else {
      setItems((inventoryResult.data ?? []) as InventoryRow[]);
      setLoadError("");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
    const channel = supabase.channel("inventory-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const filtered = useMemo(() => items.filter((item) => {
    const matchesName = item.ingredient_name.toLowerCase().includes(search.toLowerCase());
    const state = item.status;
    return matchesName && (filter === "all" || filter === state);
  }), [items, search, filter]);
  const counts = {
    all: items.length,
    available: items.filter((item) => item.status === "available").length,
    low_stock: items.filter((item) => item.status === "low_stock").length,
    unavailable: items.filter((item) => item.status === "unavailable").length,
  };

  function openAdd() { setSelected(null); setForm(BLANK); setActionError(""); setModal("add"); }
  function openEdit(item: InventoryRow) {
    setSelected(item);
    setForm({ ...BLANK, ingredient_name: item.ingredient_name, unit: item.unit, initial_purchases: "0", reorder_level: String(item.reorder_level), status: item.status });
    setActionError(""); setModal("edit");
  }
  function openRestock(item: InventoryRow) { setSelected(item); setReceiveQuantity("1"); setReceivePurchaseUnit(""); setReceiveConversion(""); setActionError(""); setModal("restock"); }
  async function save() {
    if (!modal) return;
    setActionError(""); setSaving(true);
    let error: { message: string } | null = null;
    if (modal === "add") {
      if (!form.ingredient_name.trim() || !form.unit.trim() || !form.purchase_unit.trim() || Number(form.base_quantity_per_purchase) <= 0 || Number(form.initial_purchases) < 0 || Number(form.reorder_level) < 0) {
        setActionError("Enter the ingredient, its unit, a purchase unit, a valid conversion, and non-negative quantities."); setSaving(false); return;
      }
      const { error: rpcError } = await supabase.rpc("add_inventory_ingredient", {
        p_ingredient_name: form.ingredient_name.trim(), p_unit: form.unit,
        p_purchase_unit: form.purchase_unit.trim(),
        p_base_quantity_per_purchase: Number(form.base_quantity_per_purchase),
        p_initial_purchases: Number(form.initial_purchases),
        p_reorder_level: Number(form.reorder_level),
      });
      error = rpcError;
    } else if (modal === "edit" && selected) {
      if (!form.ingredient_name.trim() || Number(form.reorder_level) < 0) {
        setActionError("Enter the ingredient name and a non-negative reorder level."); setSaving(false); return;
      }
      const { error: updateError } = await supabase.from("inventory").update({
        ingredient_name: form.ingredient_name.trim(), unit: form.unit,
        reorder_level: Number(form.reorder_level),
        status: form.status,
      }).eq("inventory_id", selected.inventory_id);
      error = updateError;
    } else if (modal === "restock" && selected) {
      if (Number(receiveQuantity) <= 0 || Number(receiveConversion) <= 0) {
        setActionError("Enter the package count and a valid base-unit conversion."); setSaving(false); return;
      }
      const convertedQuantity = Number(receiveQuantity) * Number(receiveConversion);
      const { error: rpcError } = await supabase.rpc("receive_inventory_stock", {
        p_inventory_id: selected.inventory_id, p_quantity: convertedQuantity,
      });
      error = rpcError;
    }
    setSaving(false);
    if (error) { setActionError(error.message); return; }
    setModal(null); setSelected(null); await load();
  }

  async function deleteIngredient(item: InventoryRow) {
    setActionError("");
    if (!window.confirm(`Delete ${item.ingredient_name}? Any recipe links will be removed. Stock movement history will be kept with the ingredient name recorded.`)) return;
    const { error } = await supabase.from("inventory").delete().eq("inventory_id", item.inventory_id);
    if (error) setActionError(error.message);
    else await load();
  }

  if (loading) return <div className="p-12 text-center text-sm text-[#8b7766]">Loading inventoryâ€¦</div>;

  return <section className="space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#a56831]">Stock control</p>
        <h1 className="mt-1 text-2xl font-extrabold text-[#21140b]">Inventory Management</h1>
        <p className="mt-1 text-sm text-[#7d6b5c]">{items.length} ingredients Â· quantity and reorder level use each ingredientâ€™s unit.</p>
      </div>
      {canManage && <button onClick={openAdd} className="rounded-lg bg-[#7c4a1e] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#633916]">+ Add Ingredient</button>}
    </header>
    {(loadError || actionError) && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError || actionError}</div>}
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {([["all", "All Ingredients", "#6b4f3a"], ["available", "Available", "#15803d"], ["low_stock", "Low Stock", "#b45309"], ["unavailable", "Unavailable", "#b91c1c"]] as const).map(([key, label, color]) =>
        <button key={key} onClick={() => setFilter(key)} className={`rounded-xl border bg-white p-4 text-left shadow-sm transition ${filter === key ? "border-[#7c4a1e] ring-1 ring-[#7c4a1e]" : "border-[#eee5dc] hover:border-[#c9a57d]"}`}>
          <span className="block text-xs font-semibold text-[#847365]">{label}</span><span className="mt-1 block text-2xl font-black" style={{ color }}>{counts[key]}</span>
        </button>)}
    </div>
    <div className="overflow-hidden rounded-xl border border-[#eee5dc] bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#eee5dc] p-4">
        <div className="relative w-full max-w-sm">
          <input aria-label="Search ingredients" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search ingredientsâ€¦" className="w-full rounded-lg border border-[#e6d9cc] py-2 pl-3 pr-12 text-sm outline-none focus:border-[#9a6333]" />
          <button type="button" aria-label="Filter by status" aria-expanded={statusFilterOpen} onClick={() => setStatusFilterOpen((open) => !open)} className={`absolute right-1 top-1/2 flex h-8 w-9 -translate-y-1/2 items-center justify-center rounded-md text-[#7c4a1e] ${statusFilterOpen || filter !== "all" ? "bg-[#f1ebe5]" : "hover:bg-[#f8f4ef]"}`}>
            <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6.5 7.5v5l-3 1.5v-6.5L4 5z" /></svg>
            {filter !== "all" && <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-700" />}
          </button>
          {statusFilterOpen && <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-56 rounded-xl border border-[#eee5dc] bg-white p-4 shadow-xl">
            <label className="block text-xs font-bold uppercase tracking-wide text-[#6f5d4e]" htmlFor="inventory-status-filter">Filter by status</label>
            <select id="inventory-status-filter" value={filter} onChange={(e) => { setFilter(e.target.value); setStatusFilterOpen(false); }} className="mt-2 w-full rounded-lg border border-[#e6d9cc] bg-white px-3 py-2 pr-10 text-sm text-[#49382b]">
              <option value="all">All statuses</option><option value="available">Available</option><option value="low_stock">Low stock</option><option value="unavailable">Unavailable</option>
            </select>
            {filter !== "all" && <button type="button" onClick={() => { setFilter("all"); setStatusFilterOpen(false); }} className="mt-2 text-xs font-bold text-[#7c4a1e] hover:underline">Clear status filter</button>}
          </div>}
        </div>
        <span className="text-xs text-[#847365]">{filtered.length} of {items.length}</span>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[900px] table-fixed text-sm">
        <colgroup>
          {canManage ? <><col className="w-[25%]" /><col className="w-[14%]" /><col className="w-[10%]" /><col className="w-[18%]" /><col className="w-[15%]" /><col className="w-[18%]" /></> : <><col className="w-[32%]" /><col className="w-[18%]" /><col className="w-[12%]" /><col className="w-[22%]" /><col className="w-[16%]" /></>}
        </colgroup>
        <thead className="bg-[#faf7f3] text-[11px] uppercase tracking-wide text-[#887869]"><tr>
          <th className="px-5 py-3 text-left">Ingredient</th><th className="px-5 py-3 text-right">Quantity</th><th className="px-5 py-3 text-center">Unit</th><th className="px-5 py-3 text-right">Reorder level</th><th className="px-5 py-3 text-center">Status</th>{canManage && <th className="px-5 py-3 text-center">Actions</th>}
        </tr></thead>
        <tbody>{filtered.map((item) => { const state = stockState(item); return <tr key={item.inventory_id} className="border-t border-[#f1ebe5]">
          <td className="px-5 py-3.5 text-left font-semibold text-[#2b1a0e]">{item.ingredient_name}</td>
          <td className="px-5 py-3.5 text-right font-bold tabular-nums text-[#2b1a0e]">{formatQty(item.quantity)}</td><td className="px-5 py-3.5 text-center text-[#665548]">{item.unit}</td>
          <td className="px-5 py-3.5 text-right tabular-nums text-[#665548]">{formatQty(item.reorder_level)} {item.unit}</td>
          <td className="px-5 py-3.5 text-center"><span className="inline-block rounded-full px-2.5 py-1 text-xs font-bold whitespace-nowrap" style={{ color: state.color, background: state.bg }}>{state.label}</span></td>
          {canManage && <td className="px-5 py-3.5"><div className="flex justify-center gap-1.5 whitespace-nowrap"><button onClick={() => openRestock(item)} className="rounded-md bg-green-50 px-2.5 py-1.5 text-xs font-bold text-green-800 hover:bg-green-100">Receive</button><button onClick={() => openEdit(item)} className="rounded-md bg-amber-50 px-2.5 py-1.5 text-xs font-bold text-amber-900 hover:bg-amber-100">Edit</button><button onClick={() => void deleteIngredient(item)} aria-label={`Delete ${item.ingredient_name}`} className="rounded-md bg-red-50 px-2.5 py-1.5 text-xs font-bold text-red-800 hover:bg-red-100">Delete</button></div></td>}
        </tr>; })}
          {filtered.length === 0 && <tr><td colSpan={canManage ? 6 : 5} className="px-4 py-12 text-center text-sm text-[#8b7766]">{items.length ? "No ingredients match your search." : "No inventory items found. Run the inventory setup SQL first."}</td></tr>}
        </tbody>
      </table></div>
    </div>
    {modal && <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModal(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="inventory-dialog-title" className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-[#eee5dc] px-6 py-5"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#a56831]">Inventory</p><h2 id="inventory-dialog-title" className="mt-1 text-xl font-extrabold text-[#21140b]">{modal === "add" ? "Add New Ingredient" : modal === "edit" ? `Edit ${selected?.ingredient_name}` : `Receive ${selected?.ingredient_name}`}</h2></div>
        <div className="space-y-4 p-6">
          {modal === "restock" && selected ? <>
            <p className="text-sm text-[#6f5d4e]">Current quantity: <strong>{formatQty(selected.quantity)} {selected.unit}</strong></p>
            <div className="grid grid-cols-2 gap-3"><label className="block text-sm font-semibold text-[#3b2a1d]">Package type<input value={receivePurchaseUnit} onChange={(e) => setReceivePurchaseUnit(e.target.value)} placeholder="Bag, bottle, pack" className="mt-1 w-full rounded-lg border border-[#e3d6ca] px-3 py-2.5" /></label><label className="block text-sm font-semibold text-[#3b2a1d]">Number of packages<input type="number" min="0.001" step="0.001" value={receiveQuantity} onChange={(e) => setReceiveQuantity(e.target.value)} className="mt-1 w-full rounded-lg border border-[#e3d6ca] px-3 py-2.5" /></label></div>
            <label className="block text-sm font-semibold text-[#3b2a1d]">Quantity per package ({selected.unit})<input type="number" min="0.001" step="0.001" value={receiveConversion} onChange={(e) => setReceiveConversion(e.target.value)} placeholder={`e.g. 1000 ${selected.unit}`} className="mt-1 w-full rounded-lg border border-[#e3d6ca] px-3 py-2.5" /></label>
            <div className="rounded-xl bg-[#f8f4ef] p-4"><div className="text-xs font-bold uppercase tracking-wide text-[#8a7563]">Converted quantity to add</div><div className="mt-1 text-2xl font-black text-[#7c4a1e]">+{formatQty((Number(receiveQuantity) || 0) * (Number(receiveConversion) || 0))} {selected.unit}</div><p className="mt-1 text-xs text-[#806e5e]">{receiveQuantity || 0} {receivePurchaseUnit || "packages"} Ã— {formatQty(Number(receiveConversion) || 0)} {selected.unit} per {receivePurchaseUnit || "package"}</p></div>
          </> : <>
            <label className="block text-sm font-semibold text-[#3b2a1d]">Ingredient name<input value={form.ingredient_name} onChange={(e) => setForm({ ...form, ingredient_name: e.target.value })} placeholder="e.g. Coffee Beans" className="mt-1 w-full rounded-lg border border-[#e3d6ca] px-3 py-2.5 outline-none focus:border-[#9a6333]" /></label>
            {modal === "add" && <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-semibold text-[#3b2a1d]">Purchase unit<input value={form.purchase_unit} onChange={(e) => setForm({ ...form, purchase_unit: e.target.value })} placeholder="Bag, Bottle, Tray" className="mt-1 w-full rounded-lg border border-[#e3d6ca] px-3 py-2.5" /></label>
              <label className="block text-sm font-semibold text-[#3b2a1d]">Initial package count<input type="number" min="0" step="0.001" value={form.initial_purchases} onChange={(e) => setForm({ ...form, initial_purchases: e.target.value })} className="mt-1 w-full rounded-lg border border-[#e3d6ca] px-3 py-2.5" /><span className="mt-1 block text-xs font-normal text-[#806e5e]">Packages on hand now.</span></label>
            </div>}
            <div className="grid grid-cols-2 gap-3">
              <label className="relative block text-sm font-semibold text-[#3b2a1d]">Unit<select disabled={modal === "edit"} value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="mt-1 w-full appearance-none rounded-lg border border-[#e3d6ca] bg-white px-3 py-2.5 pr-10 disabled:bg-[#f6f2ee]">{unitOptions.map((unit) => <option key={unit} value={unit}>{unit}</option>)}</select><SelectChevron /></label>
              <label className="block text-sm font-semibold text-[#3b2a1d]">Reorder level ({form.unit})<input type="number" min="0" step="0.001" value={form.reorder_level} onChange={(e) => setForm({ ...form, reorder_level: e.target.value })} className="mt-1 w-full rounded-lg border border-[#e3d6ca] px-3 py-2.5" /></label>
            </div>
            {modal === "edit" && <label className="relative block text-sm font-semibold text-[#3b2a1d]">Availability status<select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InventoryRow["status"] })} className="mt-1 w-full appearance-none rounded-lg border border-[#e3d6ca] bg-white px-3 py-2.5 pr-10"><option value="available">Available</option><option value="unavailable">Unavailable</option><option value="low_stock">Low stock</option></select><SelectChevron /><span className="mt-1 block text-xs font-normal text-[#806e5e]">Unavailable ingredients make every menu item that uses them unavailable to customers.</span></label>}
            {modal === "add" && <>
              <label className="block text-sm font-semibold text-[#3b2a1d]">Quantity per purchase unit ({form.unit})<input type="number" min="0.001" step="0.001" value={form.base_quantity_per_purchase} onChange={(e) => setForm({ ...form, base_quantity_per_purchase: e.target.value })} className="mt-1 w-full rounded-lg border border-[#e3d6ca] px-3 py-2.5" /></label>
              <div className="rounded-xl bg-[#f8f4ef] p-4"><div className="text-xs font-bold uppercase tracking-wide text-[#8a7563]">Converted initial quantity</div><div className="mt-1 text-2xl font-black text-[#7c4a1e]">{formatQty((Number(form.initial_purchases) || 0) * (Number(form.base_quantity_per_purchase) || 0))} {form.unit}</div><p className="mt-1 text-xs text-[#806e5e]">{form.initial_purchases || 0} {form.purchase_unit || "packages"} multiplied by {formatQty(Number(form.base_quantity_per_purchase) || 0)} {form.unit} per package</p></div>
            </>}
          </>}
          {actionError && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">{actionError}</p>}
          <div className="flex justify-end gap-3 pt-1"><button onClick={() => setModal(null)} className="rounded-lg border border-[#e4d8cc] px-4 py-2.5 text-sm font-semibold text-[#59483b]">Cancel</button><button onClick={() => void save()} disabled={saving} className="rounded-lg bg-[#7c4a1e] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? "Savingâ€¦" : modal === "add" ? "Save Ingredient" : modal === "restock" ? "Receive Stock" : "Save Changes"}</button></div>
        </div>
      </div>
    </div>}
  </section>;
}
