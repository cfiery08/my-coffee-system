"use client";
import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import { normalizePhilippineMobile, sanitizePhoneInput } from "@/lib/phone";
import SystemIcon from "@/app/components/SystemIcon";

const ACCENT = "#7c4a1e";
type Staff = { id: string; full_name: string; email: string; contact_number: string; created_at: string; role: string; is_active: boolean };
const EMPTY_FORM = { full_name: "", email: "", contact_number: "", password: "", confirm_password: "", role: "cashier" };
const staffRpcError = (error: { code?: string; message: string }) =>
  error.code === "PGRST202"
    ? "The staff setup SQL has not been run in this Supabase project. Run the updated supabase_store_orders_and_staff_roles.sql in SQL Editor, then retry."
    : error.message;
// Keep staff OTP verification isolated so verifying a new account never signs
// the administrator out of their own session.
const staffVerificationClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false } },
);

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [awaitingCode, setAwaitingCode] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [updatingStaffId, setUpdatingStaffId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [newRole, setNewRole] = useState<"cashier" | "barista" | "staff">("cashier");

  async function load() {
    const { data, error: queryError } = await supabase.rpc("admin_list_staff");
    if (queryError) {
      setLoadError(queryError.message);
      setStaff([]);
    } else {
      setLoadError("");
      setStaff((data ?? []) as Staff[]);
    }
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
    if (!form.full_name.trim() || !form.email.trim() || !form.contact_number.trim()) return setError("Full name, contact number, and email are required.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return setError("Enter a valid email address.");
    const contactNumber = normalizePhilippineMobile(form.contact_number);
    if (!contactNumber) return setError("Enter a valid Philippine mobile number, such as 09XXXXXXXXX or +639XXXXXXXXX.");
    setSaving(true); setError("");

    if (editing) {
      const { error: err } = await supabase.from("user_accounts").update({ full_name: form.full_name, contact_number: contactNumber, role: newRole }).eq("id", editing.id);
      if (err) { setError(err.message); setSaving(false); return; }
      setSaving(false); setShowModal(false); setSuccess("Staff details updated successfully."); load();
    } else {
      const email = form.email.trim().toLowerCase();
      if (!form.password) {
        const { error: assignError } = await supabase.rpc("admin_assign_staff_by_email", {
          p_email: email,
          p_role: newRole,
          p_full_name: form.full_name.trim(),
          p_contact_number: contactNumber,
        });
        if (assignError) {
          setError(`${staffRpcError(assignError)} To create a new account, enter a password below.`);
          setSaving(false);
          return;
        }
        setShowModal(false);
        setForm(EMPTY_FORM);
        setSuccess("Existing verified account added to staff successfully.");
        await load();
        setSaving(false);
        return;
      }
      if (form.password !== form.confirm_password) { setError("Passwords do not match."); setSaving(false); return; }
      if (form.password.length < 6) { setError("Password must be at least 6 characters."); setSaving(false); return; }
      const { data: signUpData, error: authErr } = await staffVerificationClient.auth.signUp({
        email,
        password: form.password,
        options: { data: { full_name: form.full_name.trim(), contact_number: contactNumber, password: form.password } },
      });
      if (authErr) {
        if (/already registered|already exists/i.test(authErr.message)) {
          const { error: assignError } = await supabase.rpc("admin_assign_staff_by_email", {
            p_email: email,
            p_role: newRole,
            p_full_name: form.full_name.trim(),
            p_contact_number: contactNumber,
          });
          if (assignError) setError(`This email already has an account, but staff setup could not finish: ${staffRpcError(assignError)}`);
          else {
            setSuccess("Existing verified account added to staff successfully.");
            setShowModal(false);
            setForm(EMPTY_FORM);
            await load();
          }
          setSaving(false);
          return;
        }
        setError(authErr.message); setSaving(false); return;
      }
      if (!signUpData.user || signUpData.user.identities?.length === 0) {
        const { error: assignError } = await supabase.rpc("admin_assign_staff_by_email", {
          p_email: email,
          p_role: newRole,
          p_full_name: form.full_name.trim(),
          p_contact_number: contactNumber,
        });
        if (assignError) {
          setError(`This email already has an account, but staff setup could not finish: ${staffRpcError(assignError)}`);
        } else {
          setSuccess("Existing verified account added to staff successfully.");
          setShowModal(false);
          setForm(EMPTY_FORM);
          await load();
        }
        setSaving(false);
        return;
      }
      if (signUpData.session) {
        // With email confirmations disabled, Supabase creates a session right
        // away. Promote the newly created profile now instead of leaving it as
        // a customer row that never appears in Manage Staff.
        const { error: roleError } = await supabase.rpc("admin_assign_staff_role", {
          p_staff_id: signUpData.user.id,
          p_role: newRole,
          p_full_name: form.full_name.trim(),
          p_contact_number: contactNumber,
        });
        if (roleError) {
          setError(`The account was created, but could not be added to staff: ${staffRpcError(roleError)}`);
          setSaving(false);
          return;
        }
        setShowModal(false);
        setForm(EMPTY_FORM);
        setSuccess("Staff account created successfully.");
        await load();
        setSaving(false);
        return;
      }
      setPendingEmail(email);
      setAwaitingCode(true);
      setSuccess(`A verification code was sent to ${email}. The staff role will be assigned after the code is confirmed.`);
      setSaving(false);
    }
  }

  async function handleVerifyStaff(e: React.FormEvent) {
    e.preventDefault();
    const contactNumber = normalizePhilippineMobile(form.contact_number);
    if (!contactNumber) {
      setError("Enter a valid Philippine mobile number, such as 09XXXXXXXXX or +639XXXXXXXXX.");
      return;
    }
    setSaving(true); setError(""); setSuccess("");
    const { data, error: verifyError } = await staffVerificationClient.auth.verifyOtp({
      email: pendingEmail, token: verificationCode.trim(), type: "signup",
    });
    if (verifyError || !data.user) {
      setError(verifyError?.message || "Could not verify this email. Check the code and try again.");
      setSaving(false);
      return;
    }
    // Only promote the Auth-triggered customer profile after email ownership
    // is proven. The RPC checks the admin role and verified email server-side.
    const { error: roleError } = await supabase.rpc("admin_assign_staff_role", {
      p_staff_id: data.user.id,
      p_role: newRole,
      p_full_name: form.full_name.trim(),
      p_contact_number: contactNumber,
    });
    if (roleError) {
      setError(`Email verified, but the staff role could not be assigned: ${staffRpcError(roleError)}`);
      setSaving(false);
      return;
    }
    setSaving(false);
    setSuccess("Email verified. The staff account was created successfully.");
    load();
    window.setTimeout(() => {
      setShowModal(false); setAwaitingCode(false); setVerificationCode(""); setForm(EMPTY_FORM); setSuccess("");
    }, 1400);
  }

  async function handleResendStaffCode() {
    setSaving(true); setError(""); setSuccess("");
    const { error: resendError } = await staffVerificationClient.auth.resend({ email: pendingEmail, type: "signup" });
    if (resendError) setError(resendError.message);
    else setSuccess(`A new verification code was sent to ${pendingEmail}.`);
    setSaving(false);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this staff account?")) return;
    await supabase.from("user_accounts").delete().eq("id", id);
    load();
  }

  async function toggleStaffActive(member: Staff) {
    const nextActive = !member.is_active;
    const action = nextActive ? "activate" : "deactivate";
    if (!confirm(`Are you sure you want to ${action} ${member.full_name || member.email}?`)) return;
    setUpdatingStaffId(member.id);
    setLoadError("");
    const { error: updateError } = await supabase.rpc("admin_set_staff_active", {
      p_staff_id: member.id,
      p_is_active: nextActive,
    });
    if (updateError) setLoadError(updateError.message);
    else await load();
    setUpdatingStaffId(null);
  }

  const filtered = staff.filter((s) => s.role === newRole &&
    (search === "" || `${s.full_name} ${s.email}`.toLowerCase().includes(search.toLowerCase()))
  );
  const roleLabel = (role: string) => role === "staff" ? "Online Staff" : role === "barista" ? "Barista" : "Cashier Staff";

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <div>
          <h1 style={{ fontSize: "20px", fontWeight: 900, color: "#1a1008", margin: 0 }}>Manage Staff</h1>
          <p style={{ color: "#a89080", fontSize: "13px", marginTop: "2px" }}>{staff.length} staff member{staff.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => { if (!awaitingCode) { setEditing(null); setForm(EMPTY_FORM); setError(""); setSuccess(""); } setShowModal(true); }} style={{ background: ACCENT, color: "#fff", border: "none", borderRadius: "8px", padding: "10px 20px", fontWeight: 800, fontSize: "13px", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Add Staff
        </button>
      </div>

      {success && !showModal && <p role="status" style={{ color: "#16803c", background: "#ecfdf3", borderRadius: "8px", padding: "10px 12px", margin: "0 0 16px", fontSize: "13px" }}>{success}</p>}

      {loadError && (
        <div role="alert" style={{ background: "#fff0f0", color: "#b42318", border: "1px solid #f3c7c7", borderRadius: "8px", padding: "12px 14px", marginBottom: "16px", fontSize: "13px" }}>
          Could not load staff: {loadError}. Confirm the admin staff visibility SQL has been run in this Supabase project.
        </div>
      )}

      {/* Search */}
      <div style={{ display: "flex", alignItems: "center", gap: "10px", background: "#fff", borderRadius: "8px", padding: "10px 14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", marginBottom: "20px", maxWidth: "360px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#a89080" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search staff..." style={{ border: "none", outline: "none", fontSize: "13px", color: "#333", background: "transparent", width: "100%" }} />
      </div>

      <div role="tablist" aria-label="Staff roles" style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 14 }}>
        {(["cashier", "barista", "staff"] as const).map((role) => (
          <button key={role} role="tab" aria-selected={newRole === role} onClick={() => setNewRole(role)} style={{ background: newRole === role ? ACCENT : "#fff", color: newRole === role ? "#fff" : "#5a3e2b", border: "1px solid #e8ddd4", borderRadius: 8, padding: "8px 14px", fontSize: 12, fontWeight: 800, cursor: "pointer", whiteSpace: "nowrap" }}>
            {roleLabel(role)} ({staff.filter((member) => member.role === role).length})
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: "14px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#faf7f4", borderBottom: "1px solid #ede8e3" }}>
              {["Staff Member", "Email", "Contact", "Role", "Status", "Joined", "Actions"].map((h) => (
                <th key={h} style={{ padding: "13px 18px", textAlign: "left", fontSize: "11px", fontWeight: 700, color: "#a89080", textTransform: "uppercase", letterSpacing: "0.5px" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "60px", color: "#aaa" }}>Loading...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: "center", padding: "60px", color: "#aaa" }}>No staff found.</td></tr>
            ) : filtered.map((s, i) => (
              <tr key={s.id} style={{ borderBottom: i < filtered.length - 1 ? "1px solid #faf7f4" : "none" }}>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "38px", height: "38px", borderRadius: "50%", background: ACCENT, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800, fontSize: "14px", flexShrink: 0 }}>
                      {s.full_name?.[0]?.toUpperCase() || "S"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "13px", color: "#1a1008" }}>{s.full_name}</div>
                      <div style={{ fontSize: "11px", color: "#a89080", textTransform: "capitalize" }}>{roleLabel(s.role)}</div>
                    </div>
                  </div>
                </td>
                <td style={{ padding: "14px 18px", fontSize: "13px", color: "#555" }}>{s.email}</td>
                <td style={{ padding: "14px 18px", fontSize: "13px", color: "#555" }}>{s.contact_number || "—"}</td>
                <td style={{ padding: "14px 18px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", background: s.role === "staff" ? "#ede9fe" : s.role === "barista" ? "#fff7ed" : "#f0fdf4", color: s.role === "staff" ? "#6366f1" : s.role === "barista" ? "#c2410c" : "#16803c" }}>{roleLabel(s.role)}</span>
                </td>
                <td style={{ padding: "14px 18px" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, padding: "4px 10px", borderRadius: "20px", background: s.is_active ? "#ecfdf3" : "#fff0f0", color: s.is_active ? "#16803c" : "#b42318" }}>
                    {s.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td style={{ padding: "14px 18px", fontSize: "12px", color: "#a89080" }}>{new Date(s.created_at).toLocaleDateString()}</td>
                <td style={{ padding: "14px 18px" }}>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button onClick={() => { setEditing(s); setNewRole(s.role as "cashier" | "barista" | "staff"); setForm({ full_name: s.full_name, email: s.email, contact_number: s.contact_number || "", password: "", confirm_password: "", role: s.role }); setError(""); setShowModal(true); }} style={{ background: "#f1ebe5", border: "none", borderRadius: "6px", padding: "7px 12px", fontSize: "12px", fontWeight: 600, color: "#555", cursor: "pointer" }}>Edit</button>
                    <button onClick={() => toggleStaffActive(s)} disabled={updatingStaffId === s.id} style={{ background: s.is_active ? "#fff7ed" : "#ecfdf3", border: "none", borderRadius: "6px", padding: "7px 12px", fontSize: "12px", fontWeight: 600, color: s.is_active ? "#c2410c" : "#16803c", cursor: updatingStaffId === s.id ? "wait" : "pointer", opacity: updatingStaffId === s.id ? 0.65 : 1 }}>
                      {updatingStaffId === s.id ? "Updating..." : s.is_active ? "Deactivate" : "Activate"}
                    </button>
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
          <div style={{ background: "#fff", borderRadius: "16px", padding: "28px 32px", width: "min(440px, calc(100vw - 32px))", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "22px" }}>
              <h2 style={{ fontSize: "17px", fontWeight: 900, color: "#1a1008", margin: 0 }}>{editing ? "Edit Staff" : awaitingCode ? "Verify Staff Email" : "Add New Staff"}</h2>
              <button onClick={() => setShowModal(false)} aria-label="Close staff form" style={{ background: "none", border: "none", cursor: "pointer", color: "#a89080", display: "flex" }}><SystemIcon name="x" size={20} /></button>
            </div>

            {!awaitingCode && <>
            {!awaitingCode && (
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px" }}>Role *</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  {(["cashier", "barista", "staff"] as const).map((r) => (
                    <button key={r} type="button" onClick={() => setNewRole(r)} style={{
                      flex: 1, padding: "10px", borderRadius: "8px", border: "1.5px solid",
                      borderColor: newRole === r ? ACCENT : "#e8ddd4",
                      background: newRole === r ? "#fdf6f0" : "#fff",
                      color: newRole === r ? ACCENT : "#555",
                      fontWeight: 700, fontSize: "13px", cursor: "pointer",
                    }}>
                      {roleLabel(r)}
                    </button>
                  ))}
                </div>
                <p style={{ fontSize: "11px", color: "#a89080", marginTop: "6px" }}>
                  {newRole === "cashier" ? "Creates in-store orders and records payments." : newRole === "barista" ? "Updates preparation and service status for store orders." : "Handles customer pickup and delivery orders online."}
                </p>
              </div>
            )}

            {[
              { label: "Full Name", key: "full_name", type: "text", placeholder: "Enter your full name" },
              { label: "Contact Number", key: "contact_number", type: "tel", placeholder: "09XXXXXXXXX or +639XXXXXXXXX" },
              { label: "Email address", key: "email", type: "email", placeholder: "Enter your email", disabled: !!editing },
            ].map(({ label, key, type, placeholder, disabled }) => (
              <div key={key} style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px" }}>{label}</label>
                <input type={type} inputMode={key === "contact_number" ? "tel" : undefined} maxLength={key === "contact_number" ? 13 : undefined} placeholder={placeholder} disabled={disabled} required value={form[key as keyof typeof form]} onChange={(e) => setForm({ ...form, [key]: key === "contact_number" ? sanitizePhoneInput(e.target.value) : e.target.value })}
                  style={{ width: "100%", border: "1.5px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px", fontSize: "13px", color: "#333", outline: "none", boxSizing: "border-box", background: disabled ? "#f8f5f0" : "#fff" }} />
              </div>
            ))}

            {!editing && [
              { label: "Password", key: "password" as const, show: showPw, toggle: () => setShowPw((v) => !v) },
              { label: "Confirm Password", key: "confirm_password" as const, show: showConfirm, toggle: () => setShowConfirm((v) => !v) },
            ].map(({ label, key, show, toggle }) => (
              <div key={key} style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px" }}>{label}</label>
                <div style={{ display: "flex", alignItems: "center", border: "1.5px solid #e8ddd4", borderRadius: "8px", padding: "10px 12px" }}>
                  <input type={show ? "text" : "password"} placeholder={key === "password" ? "Only needed for a new account" : "Repeat the new account password"} minLength={key === "password" && form.password ? 6 : undefined} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    style={{ flex: 1, border: "none", outline: "none", fontSize: "13px", color: "#333", background: "transparent" }} />
                  <button type="button" onClick={toggle} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "#a89080" }}>
                    <SystemIcon name={show ? "eyeOff" : "eye"} size={17} />
                  </button>
                </div>
              </div>
            ))}
            {!editing && <p style={{ margin: "-8px 0 14px", color: "#8a7665", fontSize: "11px" }}>Leave both password fields blank to add an existing verified account. New accounts need a password.</p>}
            </>}

            {awaitingCode && (
              <form onSubmit={handleVerifyStaff}>
                <p style={{ margin: "0 0 14px", fontSize: "13px", lineHeight: 1.5, color: "#6b5a4b" }}>
                  Enter the one-time code sent to <strong>{pendingEmail}</strong>. This account will become {newRole} only after verification.
                </p>
                <label htmlFor="staff-email-otp" style={{ display: "block", fontSize: "12px", fontWeight: 700, color: "#555", marginBottom: "6px" }}>Email verification code</label>
                <input id="staff-email-otp" type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={8} required value={verificationCode} onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ""))} placeholder="Enter code from email" style={{ width: "100%", border: "1.5px solid #e8ddd4", borderRadius: "8px", padding: "12px", fontSize: "16px", letterSpacing: "4px", boxSizing: "border-box" }} />
                <button type="button" onClick={handleResendStaffCode} disabled={saving} style={{ display: "block", margin: "8px auto 0", background: "none", border: "none", color: ACCENT, fontWeight: 700, cursor: "pointer" }}>Resend verification code</button>
                <div style={{ display: "flex", gap: "10px", marginTop: "18px" }}>
                  <button type="button" onClick={() => { setAwaitingCode(false); setVerificationCode(""); setError(""); setSuccess(""); }} style={{ flex: 1, background: "#f1ebe5", border: "none", borderRadius: "8px", padding: "12px", fontWeight: 700, fontSize: "13px", color: "#555", cursor: "pointer" }}>Back</button>
                  <button type="submit" disabled={saving} style={{ flex: 1, background: ACCENT, border: "none", borderRadius: "8px", padding: "12px", fontWeight: 800, fontSize: "13px", color: "#fff", cursor: "pointer" }}>{saving ? "Verifying..." : "Verify & Create Staff"}</button>
                </div>
              </form>
            )}

            {error && <p role="alert" style={{ color: "#b42318", background: "#fff0f0", borderRadius: "7px", padding: "9px 10px", fontSize: "12px", marginBottom: "12px" }}>{error}</p>}
            {success && <p role="status" style={{ color: "#16803c", background: "#ecfdf3", borderRadius: "7px", padding: "9px 10px", fontSize: "12px", marginBottom: "12px" }}>{success}</p>}

            {!awaitingCode && <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, background: "#f1ebe5", border: "none", borderRadius: "8px", padding: "12px", fontWeight: 700, fontSize: "13px", color: "#555", cursor: "pointer" }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} style={{ flex: 1, background: ACCENT, border: "none", borderRadius: "8px", padding: "12px", fontWeight: 800, fontSize: "13px", color: "#fff", cursor: "pointer" }}>
                {saving ? "Saving..." : editing ? "Save Changes" : "Continue"}
              </button>
            </div>}
          </div>
        </div>
      )}
    </div>
  );
}
