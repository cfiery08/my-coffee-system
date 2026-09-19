"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { useCart } from "@/lib/CartContext";
import { supabase } from "@/lib/supabaseClient";
import { useEffect, useState } from "react";
import CartDrawer from "./CartDrawer";

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, role } = useAuth();
  const { count } = useCart();
  const [cartOpen, setCartOpen] = useState(false);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/");
  }

  const links = [
    { label: "Home", href: "/" },
    { label: "Menu", href: "/menu" },
    ...(session ? [{ label: "My Orders", href: "/orders" }] : []),
    { label: "About us", href: "/about" },
    { label: "Contact us", href: "/contact" },
  ];

  useEffect(() => {
    function openCart() {
      setCartOpen(true);
    }

    window.addEventListener("openCart", openCart);
    return () => window.removeEventListener("openCart", openCart);
  }, []);

  return (
    <>
      <nav style={{ backgroundColor: "#1a1008" }} className="flex items-center justify-between px-8 py-3 sticky top-0 z-50">
        <Link href="/">
          <Image
            src="/brewora_logo.png"
            alt="Brewora Logo"
            width={150}
            height={54}
            className="h-auto w-[150px] object-contain"
          />
        </Link>

        <ul className="hidden md:flex items-center gap-8 text-sm font-medium text-white">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className={`transition-colors hover:text-amber-400 ${pathname === l.href ? "text-amber-400" : ""}`}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-4">
          {session ? (
            <>
              {/* Cart */}
              <button onClick={() => setCartOpen(true)} className="relative text-white hover:text-amber-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                {count > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 bg-amber-600 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </button>

              {/* Dashboard link for staff */}
              {(role === "admin" || role === "cashier") && (
                <Link href="/dashboard" className="text-white hover:text-amber-400 text-sm font-medium transition-colors">
                  Dashboard
                </Link>
              )}

              {/* Profile */}
              <Link href="/profile" className="text-white hover:text-amber-400 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.121 17.804A13.937 13.937 0 0112 16c2.5 0 4.847.655 6.879 1.804M15 10a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </Link>

              <button
                onClick={handleLogout}
                className="border border-white text-white text-sm font-medium px-5 py-1.5 rounded-full hover:bg-white hover:text-gray-900 transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <Link
              href={pathname === "/login" ? "/signup" : "/login"}
              className="border border-white text-white text-sm font-medium px-5 py-1.5 rounded-full hover:bg-white hover:text-gray-900 transition-colors w-24 text-center"
            >
              {pathname === "/login" ? "Sign Up" : "Log In"}
            </Link>
          )}
        </div>
      </nav>

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
    </>
  );
}
