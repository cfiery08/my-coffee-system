"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

type OrderItem = { id: string; menu_item_name: string; quantity: number; subtotal: number };
type Order = {
  id: string;
  order_type: string;
  status: string;
  payment_status: string;
  total_amount: number;
  created_at: string;
  order_items: OrderItem[];
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  preparing: "bg-orange-100 text-orange-800",
  ready: "bg-green-100 text-green-800",
  delivered: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-700",
};

export default function ProfilePage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<{ full_name: string; email: string; contact_number: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [user, loading, router]);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("user_accounts").select("full_name, email, contact_number").eq("id", user.id).single(),
      supabase.from("orders")
        .select("id, order_type, status, payment_status, total_amount, created_at, order_items(id, menu_item_name, quantity, subtotal)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false }),
    ]).then(([{ data: p }, { data: o }]) => {
      setProfile(p);
      setOrders((o as Order[]) ?? []);
      setFetching(false);
    });
  }, [user]);

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
      <div className="max-w-2xl mx-auto px-6 py-10">

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-6 py-5 mb-8">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center text-amber-700 font-bold text-xl flex-shrink-0">
              {profile?.full_name?.[0]?.toUpperCase() ?? "?"}
            </div>
            <div>
              <p className="font-bold text-gray-900 text-lg">{profile?.full_name ?? "—"}</p>
              <p className="text-sm text-gray-500">{profile?.email}</p>
              {profile?.contact_number && <p className="text-sm text-gray-500">{profile.contact_number}</p>}
            </div>
          </div>
        </div>

        {/* Order history */}
        <h2 id="orders" className="text-base font-bold text-gray-900 uppercase tracking-wide mb-4 scroll-mt-24">Order History</h2>

        {orders.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-16">No orders yet.</p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
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
                    </div>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-900 text-sm">₱{order.total_amount.toFixed(2)}</p>
                    <p className={`text-xs font-medium ${order.payment_status === "paid" ? "text-green-600" : "text-red-500"}`}>
                      {order.payment_status}
                    </p>
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-gray-400 transition-transform flex-shrink-0 ${expanded === order.id ? "rotate-180" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {expanded === order.id && (
                  <div className="border-t border-gray-100 px-5 py-4 bg-gray-50 space-y-2">
                    {order.order_items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between text-sm">
                        <span className="text-gray-700">{item.menu_item_name} <span className="text-gray-400">× {item.quantity}</span></span>
                        <span className="font-medium text-gray-900">₱{item.subtotal.toFixed(2)}</span>
                      </div>
                    ))}
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
