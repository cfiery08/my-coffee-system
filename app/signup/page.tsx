"use client";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import Navbar from "@/app/components/Navbar";

function EyeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  );
}

export default function SignupPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({ fullName: "", contact: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        data: { full_name: form.fullName, contact_number: form.contact, password: form.password },
      },
    });
    setLoading(false);
    if (signUpError) {
      setError(signUpError.message);
    } else {
      setSuccess("Account created successfully! Redirecting to login...");
      setTimeout(() => router.push("/login"), 1500);
    }
  }

  return (
    <div className="min-h-screen flex flex-col font-sans">

      <Navbar />

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left — image panel */}
        <div className="relative w-1/2 flex-shrink-0 hidden md:block" style={{ backgroundColor: "#1a0f05" }}>
          <Image
            src="/loginpag.png"
            alt="Coffee background"
            fill
            className="object-cover object-left"
            priority
          />
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
            <h1 className="text-2xl font-bold text-gray-900 mb-1">Create your account</h1>
            <p className="text-gray-500 text-sm mb-6">Fill in the details to get started.</p>

            {error && <p className="text-red-500 text-sm mb-4">{error}</p>}
            {success && <p className="text-green-600 text-sm mb-4">{success}</p>}

            <form onSubmit={handleSignup}>

              {/* Full Name */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  name="fullName"
                  type="text"
                  placeholder="Enter your full name"
                  value={form.fullName}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Contact Number */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
                <input
                  name="contact"
                  type="tel"
                  placeholder="Enter your contact number"
                  value={form.contact}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Email */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                <input
                  name="email"
                  type="email"
                  placeholder="Enter your email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* Password */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={form.password}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-600 pr-10"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <input
                    name="confirm"
                    type={showConfirm ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={form.confirm}
                    onChange={handleChange}
                    required
                    className="w-full border border-gray-300 rounded px-3 py-2.5 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-amber-600 pr-10"
                  />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
              </div>

              {/* Sign Up button */}
              <button
                type="submit"
                disabled={loading || !!success}
                className="w-full py-3 rounded text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-60"
                style={{ backgroundColor: "#7c4a1e" }}
              >
                {success ? "Signed up" : loading ? "Signing up..." : "Sign Up"}
              </button>

              {/* Log in link */}
              <p className="text-center text-sm text-gray-500 mt-4">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold" style={{ color: "#7c4a1e" }}>
                  Log in
                </Link>
              </p>
            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
