"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/app/components/Navbar";

export default function LoginPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [otp, setOtp] = useState("");
  const [forgotMode, setForgotMode] = useState(false);
  const [resetAwaitingOtp, setResetAwaitingOtp] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);
    if (!awaitingOtp) {
      try {
        const response = await fetch("/api/auth/login-otp", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim(), password }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Could not send a verification code.");
        setAwaitingOtp(true);
        setSuccess(`We sent a sign-in verification code to ${email.trim()}.`);
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : "Could not send a verification code.");
      }
      setLoading(false);
      return;
    }

    const { data, error: err } = await supabase.auth.verifyOtp({ email: email.trim(), token: otp.trim(), type: "email" });
    if (err || !data.user) {
      setError(err?.message || "Could not verify the code. Please try again.");
      setLoading(false);
      return;
    }
    // Fetch the profile role before choosing the destination. A failed/missing
    // profile must not silently send an admin to the customer home page.
    const { data: profile, error: profileError } = await supabase
      .from("user_accounts")
      .select("role, is_active")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profileError || !profile?.role) {
      await supabase.auth.signOut();
      setError("We couldn't load your account role. Please check that your account profile exists and try again.");
      setLoading(false);
      return;
    }
    if (profile.is_active === false) {
      await supabase.auth.signOut();
      setError("This account is inactive. Please contact an administrator.");
      setLoading(false);
      return;
    }
    const role = profile.role.trim().toLowerCase();
    setSuccess("You’re signed in successfully. Taking you to your account…");
    const destination = role === "admin" ? "/admin" : role === "cashier" ? "/cashier/pos" : role === "barista" ? "/store-orders" : role === "staff" ? "/staff" : "/";
    router.replace(destination);
    setLoading(false);
  }

  async function resendLoginCode() {
    setError("");
    setSuccess("");
    setLoading(true);
    try {
      const response = await fetch("/api/auth/login-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Could not resend the verification code.");
      setSuccess("A new sign-in verification code has been sent.");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Could not resend the verification code.");
    }
    setLoading(false);
  }

  async function requestPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (resetPassword !== confirmResetPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (resetPassword.length < 6) {
      setError("Your new password must be at least 6 characters.");
      return;
    }
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setResetAwaitingOtp(true);
    setSuccess(`We sent a password reset code to ${email.trim()}.`);
  }

  async function verifyPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (resetPassword !== confirmResetPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: verifyError } = await supabase.auth.verifyOtp({ email: email.trim(), token: resetOtp.trim(), type: "recovery" });
    if (verifyError) {
      setError(verifyError.message);
      setLoading(false);
      return;
    }
    const { error: updateError } = await supabase.auth.updateUser({ password: resetPassword });
    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }
    await supabase.auth.signOut();
    setForgotMode(false);
    setResetAwaitingOtp(false);
    setResetOtp("");
    setResetPassword("");
    setConfirmResetPassword("");
    setPassword("");
    setSuccess("Your password was reset. Log in with your new password.");
    setLoading(false);
  }

  async function resendResetCode() {
    setError("");
    setSuccess("");
    setLoading(true);
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim());
    setLoading(false);
    if (resetError) setError(resetError.message);
    else setSuccess("A new password reset code has been sent.");
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar keepGuestView={loading} />
      <div className="flex flex-1 overflow-hidden">
        {/* Left — image panel */}
        <div className="relative w-1/2 flex-shrink-0 hidden md:block" style={{ backgroundColor: "#1a0f05" }}>
          <Image src="/loginpagefinal.png" alt="Coffee background" fill className="object-cover object-left" priority />
          <div className="absolute inset-0 bg-black/50" />
          <div className="absolute inset-0 flex flex-col items-center justify-start text-center px-10 pt-10">
            <Image src="/logo.png" alt="Logo" width={100} height={100} className="rounded-full object-cover mb-1" />
            <Image src="/breworatext.png" alt="Brewora" width={200} height={60} className="object-contain mb-4" style={{ marginLeft: "18px" }} />
            <h2 className="text-white font-bold text-3xl uppercase tracking-widest mb-3" style={{ fontFamily: "Georgia, serif" }}>
              Welcome Back!
            </h2>
            <p className="text-white/80 text-sm leading-relaxed">
              Good coffee. Good days. Let&apos;s keep<br />the good moments brewing
            </p>
          </div>
        </div>

        {/* Right — form panel */}
        <div className="w-full md:w-1/2 flex items-center justify-center bg-white px-10 py-10 overflow-y-auto">
          <div className="w-full max-w-sm">
            <h1 className="text-2xl font-bold text-gray-900 mb-1">{forgotMode ? (resetAwaitingOtp ? "Verify password reset" : "Reset your password") : awaitingOtp ? "Verify your sign in" : "Log in to your account"}</h1>
            <p className="text-gray-500 text-sm mb-6">{forgotMode ? (resetAwaitingOtp ? `Enter the code sent to ${email.trim()}.` : "Choose a new password, then verify your email.") : awaitingOtp ? `Enter the verification code sent to ${email.trim()}.` : "Enter your details below to continue"}</p>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            {success && <p role="status" className="text-green-700 text-sm mb-4 rounded bg-green-50 px-3 py-2">{success}</p>}

            {forgotMode ? (resetAwaitingOtp ? (
              <form onSubmit={verifyPasswordReset}>
                <div className="mb-4">
                  <label htmlFor="reset-otp" className="mb-1 block text-sm font-medium text-gray-700">Email verification code</label>
                  <input id="reset-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={resetOtp} onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, ""))} placeholder="Enter the code from your email" required className="w-full rounded border border-gray-300 px-3 py-2.5 text-sm tracking-widest text-gray-700 focus:border-amber-600 focus:outline-none" />
                </div>
                <p className="mb-4 text-xs text-gray-500">Your new password will be saved after the code is verified.</p>
                <button type="submit" disabled={loading} className="w-full rounded py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#7c4a1e" }}>{loading ? "Verifying..." : "Verify code and reset password"}</button>
                <button type="button" onClick={resendResetCode} disabled={loading} className="mt-3 w-full py-2 text-sm font-semibold disabled:opacity-60" style={{ color: "#7c4a1e" }}>Resend code</button>
                <button type="button" onClick={() => { setResetAwaitingOtp(false); setResetOtp(""); setError(""); setSuccess(""); }} className="w-full py-2 text-sm text-gray-500">Back to password</button>
              </form>
            ) : (
              <form onSubmit={requestPasswordReset}>
                <div className="mb-4">
                  <label htmlFor="reset-email" className="mb-1 block text-sm font-medium text-gray-700">Email address</label>
                  <input id="reset-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Enter your account email" required className="w-full rounded border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-amber-600 focus:outline-none" />
                </div>
                <div className="mb-4">
                  <label htmlFor="new-password" className="mb-1 block text-sm font-medium text-gray-700">New password</label>
                  <input id="new-password" type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} autoComplete="new-password" minLength={6} required className="w-full rounded border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-amber-600 focus:outline-none" />
                </div>
                <div className="mb-6">
                  <label htmlFor="confirm-new-password" className="mb-1 block text-sm font-medium text-gray-700">Confirm new password</label>
                  <input id="confirm-new-password" type="password" value={confirmResetPassword} onChange={(e) => setConfirmResetPassword(e.target.value)} autoComplete="new-password" minLength={6} required className="w-full rounded border border-gray-300 px-3 py-2.5 text-sm text-gray-700 focus:border-amber-600 focus:outline-none" />
                </div>
                <button type="submit" disabled={loading} className="w-full rounded py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#7c4a1e" }}>{loading ? "Sending code..." : "Send verification code"}</button>
                <button type="button" onClick={() => { setForgotMode(false); setError(""); setSuccess(""); }} className="mt-3 w-full py-2 text-sm text-gray-500">Back to log in</button>
              </form>
            )) : awaitingOtp ? (
              <form onSubmit={handleLogin}>
                <div className="mb-4">
                  <label htmlFor="login-otp" className="mb-1 block text-sm font-medium text-gray-700">Email verification code</label>
                  <input id="login-otp" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))} placeholder="Enter the code from your email" required className="w-full rounded border border-gray-300 px-3 py-2.5 text-sm tracking-widest text-gray-700 focus:border-amber-600 focus:outline-none" />
                </div>
                <button type="submit" disabled={loading} className="w-full rounded py-3 text-sm font-semibold text-white disabled:opacity-60" style={{ backgroundColor: "#7c4a1e" }}>{loading ? "Verifying..." : "Verify code and log in"}</button>
                <button type="button" onClick={resendLoginCode} disabled={loading} className="mt-3 w-full py-2 text-sm font-semibold disabled:opacity-60" style={{ color: "#7c4a1e" }}>Resend code</button>
                <button type="button" onClick={() => { setAwaitingOtp(false); setOtp(""); setError(""); setSuccess(""); }} className="w-full py-2 text-sm text-gray-500">Back to log in</button>
              </form>
            ) : <form onSubmit={handleLogin}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email"
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-600"
                />
              </div>

              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-600 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex justify-end mb-6">
                <button type="button" onClick={() => { setForgotMode(true); setError(""); setSuccess(""); }} className="text-sm font-medium" style={{ color: "#7c4a1e" }}>Forgot Password?</button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: "#7c4a1e" }}
              >
                {loading ? "Checking account..." : "Continue with email code"}
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-semibold" style={{ color: "#7c4a1e" }}>Sign up</Link>
              </p>
            </form>}
          </div>
        </div>
      </div>
    </div>
  );
}
