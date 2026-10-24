"use client";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/lib/AuthContext";

type Payment = { id: string; order_type: string; status: string; payment_method: string | null; payment_status: string | null; total_amount: number; created_at: string };
type Period = "today" | "week" | "month" | "all";
const ACCENT = "#7c4a1e";
const peso = (value: number) => `₱${Number(value || 0).toFixed(2)}`;
const PERIODS: { id: Period; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "week", label: "Last 7 days" },
  { id: "month", label: "Last 30 days" },
  { id: "all", label: "All time" },
];

export default function CashierPaymentsPage() {
  const { user, role } = useAuth();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [period, setPeriod] = useState<Period>("today");
  const load = useCallback(async () => {
    setLoading(true);
    const start = new Date();
    if (period === "today") start.setHours(0, 0, 0, 0);
    if (period === "week") start.setDate(start.getDate() - 7);
    if (period === "month") start.setDate(start.getDate() - 30);

    const rows: Payment[] = [];
    for (let offset = 0; ; offset += 1000) {
      let query = supabase.from("orders")
        .select("id, order_type, status, payment_method, payment_status, total_amount, created_at")
        .eq("order_source", "store")
        .order("created_at", { ascending: false })
        .range(offset, offset + 999);
      if (role === "cashier" && user?.id) query = query.eq("cashier_id", user.id);
      if (period !== "all") query = query.gte("created_at", start.toISOString());
      const { data, error: queryError } = await query;
      if (queryError) {
        setError(queryError.message);
        setPayments([]);
        break;
      }
      rows.push(...((data ?? []) as Payment[]));
      if ((data ?? []).length < 1000) {
        setError("");
        setPayments(rows);
        break;
      }
    }
    setLoading(false);
  }, [period, role, user?.id]);

  useEffect(() => {
    void load();
    const channel = supabase.channel("cashier-store-payments")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => void load())
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [load]);

  const paidTotal = payments.filter((payment) => payment.payment_status === "paid" && payment.status !== "cancelled").reduce((sum, payment) => sum + Number(payment.total_amount || 0), 0);
  const unpaidCount = payments.filter((payment) => payment.payment_status !== "paid").length;

  return <section style={{ maxWidth: 1000, margin: "0 auto" }}>
    <header style={{ marginBottom: 20 }}>
      <h1 style={{ margin: 0, color: "#1a1008", fontSize: 22, fontWeight: 900 }}>{role === "admin" ? "Store Payments" : "My Store Payments"}</h1>
      <p style={{ margin: "5px 0 0", color: "#8b7768", fontSize: 13 }}>{role === "admin" ? "Payment records and sales across all cashiers." : "Payment records and sales for orders you placed."}</p>
    </header>
    {error && <p role="alert" style={{ color: "#b42318", background: "#fff0f0", padding: 12, borderRadius: 8 }}>Could not load payments: {error}. Run the store-orders SQL migration in Supabase.</p>}
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 12 }} role="group" aria-label="Filter payments by date">
      <span style={{ marginRight: 4, color: "#6f5a49", fontSize: 12, fontWeight: 800 }}>Sales period</span>
      {PERIODS.map((option) => <button key={option.id} type="button" aria-pressed={period === option.id} onClick={() => setPeriod(option.id)} style={{ border: period === option.id ? `1px solid ${ACCENT}` : "1px solid #e9dfd7", borderRadius: 20, padding: "8px 14px", background: period === option.id ? ACCENT : "#fff", color: period === option.id ? "#fff" : "#604f42", fontWeight: 750, fontSize: 12, cursor: "pointer" }}>{option.label}</button>)}
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
      <SummaryCard title={`${role === "admin" ? "Paid store sales" : "My paid sales"} · ${PERIODS.find((option) => option.id === period)?.label}`} value={peso(paidTotal)} />
      <SummaryCard title="Orders shown" value={String(payments.length)} />
      <SummaryCard title="Awaiting payment" value={String(unpaidCount)} />
    </div>
    <div style={{ overflowX: "auto", background: "#fff", borderRadius: 12, boxShadow: "0 1px 5px rgba(0,0,0,.06)" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 650 }}>
        <thead><tr style={{ background: "#faf7f4", color: "#8b7768", textAlign: "left", fontSize: 11, textTransform: "uppercase" }}>
          {["Order", "Type", "Payment method", "Payment status", "Total", "Date"].map((title) => <th key={title} style={{ padding: "12px 14px" }}>{title}</th>)}
        </tr></thead>
        <tbody>
          {loading ? <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#8b7768" }}>Loading payments…</td></tr>
            : payments.length === 0 ? <tr><td colSpan={6} style={{ padding: 32, textAlign: "center", color: "#8b7768" }}>No store payments yet.</td></tr>
              : payments.map((payment) => <tr key={payment.id} style={{ borderTop: "1px solid #f1ebe5", color: "#43352b", fontSize: 13 }}>
                <td style={{ padding: "12px 14px", fontWeight: 800 }}>#{payment.id.slice(0, 8).toUpperCase()}</td>
                <td style={{ padding: "12px 14px" }}>{payment.order_type === "dine_in" ? "Dine in" : "Takeout"}</td>
                <td style={{ padding: "12px 14px", textTransform: "capitalize" }}>{payment.payment_method || "—"}</td>
                <td style={{ padding: "12px 14px", textTransform: "capitalize" }}>{payment.payment_status || "unpaid"}</td>
                <td style={{ padding: "12px 14px", fontWeight: 800 }}>{peso(payment.total_amount)}</td>
                <td style={{ padding: "12px 14px" }}>{new Date(payment.created_at).toLocaleString()}</td>
              </tr>)}
        </tbody>
      </table>
    </div>
  </section>;
}

function SummaryCard({ title, value }: { title: string; value: string }) {
  return <div style={{ background: "#fff", borderRadius: 12, padding: "16px 18px", boxShadow: "0 1px 5px rgba(0,0,0,.06)" }}>
    <div style={{ color: "#8b7768", fontSize: 12, fontWeight: 700 }}>{title}</div>
    <div style={{ color: "#7c4a1e", fontSize: 22, fontWeight: 900, marginTop: 5 }}>{value}</div>
  </div>;
}
