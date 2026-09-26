"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";

type Category = { id: string; name: string; sort_order: number };
type MenuItem = { id: string; name: string; description: string; price: number; image_url: string | null; is_available: boolean; is_featured: boolean; category_id: string; categories: { name: string } | null };

export default function CashierMenuReferencePage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterAvail, setFilterAvail] = useState<"all" | "available" | "unavailable">("all");

  useEffect(() => {
    async function load() {
      const [{ data: m }, { data: c }] = await Promise.all([
        supabase.from("menu_items").select("id, name, description, price, image_url, is_available, is_featured, category_id, categories(name)").order("name"),
        supabase.from("categories").select("id, name, sort_order").eq("is_active", true).order("sort_order"),
      ]);
      setItems((m as unknown as MenuItem[]) ?? []);
      setCategories(c ?? []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = items.filter((i) => {
    const matchCat = filterCat === "" || i.category_id === filterCat;
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase()) || i.description?.toLowerCase().includes(search.toLowerCase());
    const matchAvail = filterAvail === "all" || (filterAvail === "available" ? i.is_available : !i.is_available);
    return matchCat && matchSearch && matchAvail;
  });

  const availableCount = items.filter((i) => i.is_available).length;
  const unavailableCount = items.filter((i) => !i.is_available).length;

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading menu...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Menu Reference</h1>
          <p style={{ color: "#a89080", fontSize: "13px", marginTop: "4px" }}>View all menu items and availability</p>
        </div>
      </div>

      {/* Summary */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Items", value: items.length, icon: "☕", color: ACCENT },
          { label: "Available", value: availableCount, icon: "✅", color: "#22c55e" },
          { label: "Unavailable", value: unavailableCount, icon: "❌", color: "#ef4444" },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", borderTop: `3px solid ${s.color}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#a89080", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{s.label}</div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#1a1008" }}>{s.value}</div>
            </div>
            <span style={{ fontSize: "28px" }}>{s.icon}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", flex: 1, minWidth: "200px" }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." style={{ border: "none", outline: "none", fontSize: "12px", color: "#333", background: "transparent", width: "100%" }} />
        </div>
        <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={{ padding: "8px 12px", border: "1.5px solid #e8ddd4", borderRadius: "8px", fontSize: "12px", outline: "none", background: "#fff", cursor: "pointer" }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={filterAvail} onChange={(e) => setFilterAvail(e.target.value as typeof filterAvail)} style={{ padding: "8px 12px", border: "1.5px solid #e8ddd4", borderRadius: "8px", fontSize: "12px", outline: "none", background: "#fff", cursor: "pointer" }}>
          <option value="all">All Status</option>
          <option value="available">Available</option>
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      {/* Category sections */}
      {categories.filter((cat) => filterCat === "" || cat.id === filterCat).map((cat) => {
        const catItems = filtered.filter((i) => i.category_id === cat.id);
        if (catItems.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: "28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "14px" }}>
              <div style={{ fontWeight: 800, fontSize: "15px", color: "#1a1008" }}>{cat.name}</div>
              <div style={{ height: "1px", flex: 1, background: "#ede8e3" }} />
              <span style={{ fontSize: "11px", color: "#a89080", fontWeight: 600 }}>{catItems.length} items</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
              {catItems.map((item) => (
                <div key={item.id} style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", opacity: item.is_available ? 1 : 0.6, border: item.is_available ? "none" : "1px solid #fecaca" }}>
                  <div style={{ position: "relative", height: "140px", background: "#f1ebe5" }}>
                    {item.image_url
                      ? <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "40px" }}>☕</div>
                    }
                    <div style={{ position: "absolute", top: "8px", right: "8px", display: "flex", gap: "4px" }}>
                      <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "20px", background: item.is_available ? "#f0fdf4" : "#fff0f0", color: item.is_available ? "#22c55e" : "#ef4444" }}>
                        {item.is_available ? "Available" : "Unavailable"}
                      </span>
                      {item.is_featured && <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "20px", background: "#fef3c7", color: "#d97706" }}>⭐ Featured</span>}
                    </div>
                  </div>
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ fontWeight: 800, fontSize: "14px", color: "#1a1008", marginBottom: "4px" }}>{item.name}</div>
                    {item.description && <div style={{ fontSize: "12px", color: "#a89080", marginBottom: "8px", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.description}</div>}
                    <div style={{ fontWeight: 900, fontSize: "16px", color: ACCENT }}>₱{Number(item.price).toFixed(2)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "60px", color: "#aaa", fontSize: "14px" }}>No items found.</div>
      )}
    </div>
  );
}
