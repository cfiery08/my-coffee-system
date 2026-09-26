"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

const ACCENT = "#7c4a1e";
const peso = (n: number) => `₱${Number(n).toFixed(2)}`;

type Category = { id: string; name: string };
type MenuItem = { id: string; name: string; description: string; price: number; image_url: string | null; category_id: string };
type CartItem = { id: string; name: string; price: number; quantity: number; notes: string };

export default function CashierPOSPage() {
  const { user } = useAuth();
  const [categories, setCategories] = useState<Category[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState("All");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [tableNumber, setTableNumber] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "gcash" | "card">("cash");
  const [notes, setNotes] = useState("");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [{ data: cats }, { data: items }] = await Promise.all([
        supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
        supabase.from("menu_items").select("id, name, description, price, image_url, category_id").eq("is_available", true).order("name"),
      ]);
      setCategories(cats ?? []);
      setMenuItems(items ?? []);
      setLoading(false);
    }
    load();
  }, []);

  function addToCart(item: MenuItem) {
    setCart((prev) => {
      const existing = prev.find((c) => c.id === item.id);
      if (existing) return prev.map((c) => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { id: item.id, name: item.name, price: item.price, quantity: 1, notes: "" }];
    });
  }

  function updateQty(id: string, qty: number) {
    if (qty <= 0) setCart((prev) => prev.filter((c) => c.id !== id));
    else setCart((prev) => prev.map((c) => c.id === id ? { ...c, quantity: qty } : c));
  }

  function updateItemNotes(id: string, n: string) {
    setCart((prev) => prev.map((c) => c.id === id ? { ...c, notes: n } : c));
  }

  const subtotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);

  const filtered = menuItems.filter((i) => {
    const matchCat = activeCategory === "All" || categories.find((c) => c.id === i.category_id)?.name === activeCategory;
    const matchSearch = i.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  async function placeOrder() {
    if (cart.length === 0) { setError("Cart is empty."); return; }
    setPlacing(true); setError("");

    const orderNotes = [
      customerName ? `Customer: ${customerName}` : "",
      notes ? `Note: ${notes}` : "",
    ].filter(Boolean).join("\n");

    const { data: order, error: orderErr } = await supabase.from("orders").insert({
      user_id: null,
      order_type: "dine_in",
      status: "confirmed",
      payment_method: paymentMethod,
      payment_status: paymentMethod === "cash" ? "unpaid" : "paid",
      subtotal,
      delivery_fee: 0,
      total_amount: subtotal,
      notes: orderNotes || null,
      table_number: tableNumber || null,
      cashier_id: user?.id,
    }).select("id").single();

    if (orderErr || !order) { setError(orderErr?.message || "Failed to place order."); setPlacing(false); return; }

    await supabase.from("order_items").insert(
      cart.map((item) => ({
        order_id: order.id,
        menu_item_id: item.id,
        menu_item_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
        notes: item.notes || null,
      }))
    );

    await supabase.from("order_status_history").insert({ order_id: order.id, status: "confirmed", changed_by: user?.id });

    setCart([]);
    setTableNumber("");
    setCustomerName("");
    setNotes("");
    setPaymentMethod("cash");
    setSuccess(`Order #${order.id.slice(0, 8).toUpperCase()} placed!`);
    setPlacing(false);
    setTimeout(() => setSuccess(null), 4000);
  }

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading menu...</div>;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: "20px", height: "calc(100vh - 112px)" }}>

      {/* LEFT — Menu */}
      <div style={{ display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ marginBottom: "14px" }}>
          <h1 style={{ fontSize: "18px", fontWeight: 900, color: "#1a1008", margin: "0 0 12px" }}>Point of Sale — Dine In</h1>

          {/* Search */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px", background: "#fff", borderRadius: "8px", padding: "8px 12px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "12px" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search menu..." style={{ border: "none", outline: "none", fontSize: "13px", color: "#333", background: "transparent", width: "100%" }} />
          </div>

          {/* Category tabs */}
          <div style={{ display: "flex", gap: "6px", overflowX: "auto", paddingBottom: "4px" }}>
            {["All", ...categories.map((c) => c.name)].map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat)} style={{
                padding: "6px 14px", borderRadius: "20px", border: "none", cursor: "pointer",
                fontSize: "12px", fontWeight: 700, whiteSpace: "nowrap", flexShrink: 0,
                background: activeCategory === cat ? ACCENT : "#fff",
                color: activeCategory === cat ? "#fff" : "#555",
                boxShadow: activeCategory === cat ? "none" : "0 1px 4px rgba(0,0,0,0.06)",
              }}>{cat}</button>
            ))}
          </div>
        </div>

        {/* Menu grid */}
        <div style={{ flex: 1, overflowY: "auto", display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: "12px", alignContent: "start" }}>
          {filtered.map((item) => {
            const inCart = cart.find((c) => c.id === item.id);
            return (
              <div key={item.id} onClick={() => addToCart(item)} style={{
                background: "#fff", borderRadius: "12px", overflow: "hidden", cursor: "pointer",
                boxShadow: inCart ? `0 0 0 2px ${ACCENT}` : "0 1px 4px rgba(0,0,0,0.07)",
                transition: "all 0.15s", position: "relative",
              }}>
                <div style={{ height: "100px", background: "#f1ebe5", position: "relative" }}>
                  {item.image_url
                    ? <img src={item.image_url} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px" }}>☕</div>
                  }
                  {inCart && (
                    <div style={{ position: "absolute", top: "6px", right: "6px", width: "22px", height: "22px", borderRadius: "50%", background: ACCENT, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 900 }}>
                      {inCart.quantity}
                    </div>
                  )}
                </div>
                <div style={{ padding: "10px 12px" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008", marginBottom: "2px", lineHeight: 1.3 }}>{item.name}</div>
                  <div style={{ fontWeight: 800, fontSize: "13px", color: ACCENT }}>₱{Number(item.price).toFixed(2)}</div>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "40px", color: "#aaa" }}>No items found.</div>}
        </div>
      </div>

      {/* RIGHT — Cart & Order */}
      <div style={{ background: "#fff", borderRadius: "14px", boxShadow: "0 1px 6px rgba(0,0,0,0.08)", display: "flex", flexDirection: "column", overflow: "hidden" }}>

        <div style={{ padding: "18px 20px", borderBottom: "1px solid #f1ebe5" }}>
          <div style={{ fontWeight: 800, fontSize: "16px", color: "#1a1008" }}>Current Order</div>
          <div style={{ fontSize: "12px", color: "#a89080", marginTop: "2px" }}>{cart.length === 0 ? "Tap items to add" : `${cart.reduce((s, c) => s + c.quantity, 0)} item(s)`}</div>
        </div>

        {/* Order details */}
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #f1ebe5", display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#a89080", display: "block", marginBottom: "4px" }}>TABLE NO.</label>
              <input value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} placeholder="e.g. 5" style={{ width: "100%", border: "1.5px solid #e8ddd4", borderRadius: "7px", padding: "8px 10px", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: 700, color: "#a89080", display: "block", marginBottom: "4px" }}>CUSTOMER NAME</label>
              <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Optional" style={{ width: "100%", border: "1.5px solid #e8ddd4", borderRadius: "7px", padding: "8px 10px", fontSize: "13px", outline: "none", boxSizing: "border-box" }} />
            </div>
          </div>
          <div>
            <label style={{ fontSize: "11px", fontWeight: 700, color: "#a89080", display: "block", marginBottom: "4px" }}>PAYMENT</label>
            <div style={{ display: "flex", gap: "6px" }}>
              {(["cash", "gcash", "card"] as const).map((m) => (
                <button key={m} onClick={() => setPaymentMethod(m)} style={{
                  flex: 1, padding: "7px", borderRadius: "7px", border: "1.5px solid",
                  borderColor: paymentMethod === m ? ACCENT : "#e8ddd4",
                  background: paymentMethod === m ? "#fdf6f0" : "#fff",
                  color: paymentMethod === m ? ACCENT : "#555",
                  fontSize: "12px", fontWeight: 700, cursor: "pointer", textTransform: "capitalize",
                }}>{m}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Cart items */}
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 20px" }}>
          {cart.length === 0 && (
            <div style={{ textAlign: "center", padding: "40px 0", color: "#c8b8ac", fontSize: "13px" }}>
              <div style={{ fontSize: "32px", marginBottom: "8px" }}>☕</div>
              No items added yet
            </div>
          )}
          {cart.map((item) => (
            <div key={item.id} style={{ marginBottom: "12px", paddingBottom: "12px", borderBottom: "1px solid #f1ebe5" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008", flex: 1 }}>{item.name}</div>
                <div style={{ fontWeight: 800, fontSize: "13px", color: ACCENT, marginLeft: "8px" }}>{peso(item.price * item.quantity)}</div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button onClick={() => updateQty(item.id, item.quantity - 1)} style={{ width: "26px", height: "26px", borderRadius: "6px", border: "1.5px solid #e8ddd4", background: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#555", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1008", minWidth: "20px", textAlign: "center" }}>{item.quantity}</span>
                <button onClick={() => updateQty(item.id, item.quantity + 1)} style={{ width: "26px", height: "26px", borderRadius: "6px", border: "1.5px solid #e8ddd4", background: "#fff", cursor: "pointer", fontSize: "14px", fontWeight: 700, color: "#555", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
                <input value={item.notes} onChange={(e) => updateItemNotes(item.id, e.target.value)} placeholder="Item note..." style={{ flex: 1, border: "1.5px solid #e8ddd4", borderRadius: "6px", padding: "5px 8px", fontSize: "11px", outline: "none" }} />
                <button onClick={() => updateQty(item.id, 0)} style={{ background: "#fff0f0", border: "none", borderRadius: "6px", padding: "5px 8px", color: "#ef4444", fontSize: "11px", cursor: "pointer", fontWeight: 700 }}>✕</button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: "14px 20px", borderTop: "1px solid #f1ebe5" }}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes (optional)..." rows={2} style={{ width: "100%", border: "1.5px solid #e8ddd4", borderRadius: "7px", padding: "8px 10px", fontSize: "12px", outline: "none", resize: "none", marginBottom: "12px", boxSizing: "border-box" }} />

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
            <span style={{ fontSize: "13px", color: "#a89080" }}>Subtotal</span>
            <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1008" }}>{peso(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "14px" }}>
            <span style={{ fontSize: "15px", fontWeight: 800, color: "#1a1008" }}>Total</span>
            <span style={{ fontSize: "18px", fontWeight: 900, color: ACCENT }}>{peso(subtotal)}</span>
          </div>

          {error && <p style={{ color: "#ef4444", fontSize: "12px", marginBottom: "8px" }}>{error}</p>}
          {success && (
            <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 14px", marginBottom: "10px", fontSize: "13px", fontWeight: 700, color: "#16a34a" }}>
              ✅ {success}
            </div>
          )}

          <button onClick={placeOrder} disabled={placing || cart.length === 0} style={{
            width: "100%", background: cart.length === 0 ? "#e8ddd4" : ACCENT,
            color: cart.length === 0 ? "#a89080" : "#fff",
            border: "none", borderRadius: "10px", padding: "14px",
            fontWeight: 900, fontSize: "15px", cursor: cart.length === 0 ? "not-allowed" : "pointer",
            transition: "all 0.15s",
          }}>
            {placing ? "Placing Order..." : `Place Order · ${peso(subtotal)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
