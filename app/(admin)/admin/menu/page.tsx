"use client";
import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import SystemIcon from "@/app/components/SystemIcon";

const ACCENT = "#7c4a1e";
type Category = { id: string; name: string; sort_order: number; is_active: boolean };
type MenuItem = { id: string; name: string; description: string; price: number; image_url: string | null; is_available: boolean; is_featured: boolean; category_id: string; categories: { name: string } | null; orderAvailability: "available" | "unavailable" | "recipe_needed" };
type RecipeLink = { menu_item_id: string; inventory_id: number; quantity_required: number };
type IngredientStock = { inventory_id: number; quantity: number; status: "available" | "unavailable" | "low_stock" };

const EMPTY_ITEM = { name: "", description: "", price: "", is_available: true, is_featured: false, category_id: "" };
const EMPTY_CAT = { name: "", sort_order: 0, is_active: true };

export default function AdminMenuPage() {
  const [tab, setTab] = useState<"items" | "categories">("items");
  const [items, setItems] = useState<MenuItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState("");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [categoryFilterOpen, setCategoryFilterOpen] = useState(false);

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
    const [{ data: m, error: menuError }, { data: c, error: categoryError }, { data: recipeLinks, error: recipeError }, { data: ingredientStock, error: stockError }] = await Promise.all([
      supabase.from("menu_items").select("id, name, description, price, image_url, is_available, is_featured, category_id, categories(name)").order("name"),
      supabase.from("categories").select("id, name, sort_order, is_active").order("sort_order"),
      supabase.from("menu_ingredients").select("menu_item_id, inventory_id, quantity_required"),
      supabase.from("inventory").select("inventory_id, quantity, status"),
    ]);
    if (menuError || categoryError || recipeError || stockError) setPageError(menuError?.message || categoryError?.message || recipeError?.message || stockError?.message || "Unable to load menu data.");
    else setPageError("");
    const links = (recipeLinks ?? []) as RecipeLink[];
    const stockById = new Map(((ingredientStock ?? []) as IngredientStock[]).map((ingredient) => [ingredient.inventory_id, ingredient]));
    const enrichedItems = ((m as unknown as Omit<MenuItem, "orderAvailability">[]) ?? []).map((item) => {
      const itemLinks = links.filter((link) => link.menu_item_id === item.id);
      const unavailable = itemLinks.some((link) => {
        const stock = stockById.get(link.inventory_id);
        return !stock || stock.status === "unavailable" || Number(stock.quantity) < Number(link.quantity_required);
      });
      const orderAvailability: MenuItem["orderAvailability"] = !item.is_available || unavailable ? "unavailable" : itemLinks.length === 0 ? "recipe_needed" : "available";
      return { ...item, orderAvailability };
    });
    setItems(enrichedItems);
    setCategories(c ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
    const channel = supabase.channel("admin-menu-availability")
      .on("postgres_changes", { event: "*", schema: "public", table: "inventory" }, () => { void load(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "menu_ingredients" }, () => { void load(); })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  async function handleSave() {
    if (!form.name.trim() || !form.price || !form.category_id) { alert("Name, price, and category are required."); return; }
    setPageError("");
    setSaving(true);
    let image_url = null;
    if (imageFile) {
      const ext = imageFile.name.split(".").pop();
      const path = `menu/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("menu-images").upload(path, imageFile, { upsert: true });
      if (upErr) { setPageError(`Image upload failed: ${upErr.message}`); setSaving(false); return; }
      const { data: urlData } = supabase.storage.from("menu-images").getPublicUrl(path);
      image_url = urlData.publicUrl;
    }
    const payload: Record<string, unknown> = {
      name: form.name.trim(), description: form.description,
      price: parseFloat(form.price as unknown as string),
      is_available: form.is_available, is_featured: form.is_featured,
      category_id: form.category_id,
    };
    if (image_url) payload.image_url = image_url;

    const { error } = modal === "edit" && form.id
      ? await supabase.from("menu_items").update(payload).eq("id", form.id)
      : await supabase.from("menu_items").insert(payload);
    setSaving(false);
    if (error) { setPageError(`Could not save menu item: ${error.message}`); return; }
    setModal(null);
    await load();
  }

  async function handleDelete() {
    if (!deleteId) return;
    setPageError("");
    const { error } = await supabase.from("menu_items").delete().eq("id", deleteId);
    if (error) { alert(`Could not delete menu item: ${error.message}`); return; }
    setDeleteId(null);
    await load();
  }

  async function handleCatSave() {
    if (!catForm.name.trim()) { alert("Category name is required."); return; }
    setPageError("");
    setCatSaving(true);
    const values = { name: catForm.name.trim(), sort_order: catForm.sort_order, is_active: catForm.is_active };
    const { error } = catModal === "edit" && catForm.id
      ? await supabase.from("categories").update(values).eq("id", catForm.id)
      : await supabase.from("categories").insert(values);
    setCatSaving(false);
    if (error) { setPageError(`Could not save category: ${error.message}`); return; }
    setCatModal(null);
    await load();
  }

  async function handleCatDelete() {
    if (!catDeleteId) return;
    setPageError("");
    const { error } = await supabase.from("categories").delete().eq("id", catDeleteId);
    if (error) { alert(`Could not delete category: ${error.message}`); return; }
    setCatDeleteId(null);
    await load();
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
      {pageError && <div role="alert" style={{ marginBottom: "16px", padding: "12px 16px", borderRadius: "8px", background: "#fff0f0", color: "#b91c1c", fontSize: "13px" }}>{pageError}</div>}

      {/* Tabs */}
      <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "#f1ebe5", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
        {(["items", "categories"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: "8px 20px", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: "pointer", background: tab === t ? "#fff" : "transparent", color: tab === t ? ACCENT : "#a89080", boxShadow: tab === t ? "0 1px 4px rgba(0,0,0,0.08)" : "none" }}>
            {t === "items" ? <><SystemIcon name="coffee" size={15} /> Menu Items</> : <><SystemIcon name="category" size={15} /> Categories</>}
          </button>
        ))}
      </div>

      {/* Items Tab */}
      {tab === "items" && (
        <>
          <div style={{ marginBottom: "20px", maxWidth: "420px", position: "relative" }}>
            <div style={{ position: "relative" }}>
              <input aria-label="Search menu items" placeholder="Search items..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ ...inp, paddingRight: "52px" }} />
              <button type="button" aria-label="Filter by category" aria-expanded={categoryFilterOpen} onClick={() => setCategoryFilterOpen((open) => !open)} style={{ position: "absolute", top: "50%", right: "6px", transform: "translateY(-50%)", width: "36px", height: "34px", display: "flex", alignItems: "center", justifyContent: "center", border: "none", borderRadius: "6px", background: categoryFilterOpen || filterCat ? "#f1ebe5" : "transparent", color: ACCENT, cursor: "pointer" }}>
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16l-6.5 7.5v5l-3 1.5v-6.5L4 5z" /></svg>
                {filterCat && <span style={{ position: "absolute", top: "5px", right: "5px", width: "6px", height: "6px", borderRadius: "50%", background: "#b45309" }} />}
              </button>
            </div>
            {categoryFilterOpen && <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 20, width: "230px", padding: "14px", border: "1px solid #ede3d9", borderRadius: "10px", background: "#fff", boxShadow: "0 8px 24px rgba(40,24,12,0.14)" }}>
              <label style={{ ...lbl, marginBottom: "8px" }}>Filter by category</label>
              <select aria-label="Filter menu by category" value={filterCat} onChange={(e) => { setFilterCat(e.target.value); setCategoryFilterOpen(false); }} style={sel}>
                <option value="">All Categories</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {filterCat && <button type="button" onClick={() => { setFilterCat(""); setCategoryFilterOpen(false); }} style={{ marginTop: "9px", padding: 0, border: "none", background: "none", color: ACCENT, fontSize: "12px", fontWeight: 700, cursor: "pointer" }}>Clear category filter</button>}
            </div>}
          </div>
          <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#faf7f4", borderBottom: "1px solid #ede8e3" }}>
                  {["Image", "Name", "Category", "Price", "Order status", "Featured", "Actions"].map((h) => (
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
                        : <div style={{ width: "52px", height: "52px", borderRadius: "8px", background: "#f1ebe5", display: "flex", alignItems: "center", justifyContent: "center" }}><SystemIcon name="coffee" size={20} /></div>
                      }
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a1008" }}>{item.name}</div>
                      <div style={{ fontSize: "12px", color: "#a89080", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.description}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}><span style={{ background: "#f1ebe5", padding: "3px 10px", borderRadius: "10px", fontSize: "12px", fontWeight: 600, color: "#7c4a1e" }}>{(item.categories as unknown as { name: string } | null)?.name || "—"}</span></td>
                    <td style={{ padding: "12px 16px", fontWeight: 700, fontSize: "14px", color: "#1a1008" }}>₱{Number(item.price).toFixed(2)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span style={{ display: "inline-block", fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "10px", background: item.orderAvailability === "available" ? "#f0fdf4" : item.orderAvailability === "recipe_needed" ? "#fff7ed" : "#fff0f0", color: item.orderAvailability === "available" ? "#15803d" : item.orderAvailability === "recipe_needed" ? "#b45309" : "#b91c1c" }}>
                        {item.orderAvailability === "available" ? "Available" : item.orderAvailability === "recipe_needed" ? "Recipe needed" : "Unavailable"}
                      </span>
                      <div style={{ marginTop: "4px", fontSize: "10px", color: "#a89080" }}>Menu setting: {item.is_available ? "On" : "Off"}</div>
                    </td>
                    <td style={{ padding: "12px 16px" }}><span style={{ fontSize: "13px" }}>{item.is_featured ? <SystemIcon name="star" size={15} /> : "—"}</span></td>
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
                <SystemIcon name="category" size={22} />
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
              <button onClick={() => setModal(null)} aria-label="Close menu form" style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", display: "flex" }}><SystemIcon name="x" size={20} /></button>
            </div>
            {pageError && <p role="alert" style={{ color: "#b91c1c", fontSize: "13px", margin: "-12px 0 16px" }}>{pageError}</p>}
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
              <button onClick={() => setCatModal(null)} aria-label="Close category form" style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", display: "flex" }}><SystemIcon name="x" size={20} /></button>
            </div>
            {pageError && <p role="alert" style={{ color: "#b91c1c", fontSize: "13px", margin: "-12px 0 16px" }}>{pageError}</p>}
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
