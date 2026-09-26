"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
type Category = { id: string; name: string; sort_order: number; is_active: boolean };
type MenuItem = { id: string; name: string; description: string; price: number; image_url: string | null; is_available: boolean; is_featured: boolean; category_id: string; categories: { name: string } | null };

const EMPTY_ITEM = { name: "", description: "", price: "", is_available: true, is_featured: false, category_id: "" };
const EMPTY_CAT = { name: "", sort_order: 0, is_active: true };

export default function AdminMenuPage() {
  const [tab, setTab] = useState<"items" | "categories">("items");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");

  const [modal, setModal] = useState<"add" | "edit" | null>(null);
  const [form, setForm] = useState<typeof EMPTY_ITEM & { id?: string }>(EMPTY_ITEM);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [catModal, setCatModal] = useState<"add" | "edit" | null>(null);
  const [catForm, setCatForm] = useState<typeof EMPTY_CAT & { id?: string }>(EMPTY_CAT);
  const [catSaving, setCatSaving] = useState(false);
  const [catDeleteId, setCatDeleteId] = useState<string | null>(null);

  async function load() {
    const [{ data: m }, { data: c }] = await Promise.all([
      supabase.from("menu_items").select("id, name, description, price, image_url, is_available, is_featured, category_id, categories(name)").order("name"),
      supabase.from("categories").select("id, name, sort_order, is_active").order("sort_order"),
    ]);
    setItems((m as unknown as MenuItem[]) ?? []);
    setCategories(c ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave() {
    if (!form.name.trim() || !form.price || !form.category_id) { alert("Name, price, and category are required."); return; }
    setSaving(true);
    let image_url = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `menu/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, imageFile, { upsert: true });
      if (!upErr) {
        const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
        image_url = urlData.publicUrl;
      }
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(), description: form.description,
      price: parseFloat(form.price as unknown as string),
      is_available: form.is_available, is_featured: form.is_featured,
      category_id: form.category_id,
    };
    if (image_url) payload.image_url = image_url;

    if (modal === "edit" && form.id) {
      await supabase.from("menu_items").update(payload).eq("id", form.id);
    } else {
      await supabase.from("menu_items").insert(payload);
    }
    setSaving(false); setModal(null); load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    await supabase.from("menu_items").delete().eq("id", deleteId);
    setDeleteId(null); load();
  }

  async function handleCatSave() {
    if (!catForm.name.trim()) { alert("Category name is required."); return; }
    setCatSaving(true);
    if (catModal === "edit" && catForm.id) {
      await supabase.from("categories").update({ name: catForm.name, sort_order: catForm.sort_order, is_active: catForm.is_active }).eq("id", catForm.id);
    } else {
      await supabase.from("categories").insert({ name: catForm.name, sort_order: catForm.sort_order, is_active: catForm.is_active });
    }
    setCatSaving(false); setCatModal(null); load();
  }

  async function handleCatDelete() {
    if (!catDeleteId) return;
    await supabase.from("categories").delete().eq("id", catDeleteId);
    setCatDeleteId(null); load();
  }

  const filtered = items.filter((i) =>
    (filterCat === "" || i.category_id === filterCat) &&
    i.name.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Menu Management</h1>
          <p style={{ color: "#a89080", fontSize: "13px", marginTop: "4px" }}>{tab === "items" ? `${items.length} items` : `${categories.length} categories`}</p>
        </div>
        {tab === "items"
          ? <button onClick={() => { setForm({ ...EMPTY_ITEM, category_id: categories[0]?.id || "" }); setImageFile(null); setModal("add"); }} style={btnAccent}>+ Add Item</button>
          : <button onClick={() => { setCatForm(EMPTY_CAT); setCatModal("add"); }} style={btnAccent}>+ Add Category</button>
        }
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#f1ebe5", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {(["items", "categories"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 20px", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? ACCENT : "#a89080", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t === "items" ? "☕ Menu Items" : "🏷️ Categories"}
          </button>
        ))}
      </div>

      {/* Items Tab */}
      {tab === "items" && (
        <>
          <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
            <input placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} style={inp} />
            <select value={filterCat} onChange={(e) => setFilterCat(e.target.value)} style={sel}>
              <option value="">All Categories</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#faf7f4", borderBottom: "1px solid #ede8e3" }}>
                  {["Image", "Name", "Category", "Price", "Status", "Featured", "Actions"].map((h) => (
                    <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: "#a89080", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && <tr><td colSpan={7} style={{ textAlign: "center", padding: "40px", color: "#aaa" }}>No items found.</td></tr>}
                {filtered.map((item) => (
                  <tr key={item.id} style={{ borderBottom: "1px solid #faf7f4" }}>
                    <td style={{ padding: "12px 16px" }}>
                      {item.image_url
                        ? <img src={item.image_url} alt={item.name} style={{ width: "52px", height: "52px", objectFit: "cover", borderRadius: "8px" }} />
                        : <div style={{ width: "52px", height: "52px", borderRadius: "8px", background: "#f1ebe5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px" }}>☕</div>
                      }
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a1008" }}>{item.name}</div>
                      <div style={{ fontSize: "12px", color: "#a89080", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}><span style={{ background: "#f1ebe5", padding: "3px 10px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, color: "#7c4a1e" }}>{(item.categories as unknown as { name: string } | null)?.name || "—"}</span></td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "14px", color: "#1a1008" }}>₱{Number(item.price).toFixed(2)}</td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "10px", background: item.is_available ? "#f0fdf4" : "#fff0f0", color: item.is_available ? "#22c55e" : "#ef4444" }}>{item.is_available ? "Available" : "Unavailable"}</span></td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "13px" }}>{item.is_featured ? "⭐" : "—"}</span></td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => { setForm({ id: item.id, name: item.name, description: item.description, price: String(item.price), is_available: item.is_available, is_featured: item.is_featured, category_id: item.category_id }); setImageFile(null); setModal("edit"); }} style={btnEdit}>Edit</button>
                        <button onClick={() => setDeleteId(item.id)} style={btnDel}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Categories Tab */}
      {tab === "categories" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: "16px" }}>
          {categories.map((cat) => (
            <div key={cat.id} style={{ background: "#fff", borderRadius: "12px", padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between", borderLeft: `4px solid ${ACCENT}` }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <span style={{ fontSize: "22px" }}>🏷️</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "15px", color: "#1a1008" }}>{cat.name}</div>
                  <div style={{ fontSize: "11px", color: "#a89080" }}>{items.filter((i) => i.category_id === cat.id).length} items · {cat.is_active ? "Active" : "Hidden"}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => { setCatForm({ id: cat.id, name: cat.name, sort_order: cat.sort_order, is_active: cat.is_active }); setCatModal("edit"); }} style={btnEdit}>Edit</button>
                <button onClick={() => setCatDeleteId(cat.id)} style={btnDel}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Menu Item Modal */}
      {modal && (
        <div style={overlay}>
          <div style={modalBox}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontWeight: 900, fontSize: "18px", color: "#1a1008", margin: 0 }}>{modal === "add" ? "Add Menu Item" : "Edit Menu Item"}</h2>
              <button onClick={() => setModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#a89080" }}>✕</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>Item Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inp} placeholder="e.g. Caramel Macchiato" />
              </div>
              <div>
                <label style={lbl}>Category *</label>
                <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} style={sel}>
                  <option value="">Select category</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label style={lbl}>Price (₱) *</label>
                <input type="number" min="0" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} style={inp} placeholder="0.00" />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>Description</label>
                <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} style={{ ...inp, height: "80px", resize: "vertical" }} placeholder="Describe the item..." />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={lbl}>Upload Image</label>
                <input ref={fileRef} type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files?.[0] || null)} style={{ ...inp, padding: "8px" }} />
              </div>
              <div>
                <label style={lbl}>Availability</label>
                <select value={form.is_available ? "true" : "false"} onChange={(e) => setForm({ ...form, is_available: e.target.value === "true" })} style={sel}>
                  <option value="true">Available</option>
                  <option value="false">Unavailable</option>
                </select>
              </div>
              <div>
                <label style={lbl}>Featured on Homepage</label>
                <select value={form.is_featured ? "true" : "false"} onChange={(e) => setForm({ ...form, is_featured: e.target.value === "true" })} style={sel}>
                  <option value="false">No</option>
                  <option value="true">Yes</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setModal(null)} style={btnCancel}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ ...btnAccent, opacity: saving ? 0.7 : 1 }}>{saving ? "Saving..." : modal === "add" ? "Add Item" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Item Confirm */}
      {deleteId && (
        <div style={overlay}>
          <div style={{ ...modalBox, maxWidth: "400px" }}>
            <h2 style={{ fontWeight: 900, fontSize: "18px", color: "#1a1008", marginBottom: "12px" }}>Delete Item?</h2>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>This action cannot be undone.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteId(null)} style={btnCancel}>Cancel</button>
              <button onClick={handleDelete} style={{ ...btnAccent, background: "#ef4444" }}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {catModal && (
        <div style={overlay}>
          <div style={{ ...modalBox, maxWidth: "480px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h2 style={{ fontWeight: 900, fontSize: "18px", color: "#1a1008", margin: 0 }}>{catModal === "add" ? "Add Category" : "Edit Category"}</h2>
              <button onClick={() => setCatModal(null)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", color: "#a89080" }}>✕</button>
            </div>
            <label style={lbl}>Category Name *</label>
            <input value={catForm.name} onChange={(e) => setCatForm({ ...catForm, name: e.target.value })} style={inp} placeholder="e.g. Cold Brews" />
            <label style={{ ...lbl, marginTop: "16px" }}>Sort Order</label>
            <input type="number" value={catForm.sort_order} onChange={(e) => setCatForm({ ...catForm, sort_order: Number(e.target.value) })} style={inp} />
            <label style={{ ...lbl, marginTop: "16px" }}>Visibility</label>
            <select value={catForm.is_active ? "true" : "false"} onChange={(e) => setCatForm({ ...catForm, is_active: e.target.value === "true" })} style={sel}>
              <option value="true">Active</option>
              <option value="false">Hidden</option>
            </select>
            <div style={{ display: "flex", gap: "12px", marginTop: "24px", justifyContent: "flex-end" }}>
              <button onClick={() => setCatModal(null)} style={btnCancel}>Cancel</button>
              <button onClick={handleCatSave} disabled={catSaving} style={{ ...btnAccent, opacity: catSaving ? 0.7 : 1 }}>{catSaving ? "Saving..." : catModal === "add" ? "Add Category" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Category Confirm */}
      {catDeleteId && (
        <div style={overlay}>
          <div style={{ ...modalBox, maxWidth: "400px" }}>
            <h2 style={{ fontWeight: 900, fontSize: "18px", color: "#1a1008", marginBottom: "12px" }}>Delete Category?</h2>
            <p style={{ color: "#666", fontSize: "14px", marginBottom: "24px" }}>Menu items in this category will lose their category. This cannot be undone.</p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
              <button onClick={() => setCatDeleteId(null)} style={btnCancel}>Cancel</button>
              <button onClick={handleCatDelete} style={{ ...btnAccent, background: "#ef4444" }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const btnAccent: React.CSSProperties = { background: "#7c4a1e", color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
const btnEdit: React.CSSProperties = { background: "#eff6ff", color: "#3b82f6", border: "none", borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "12px", cursor: "pointer" };
const btnDel: React.CSSProperties = { background: "#fff0f0", color: "#ef4444", border: "none", borderRadius: "6px", padding: "6px 14px", fontWeight: 600, fontSize: "12px", cursor: "pointer" };
const btnCancel: React.CSSProperties = { background: "#f1ebe5", color: "#555", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 700, fontSize: "13px", cursor: "pointer" };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 };
const modalBox: React.CSSProperties = { background: "#fff", borderRadius: "14px", padding: "32px", width: "100%", maxWidth: "600px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)", maxHeight: "90vh", overflowY: "auto" };
const lbl: React.CSSProperties = { display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.3px" };
const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1.5px solid #e8ddd4", borderRadius: "8px", fontSize: "13px", outline: "none", fontFamily: "inherit", boxSizing: "border-box" };
const sel: React.CSSProperties = { width: "100%", padding: "10px 12px", border: "1.5px solid #e8ddd4", borderRadius: "8px", fontSize: "13px", outline: "none", background: "#fff", cursor: "pointer", boxSizing: "border-box" };
