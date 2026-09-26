"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const ACCENT = "#7c4a1e";
type Staff = { id: string; full_name: string; email: string; contact_number: string; created_at: string; role: string };
const EMPTY_FORM = { full_name: "", email: "", contact_number: "", password: "", confirm_password: "", role: "cashier" };

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newRole, setNewRole] = useState<"cashier" | "staff">("cashier");

  async function load() {
    const { data } = await supabase.from("user_accounts").select("id, full_name, email, contact_number, created_at, role").in("role", ["cashier", "staff", "admin"]).order("created_at", { ascending: false });
    setStaff(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    const ch = supabase.channel("admin-staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "user_accounts" }, load)
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function handleSave() {
    if (!form.full_name || !form.email) return setError("Full name and email are required.");
    if (!editing && !form.password) return setError("Password is required for new staff.");
    if (form.password && form.password !== form.confirm_password) return setError("Passwords do not match.");
    setSaving(true); setError("");

    if (editing) {
      const { error: err } = await supabase.from("user_accounts").update({ full_name: form.full_name, contact_number: form.contact_number }).eq("id", editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
    } else {
      // Create new cashier via Supabase auth signUp
      const { data: authData, error: authErr } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { data: { full_name: form.full_name, contact_number: form.contact_number } },
      });
      if (authErr || !authData.user) { setError(authErr?.message || "Failed to create account."); setSaving(false); return; }
      await supabase.from("user_accounts").update({ role: newRole, contact_number: form.contact_number }).eq("id", authData.user.id);
    }

    setSaving(false); setShowModal(false); load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this staff account?")) return;
    await supabase.from("user_accounts").delete().eq("id", id);
    load();
  }

  const filtered = staff.filter((s) =>
    search === "" || `${s.full_name} ${s.email}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Manage Staff</h1>
          <p style={{ color: "#a89080", fontSize: "13px", marginTop: "2px" }}>{staff.length} staff member{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(EMPTY_FORM); setNewRole("cashier"); setError(""); setShowModal(true); }} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 800, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Staff
        </button>
      </div>

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#fff", borderRadius: "8px", padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "20px", maxWidth: "360px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." style={{ border: "none", outline: "none", fontSize: "13px", color: "#333", background: "transparent", width: "100%" }} />
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#faf7f4", borderBottom: "1px solid #ede8e3" }}>
              {["Staff Member", "Email", "Contact", "Role", "Joined", "Actions"].map((h) => (
                <th key={h} style={{ padding: "13px 18px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#a89080", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "60px", color: "#aaa" }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: "center", padding: "60px", color: "#aaa" }}>No staff found.</td></tr>
            ) : filtered.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #faf7f4" : "none" }}>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "14px", flexShrink: 0 }}>
                      {s.full_name?.[0]?.toUpperCase() || "S"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008" }}>{s.full_name}</div>
                      <div style={{ fontSize: "11px", color: "#a89080", textTransform: "capitalize" }}>{s.role}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 18px", fontSize: "13px", color: "#555" }}>{s.email}</td>
                <td style={{ padding: "14px 18px", fontSize: "13px", color: "#555" }}>{s.contact_number || "—"}</td>
                <td style={{ padding: "14px 18px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", background: s.role === "admin" ? "#fdf6f0" : s.role === "staff" ? "#ede9fe" : "#f0fdf4", color: s.role === "admin" ? ACCENT : s.role === "staff" ? "#6366f1" : "#22c55e", textTransform: "capitalize" }}>{s.role}</span>
                </td>
                <td style={{ padding: "14px 18px", fontSize: "12px", color: "#a89080" }}>{new Date(s.created_at).toLocaleDateString()}</td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setEditing(s); setForm({ full_name: s.full_name, email: s.email, contact_number: s.contact_number || "", password: "", confirm_password: "", role: s.role }); setError(""); setShowModal(true); }} style={{ background: "#f1ebe5", border: "none", borderRadius: "6px", padding: "7px 12px", fontSize: "12px", fontWeight: 600, color: "#555", cursor: "pointer" }}>Edit</button>
                    <button onClick={() => handleDelete(s.id)} style={{ background: "#fff0f0", border: "none", borderRadius: "6px", padding: "7px 12px", fontSize: "12px", fontWeight: 600, color: "#ef4444", cursor: "pointer" }}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "#fff", borderRadius: "16px", padding: "28px 32px", width: "440px", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 900, color: "#1a1008", margin: 0 }}>{editing ? "Edit Staff" : "Add New Staff"}</h2>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", fontSize: "20px" }}>✕</button>
            </div>

            {!editing && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px" }}>Role *</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["cashier", "staff"] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setNewRole(r)} style={{
                      flex: 1, padding: "10px", borderRadius: "8px", border: "1.5px solid",
                      borderColor: newRole === r ? ACCENT : "#e8ddd4",
                      background: newRole === r ? "#fdf6f0" : "#fff",
                      color: newRole === r ? ACCENT : "#555",
                      fontWeight: 700, fontSize: "13px", cursor: "pointer",
                    }}>
                      {r === "cashier" ? "🏪 Cashier (In-Store)" : "🛵 Staff (Online Orders)"}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "11px", color: "#a89080", marginTop: "6px" }}>
                  {newRole === "cashier" ? "Handles dine-in orders at the physical store." : "Handles pickup and delivery orders online."}
                </p>
              </div>
            )}

            {[
              { label: "Full Name", key: "full_name", type: "text", placeholder: "Full name" },
              { label: "Email", key: "email", type: "email", placeholder: "Email address", disabled: !!editing },
              { label: "Contact Number", key: "contact_number", type: "text", placeholder: "Contact number" },
            ].map(({ label, key, type, placeholder, disabled }) => (
              <div key={key} style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px" }}>{label}</label>
                <input type={type} placeholder={placeholder} disabled={disabled} value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  style={{ width: "100%", border: "1.5px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#333", outline: "none", boxSizing: "border-box", background: disabled ? "#f8f5f0" : "#fff" }} />
              </div>
            ))}

            {[
              { label: editing ? "New Password (leave blank to keep)" : "Password *", key: "password" as const, show: showPw, toggle: () => setShowPw((v) => !v) },
              { label: editing ? "Confirm New Password" : "Confirm Password *", key: "confirm_password" as const, show: showConfirm, toggle: () => setShowConfirm((v) => !v) },
            ].map(({ label, key, show, toggle }) => (
              <div key={key} style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px" }}>
                  <input type={show ? "text" : "password"} placeholder="••••••••" value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "13px", color: "#333", background: "transparent" }} />
                  <button type="button" onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#a89080" }}>
                    {show ? "🙈" : "👁️"}
                  </button>
                </div>
              </div>
            ))}

            {error && <p style={{ color: "#ef4444", fontSize: "12px", marginBottom: "12px" }}>{error}</p>}

            <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: "#f1ebe5", border: "none", borderRadius: "8px", padding: "12px", fontWeight: 700, fontSize: "13px", color: "#555", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: ACCENT, border: "none", borderRadius: "8px", padding: "12px", fontWeight: 800, fontSize: "13px", color: "#fff", cursor: "pointer" }}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Add Staff"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
