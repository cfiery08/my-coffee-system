"use client";

import { usePathname } from "next/navigation";
import Footer from "@/app/components/Footer";

export default function PublicFooter() {
  const pathname = usePathname();
  if (
    pathname === "/login" ||
    pathname === "/signup" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/staff") ||
    pathname.startsWith("/cashier") ||
    pathname.startsWith("/store-orders")
  ) return null;
  return <Footer />;
}
