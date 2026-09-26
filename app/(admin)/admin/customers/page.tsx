"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
type Customer = { id: string; full_name: string; email: string; contact_number: string; created_at: string; order_count: number; total_spent: number };
type Order = { id: string; status: string; total_amount: number; created_at: string; order_type: string; order_items: { menu_item_name: string; quantity: number }[] };

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"joined" | "orders" | "spent">("joined");
  const [ordersModal, setOrdersModal] = useState<{ customer: Customer; orders: Order[] } | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  async function load() {
    const { data: users } = await supabase.from("user_accounts").select("id, full_name, email, contact_number, created_at").eq("role", "customer").order("created_at", { ascending: false });
    if (!users) { setLoading(false); return; }
    const enriched = await Promise.all(users.map(async (u) => {
      const { count } = await supabase.from("orders").select("*", { count: "exact", head: true }).eq("user_id", u.id);
      const { data: rev } = await supabase.from("orders").select("total_amount").eq("user_id", u.id).neq("status", "cancelled");
      const total_spent = (rev ?? []).reduce((s: number, o: { total_amount: number }) => s + (o.total_amount || 0), 0);
      return { ...u, order_count: count ?? 0, total_spent };
    }));
    setCustomers(enriched);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-customers")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_accounts" }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function viewOrders(c: Customer) {
    setOrdersLoading(true);
    setOrdersModal({ customer: c, orders: [] });
    const { data } = await supabase.from("orders").select("id, status, total_amount, created_at, order_type, order_items(menu_item_name, quantity)").eq("user_id", c.id).order("created_at", { ascending: false });
    setOrdersModal({ customer: c, orders: (data as unknown as Order[]) ?? [] });
    setOrdersLoading(false);
  }

  async function handleDelete(c: Customer) {
    if (!confirm(`Delete ${c.full_name}'s account? This cannot be undone.`)) return;
    await supabase.from("user_accounts").delete().eq("id", c.id);
    load();
  }

  const filtered = customers
    .filter((c) => `${c.full_name} ${c.email}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (sort === "orders") return b.order_count - a.order_count;
      if (sort === "spent") return b.total_spent - a.total_spent;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const totalRevenue = customers.reduce((s, c) => s + c.total_spent, 0);
  const totalOrders = customers.reduce((s, c) => s + c.order_count, 0);

  if (loading) return <div style={{ textAlign: "center", padding: "80px", color: "#a89080" }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Customers</h1>
          <p style={{ color: "#a89080", fontSize: "13px", marginTop: "4px" }}>{customers.length} registered customers</p>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "16px", marginBottom: "24px" }}>
        {[
          { label: "Total Customers", value: customers.length, icon: "👥", color: "#22c55e" },
          { label: "Total Orders", value: totalOrders, icon: "📦", color: "#3b82f6" },
          { label: "Total Revenue", value: `₱${totalRevenue.toLocaleString("en", { minimumFractionDigits: 2 })}`, icon: "💰", color: ACCENT },
        ].map((s) => (
          <div key={s.label} style={{ background: "#fff", borderRadius: "12px", padding: "20px 22px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", borderTop: `3px solid ${s.color}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#a89080", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "6px" }}>{s.label}</div>
              <div style={{ fontSize: "22px", fontWeight: 900, color: "#1a1008" }}>{s.value}</div>
            </div>
            <span style={{ fontSize: "28px" }}>{s.icon}</span>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
        <input placeholder="Search by name or email..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, padding: "10px 14px", border: "1.5px solid #e8ddd4", borderRadius: "8px", fontSize: "13px", outline: "none" }} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ padding: "10px 14px", border: "1.5px solid #e8ddd4", borderRadius: "8px", fontSize: "13px", outline: "none", background: "#fff", cursor: "pointer" }}>
          <option value="joined">Sort: Newest</option>
          <option value="orders">Sort: Most Orders</option>
          <option value="spent">Sort: Most Spent</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#faf7f4", borderBottom: "1px solid #ede8e3" }}>
              {["Customer", "Email", "Joined", "Orders", "Total Spent", "Actions"].map((h) => (
                <th key={h} style={{ padding: "13px 16px", textAlign: "left", fontSize: "11px", fontWeight: 800, color: "#a89080", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#aaa" }}>No customers found.</td></tr>}
            {filtered.map((c) => (
              <tr key={c.id} style={{ borderBottom: "1px solid #faf7f4" }}>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", background: "#f1ebe5", display: "flex", alignItems: "center", justifyContent: "center", color: ACCENT, fontWeight: 800, fontSize: "14px", flexShrink: 0 }}>
                      {c.full_name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: "14px", color: "#1a1008" }}>{c.full_name}</div>
                  </div>
                </td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#555" }}>{c.email}</td>
                <td style={{ padding: "14px 16px", fontSize: "13px", color: "#a89080" }}>{new Date(c.created_at).toLocaleDateString()}</td>
                <td style={{ padding: "14px 16px" }}><span style={{ background: "#eff6ff", color: "#3b82f6", padding: "3px 10px", borderRadius: "10px", fontSize: "12px", fontWeight: 700 }}>{c.order_count} order{c.order_count !== 1 ? "s" : ""}</span></td>
                <td style={{ padding: "14px 16px", fontWeight: 700, fontSize: "14px", color: "#1a1008" }}>₱{c.total_spent.toLocaleString("en", { minimumFractionDigits: 2 })}</td>
                <td style={{ padding: "14px 16px" }}>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => viewOrders(c)} style={{ background: "#f1ebe5", border: "none", borderRadius: "6px", padding: "7px 12px", fontSize: "12px", fontWeight: 600, color: "#555", cursor: "pointer" }}>Orders</button>
                    <button onClick={() => handleDelete(c)} style={{ background: "#fff0f0", border: "none", borderRadius: "6px", padding: "7px 12px", fontSize: "12px", fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Order History Modal */}
      {ordersModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "28px 32px", width: "560px", maxHeight: "80vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <div>
                <h2 style={{ fontSize: "17px", fontWeight: 900, color: "#1a1008", margin: 0 }}>{ordersModal.customer.full_name}&apos;s Orders</h2>
                <p style={{ fontSize: "12px", color: "#a89080", margin: "2px 0 0" }}>{ordersModal.customer.email}</p>
              </div>
              <button onClick={() => setOrdersModal(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", fontSize: "20px" }}>✕</button>
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {ordersLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#aaa" }}>Loading...</div>
              ) : ordersModal.orders.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#aaa" }}>No orders yet.</div>
              ) : ordersModal.orders.map((o) => (
                <div key={o.id} style={{ border: "1px solid #ede8e3", borderRadius: "10px", padding: "14px 16px", marginBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                    <div style={{ fontWeight: 800, fontSize: "13px", color: "#1a1008" }}>#{o.id.slice(0, 8).toUpperCase()}</div>
                    <span style={{ fontSize: "11px", fontWeight: 700, padding: "3px 10px", borderRadius: "20px", background: "#f1ebe5", color: ACCENT, textTransform: "capitalize" }}>{o.status}</span>
                  </div>
                  <div style={{ fontSize: "12px", color: "#a89080", marginBottom: "8px" }}>{new Date(o.created_at).toLocaleDateString()} · {o.order_type.replace("_", " ")}</div>
                  {(o.order_items ?? []).map((item, i) => (
                    <div key={i} style={{ fontSize: "12px", color: "#555", display: "flex", justifyContent: "space-between" }}>
                      <span>{item.menu_item_name} × {item.quantity}</span>
                    </div>
                  ))}
                  <div style={{ borderTop: "1px solid #ede8e3", marginTop: "8px", paddingTop: "8px", display: "flex", justifyContent: "space-between", fontWeight: 800, fontSize: "13px" }}>
                    <span>Total</span>
                    <span style={{ color: ACCENT }}>₱{Number(o.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
