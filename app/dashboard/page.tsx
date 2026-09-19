"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

type OrderItem = { id: string; menu_item_name: string; quantity: number; unit_price: number; subtotal: number };
type Order = {
  id: string;
  order_type: string;
  status: string;
  payment_status: string;
  total_amount: number;
  table_number: string | null;
  notes: string | null;
  created_at: string;
  user_accounts: { full_name: string; email: string } | null;
  order_items: OrderItem[];
};

const STATUS_FLOW: Record<string, string> = {
  pending: "confirmed",
  confirmed: "preparing",
  preparing: "ready",
  ready: "delivered",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function DashboardPage() {
  const { user, role, loading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [fetching, setFetching] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && (!user || (role !== "admin" && role !== "cashier"))) {
      router.replace("/");
    }
  }, [user, role, loading, router]);

  useEffect(() => {
    if (!user || (role !== "admin" && role !== "cashier")) return;
    fetchOrders();

    const channel = supabase
      .channel("orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, role]);

  async function fetchOrders() {
    const { data } = await supabase
      .from("orders")
      .select("id, order_type, status, payment_status, total_amount, table_number, notes, created_at, user_accounts(full_name, email), order_items(id, menu_item_name, quantity, unit_price, subtotal)")
      .order("created_at", { ascending: false });
    setOrders((data as unknown as Order[]) ?? []);
    setFetching(false);
  }

  async function advanceStatus(order: Order) {
    const next = STATUS_FLOW[order.status];
    if (!next) return;
    await supabase.from("orders").update({ status: next }).eq("id", order.id);
    await supabase.from("order_status_history").insert({ order_id: order.id, status: next, changed_by: user!.id });
    fetchOrders();
  }

  async function cancelOrder(order: Order) {
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    await supabase.from("order_status_history").insert({ order_id: order.id, status: "cancelled", changed_by: user!.id });
    fetchOrders();
  }

  async function markPaid(order: Order) {
    await supabase.from("orders").update({ payment_status: "paid" }).eq("id", order.id);
    fetchOrders();
  }

  const filtered = statusFilter === "all" ? orders : orders.filter((o) => o.status === statusFilter);

  if (loading || fetching) {
    return (
      <div className="min-h-screen bg-white font-sans">
        <Navbar />
        <div className="flex justify-center items-center py-32">
          <div className="w-8 h-8 border-4 border-amber-700 border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Orders Dashboard</h1>
          <span className="text-sm text-gray-500 capitalize">{role}</span>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 flex-wrap mb-6">
          {["all", "pending", "confirmed", "preparing", "ready", "delivered", "cancelled"].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium border transition-colors capitalize ${
                statusFilter === s ? "bg-amber-700 border-amber-700 text-white" : "bg-white border-gray-300 text-gray-600 hover:border-amber-600"
              }`}
            >
              {s}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-center text-gray-400 py-20">No orders found.</p>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                {/* Order row */}
                <div
                  className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                  onClick={() => setExpanded(expanded === order.id ? null : order.id)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-gray-900 text-sm">#{order.id.slice(0, 8).toUpperCase()}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {order.status}
                      </span>
                      <span className="text-xs text-gray-400 capitalize">{order.order_type.replace("_", " ")}</span>
                      {order.table_number && <span className="text-xs text-gray-400">Table {order.table_number}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {order.user_accounts?.full_name ?? order.user_accounts?.email ?? "Guest"} · {new Date(order.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="text-right">
                      <p className="font-bold text-gray-900 text-sm">₱{order.total_amount.toFixed(2)}</p>
                      <p className={`text-xs font-medium ${order.payment_status === "paid" ? "text-green-600" : "text-red-500"}`}>
                        {order.payment_status}
                      </p>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                      {order.payment_status === "unpaid" && (
                        <button
                          onClick={() => markPaid(order)}
                          className="text-xs px-3 py-1.5 rounded-full border border-green-500 text-green-600 hover:bg-green-50 transition-colors font-medium"
                        >
                          Mark Paid
                        </button>
                      )}
                      {STATUS_FLOW[order.status] && (
                        <button
                          onClick={() => advanceStatus(order)}
                          className="text-xs px-3 py-1.5 rounded-full text-white font-medium hover:opacity-90 transition-opacity capitalize"
                          style={{ backgroundColor: "#7c4a1e" }}
                        >
                          → {STATUS_FLOW[order.status]}
                        </button>
                      )}
                      {order.status !== "cancelled" && order.status !== "delivered" && (
                        <button
                          onClick={() => cancelOrder(order)}
                          className="text-xs px-3 py-1.5 rounded-full border border-red-300 text-red-500 hover:bg-red-50 transition-colors font-medium"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`h-4 w-4 text-gray-400 transition-transform ${expanded === order.id ? "rotate-180" : ""}`}
                      fill="none" viewBox="0 0 24 24" stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>

                {/* Expanded order items */}
                {expanded === order.id && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Items</p>
                    <div className="space-y-2">
                      {order.order_items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-700">{item.menu_item_name} <span className="text-gray-400">× {item.quantity}</span></span>
                          <span className="font-medium text-gray-900">₱{item.subtotal.toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                    {order.notes && (
                      <p className="text-xs text-gray-500 mt-3 italic">Note: {order.notes}</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
