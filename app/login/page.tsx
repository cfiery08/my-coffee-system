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
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) { setError(err.message); setLoading(false); return; }
    // Fetch role and redirect accordingly
    const { data: profile } = await supabase.from("user_accounts").select("role").eq("id", data.user.id).single();
    setLoading(false);
    const role = profile?.role ?? "customer";
    if (role === "admin") router.push("/admin");
    else if (role === "cashier") router.push("/cashier");
    else if (role === "staff") router.push("/staff");
    else router.push("/");
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">
      <Navbar />
      <div className="flex flex-1 overflow-hidden">
        {/* Left — image panel */}
        <div className="relative w-1/2 flex-shrink-0 hidden md:block" style={{ backgroundColor: "#1a0f05" }}>
          <Image src="/loginpag.png" alt="Coffee background" fill className="object-cover object-left" priority />
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Log in to your account</h1>
            <p className="text-gray-500 text-sm mb-6">Enter your details below to continue</p>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

            <form onSubmit={handleLogin}>
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
                <a href="#" className="text-sm font-medium" style={{ color: "#7c4a1e" }}>Forgot Password?</a>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: "#7c4a1e" }}
              >
                {loading ? "Logging in..." : "Log In"}
              </button>

              <p className="text-center text-sm text-gray-500 mt-4">
                Don&apos;t have an account?{" "}
                <Link href="/signup" className="font-semibold" style={{ color: "#7c4a1e" }}>Sign up</Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
