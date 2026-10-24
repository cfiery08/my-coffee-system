"use client";

import Image from "next/image";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

export default function Footer() {
  const { session, loading } = useAuth();
  const footerLinks = [
    { href: "/", label: "Home" },
    { href: "/menu", label: "Our Menu" },
    { href: "/about", label: "About Brewora" },
    { href: "/contact", label: "Contact Us" },
    ...(!loading && session
      ? [{ href: "/orders", label: "My Orders" }, { href: "/profile", label: "My Account" }]
      : !loading
        ? [{ href: "/login", label: "Log In" }, { href: "/signup", label: "Create an Account" }]
        : []),
  ];

  return (
    <footer className="mt-auto bg-[#1a1008] text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-5 px-5 py-6 sm:px-8 md:grid-cols-[1.5fr_1fr_1fr] md:gap-10 md:py-8">
        <div className="col-span-2 md:col-span-1">
          <Link href="/" aria-label="Brewora Coffee Shop home" className="inline-flex rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#d6a45f]">
            <Image
              src="/brewora_logo.png"
              alt="Brewora Coffee Shop"
              width={160}
              height={52}
              style={{ width: 160, height: 52, objectFit: "contain" }}
            />
          </Link>
          <p className="mt-2 max-w-sm text-sm leading-5 text-white/65">
            Handcrafted coffee made with premium beans and care in every cup.
          </p>
        </div>

        <nav aria-label="Footer navigation">
          <h2 className="mb-2 text-sm font-bold text-white">Explore</h2>
          <ul className="grid grid-cols-2 gap-x-5 gap-y-2 text-sm md:grid-cols-1">
            {footerLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className="text-white/65 transition-colors hover:text-[#e4b86c] focus-visible:text-[#e4b86c] focus-visible:outline-none">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div>
          <h2 className="mb-2 text-sm font-bold text-white">Here to help</h2>
          <p className="max-w-xs text-sm leading-5 text-white/65">
            Need help with the menu or an order? Get in touch with the Brewora team.
          </p>
          <Link href="/contact" className="mt-3 inline-flex text-sm font-semibold text-[#e4b86c] transition-colors hover:text-white focus-visible:outline-none focus-visible:underline">
            Contact us <span aria-hidden="true" className="ml-1">→</span>
          </Link>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col gap-1 px-5 py-3 text-xs text-white/50 sm:px-8 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Brewora Coffee Shop</span>
          <span>Good coffee. Good days.</span>
        </div>
      </div>
    </footer>
  );
}
