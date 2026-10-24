"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCart, type CartItem } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";
import { normalizePhilippineMobile, sanitizePhoneInput } from "@/lib/phone";
import SystemIcon from "@/app/components/SystemIcon";

const AddressPickerModal = dynamic(() => import("./AddressPickerModal"), { ssr: false });

type Props = { open: boolean; onClose: () => void };
type OrderType = "delivery" | "pickup";
type PaymentMethod = "cash" | "gcash";

const DELIVERY_FEE = 50;
const ACCENT = "#b16b16";
const LAST_DELIVERY_ADDRESS_KEY = "brewora_last_delivery_address";

export default function CartDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const { items, remove, update, clear, total, count } = useCart();
  const { user } = useAuth();

  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cash");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [floor, setFloor] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [modificationOrder, setModificationOrder] = useState<{
    id?: string;
    items: CartItem[];
    subtotal: number;
    deliveryFee: number;
    total: number;
    contactNumber: string;
    orderType: OrderType;
    paymentMethod: PaymentMethod;
    notes: string;
    deliveryAddress: string | null;
  } | null>(null);
  const [modificationSeconds, setModificationSeconds] = useState(30);
  const [modifying, setModifying] = useState(false);
  const deliveryFee = orderType === "delivery" ? DELIVERY_FEE : 0;
  const grandTotal = total + deliveryFee;

  // Load contact number and seed saved address from profile
  useEffect(() => {
    if (!open) return;
    try {
      const stored = localStorage.getItem(LAST_DELIVERY_ADDRESS_KEY);
      if (stored) {
        const lastAddress = JSON.parse(stored) as { address?: string; floor?: string; instructions?: string };
        if (lastAddress.address) {
          setAddress(lastAddress.address);
          setFloor(lastAddress.floor || "");
          setDeliveryInstructions(lastAddress.instructions || "");
        }
      }
    } catch {
      localStorage.removeItem(LAST_DELIVERY_ADDRESS_KEY);
    }
    if (user) {
      supabase.from("user_accounts").select("contact_number").eq("id", user.id).single().then(({ data }) => {
        if (data?.contact_number) setContactNumber(data.contact_number);
      });
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) setError("");
  }, [open]);

  function closeCart() {
    if (modificationOrder) return;
    onClose();
  }

  function handlePlaceOrder() {
    if (!user) { setError("Please log in to place an order."); return; }
    if (items.length === 0) return;
    const normalizedContact = normalizePhilippineMobile(contactNumber);
    if (!normalizedContact) { setError("Enter a valid Philippine mobile number, such as 09XXXXXXXXX or +639XXXXXXXXX."); return; }
    setContactNumber(normalizedContact);
    if (orderType === "delivery" && !address.trim()) { setError("Please set a delivery address."); return; }
    setError("");
    void submitOrder(normalizedContact);
  }

  async function submitOrder(normalizedContact: string) {
    if (placing) return;
    if (!user) { setError("Please log in to place an order."); return; }
    if (items.length === 0) return;
    const orderedItems = items.map((item) => ({ ...item }));
    setError("");

    const deliveryDetails = [
      floor ? `Floor/Unit: ${floor}` : "",
      deliveryInstructions ? `Delivery instructions: ${deliveryInstructions}` : "",
    ].filter(Boolean).join("\n");
    const checkoutNotes = [
      deliveryDetails,
      notes.trim() ? `Order note: ${notes.trim()}` : "",
    ].filter(Boolean).join("\n\n");

    setModificationOrder({
      items: orderedItems,
      subtotal: total,
      deliveryFee,
      total: grandTotal,
      contactNumber: normalizedContact,
      orderType,
      paymentMethod,
      notes: checkoutNotes,
      deliveryAddress: orderType === "delivery" ? address : null,
    });
    setModificationSeconds(30);
  }

  async function continueToGcashCheckout(orderId: string) {
    if (modifying) return;
    setModifying(true);
    setError("");

    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    if (!accessToken) {
      setError("Your session expired. Please sign in again before paying.");
      setModifying(false);
      return;
    }

    try {
      const response = await fetch("/api/paymongo/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ orderId, checkoutAttemptId: crypto.randomUUID() }),
      });
      const checkout = await response.json();
      if (!response.ok || typeof checkout.checkoutUrl !== "string") {
        setError(checkout.error || "Could not start GCash checkout. Your order is still unpaid.");
        setModifying(false);
        return;
      }
      clear();
      setModificationOrder(null);
      window.location.assign(checkout.checkoutUrl);
    } catch {
      setError("Could not connect to PayMongo. Your order is still unpaid; please try again.");
      setModifying(false);
    }
  }

  async function modifyPlacedOrder() {
    if (!modificationOrder || modifying || modificationSeconds <= 0) return;
    if (modificationOrder.id) return;
    setError("");
    setModificationOrder(null);
    setModificationSeconds(30);
  }

  async function approvePlacedOrder() {
    if (!modificationOrder || placing || modifying || modificationSeconds <= 0) return;
    if (modificationOrder.id) {
      if (modificationOrder.paymentMethod === "gcash") void continueToGcashCheckout(modificationOrder.id);
      return;
    }

    if (!user) {
      setError("Please sign in again before confirming your order.");
      return;
    }

    setPlacing(true);
    setError("");
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        order_type: modificationOrder.orderType,
        status: "pending",
        payment_method: modificationOrder.paymentMethod,
        payment_status: "unpaid",
        subtotal: modificationOrder.subtotal,
        delivery_fee: modificationOrder.deliveryFee,
        total_amount: modificationOrder.total,
        contact_number: modificationOrder.contactNumber,
        notes: modificationOrder.notes,
        delivery_address_snapshot: modificationOrder.deliveryAddress,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      setError(orderError?.message || "Failed to save the confirmed order.");
      setPlacing(false);
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      modificationOrder.items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.id,
        menu_item_name: item.name,
        image_url: item.image_url ?? null,
        unit_price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
      }))
    );

    if (itemsError) {
      await supabase.from("orders").delete().eq("id", order.id);
      setError(itemsError.message || "Failed to save the confirmed order items.");
      setPlacing(false);
      return;
    }

    if (modificationOrder.paymentMethod === "gcash") {
      setModificationOrder({ ...modificationOrder, id: order.id });
      setPlacing(false);
      void continueToGcashCheckout(order.id);
      return;
    }

    clear();
    setModificationOrder(null);
    setPlacing(false);
    onClose();
    router.push("/orders");
  }

  useEffect(() => {
    if (!modificationOrder || modificationOrder.id || placing || modifying) return;
    if (modificationSeconds <= 0) {
      setModificationOrder(null);
      setError("The confirmation window expired. Your cart was kept and no order was saved. Press Place Order to try again.");
      return;
    }
    const timer = window.setTimeout(() => setModificationSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [modificationOrder, modificationSeconds, placing, modifying]);

  if (!open && !modificationOrder) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={closeCart} />
        <div className="relative bg-white w-full max-w-md flex flex-col shadow-2xl" style={{ zIndex: 51 }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e8df]">
            <div>
              <h2 className="font-bold text-[#21140b] text-lg">Your Cart {count > 0 && `(${count})`}</h2>
              <p className="text-xs text-[#7a5c44]">Review your items and checkout.</p>
            </div>
            <button onClick={closeCart} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {items.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-sm mb-4">Your cart is empty.</p>
                    <Link href="/menu" onClick={onClose} className="text-sm font-semibold hover:underline" style={{ color: ACCENT }}>
                      Browse menu &rarr;
                    </Link>
                  </div>
                ) : (
                  <>
                    {/* Cart items */}
                    <div className="space-y-3">
                      {items.map((item) => (
                        <div key={item.id} className="flex items-center gap-3 rounded-xl border border-[#f0e8df] p-2.5">
                          <div className="relative h-14 w-14 overflow-hidden rounded-lg flex-shrink-0" style={{ background: "#fdf3e3" }}>
                            <Image src={item.image_url ?? "/logo.png"} alt={item.name} fill className="object-cover" sizes="56px" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-[#21140b] truncate">{item.name}</p>
                            <p className="text-xs text-[#7a5c44]">&#8369;{item.price.toFixed(2)}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button onClick={() => update(item.id, item.quantity - 1)} className="w-6 h-6 rounded border border-[#e0d6cc] text-[#5a3e2b] flex items-center justify-center text-sm hover:border-[#b16b16] transition-colors">&minus;</button>
                              <span className="text-sm w-5 text-center font-medium">{item.quantity}</span>
                              <button onClick={() => update(item.id, item.quantity + 1)} className="w-6 h-6 rounded border border-[#e0d6cc] text-[#5a3e2b] flex items-center justify-center text-sm hover:border-[#b16b16] transition-colors">+</button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#21140b]">&#8369;{(item.price * item.quantity).toFixed(2)}</p>
                            <button onClick={() => remove(item.id)} className="text-xs text-red-400 hover:text-red-600 mt-1.5">Remove</button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Order Type */}
                    <section className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c44]">Order Type</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["delivery", "pickup"] as const).map((type) => (
                          <button
                            key={type}
                            onClick={() => setOrderType(type)}
                            className="py-2.5 rounded-lg text-xs font-semibold border transition-colors"
                            style={{
                              background: orderType === type ? ACCENT : "#fff",
                              borderColor: orderType === type ? ACCENT : "#e0d6cc",
                              color: orderType === type ? "#fff" : "#5a3e2b",
                            }}
                          >
                            {type === "delivery" ? "Delivery" : "Pick Up"}
                          </button>
                        ))}
                      </div>
                    </section>

                    {/* Contact Number */}
                    <section className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c44]">Contact Number</p>
                      <input
                        value={contactNumber}
                        onChange={(e) => setContactNumber(sanitizePhoneInput(e.target.value))}
                        type="tel"
                        inputMode="tel"
                        maxLength={13}
                        placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                        className="w-full border border-[#e0d6cc] rounded-lg px-3 py-2 text-sm text-[#21140b] focus:outline-none focus:border-[#b16b16]"
                      />
                    </section>

                    {/* Delivery Address */}
                    {orderType === "delivery" ? (
                      <section className="space-y-2">
                        <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c44]">Delivery Address</p>
                        <div
                          onClick={() => setShowAddressPicker(true)}
                          className="rounded-xl border cursor-pointer p-3 transition-colors"
                          style={{ borderColor: address ? ACCENT : "#e0d6cc", background: address ? "#fdf8f4" : "#fff" }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-[#7a5c44]">{address ? "Delivery to" : "Set address"}</span>
                            <span className="text-xs font-bold" style={{ color: ACCENT }}>{address ? "Change" : "Add"}</span>
                          </div>
                          {address
                            ? <p className="text-sm text-[#21140b] leading-snug">{address}</p>
                            : <p className="text-sm text-gray-400">Tap to set your delivery address on the map.</p>
                          }
                          {floor && <p className="text-xs text-[#7a5c44] mt-1">{floor}</p>}
                          {deliveryInstructions && <p className="text-xs text-[#7a5c44] mt-0.5">{deliveryInstructions}</p>}
                        </div>
                      </section>
                    ) : (
                      <section className="rounded-xl border border-[#e8ddd4] p-3" style={{ background: "#fdf8f4" }}>
                        <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: ACCENT }}>Pick Up At</p>
                        <p className="text-sm font-semibold text-[#21140b]">Brewora Coffee Shop</p>
                        <p className="text-xs text-[#7a5c44]">123 Coffee Lane, Brew City, Philippines</p>
                        <p className="text-xs text-[#aaa] mt-1">We&apos;ll notify you when your order is ready.</p>
                      </section>
                    )}

                    {/* Payment Method */}
                    <section className="space-y-2">
                      <p className="text-xs font-bold uppercase tracking-wide text-[#7a5c44]">Payment Method</p>
                      <div className="grid grid-cols-2 gap-2">
                        {(["cash", "gcash"] as const).map((method) => {
                          const selected = paymentMethod === method;
                          return <button key={method} type="button" onClick={() => setPaymentMethod(method)} aria-pressed={selected}
                            className="rounded-lg border px-3 py-3 text-left transition-colors"
                            style={{ borderColor: selected ? ACCENT : "#e0d6cc", background: selected ? "#fdf8f4" : "#fff", color: "#21140b" }}>
                            <span className="block text-sm font-bold">{method === "cash" ? "Cash" : "GCash"}</span>
                            <span className="mt-1 block text-[11px] leading-snug text-[#7a5c44]">{method === "cash" ? (orderType === "delivery" ? "Pay when delivered" : "Pay when you pick up") : "Pay securely with PayMongo"}</span>
                          </button>;
                        })}
                      </div>
                      {paymentMethod === "gcash" && <p className="text-[11px] leading-relaxed text-[#7a5c44]">You&apos;ll continue to PayMongo to complete your GCash payment. Your order is marked paid after PayMongo confirms it.</p>}
                    </section>

                    {/* Notes */}
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Order notes, sugar preference... (optional)"
                      rows={2}
                      className="w-full border border-[#e0d6cc] rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-[#b16b16] text-[#21140b] placeholder-gray-400"
                    />
                  </>
                )}
              </div>

              {/* Footer summary + place order */}
              {items.length > 0 && (
                <div className="border-t border-[#f0e8df] px-5 py-4 space-y-3 bg-white">
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between text-[#7a5c44]">
                      <span>Subtotal</span><span>&#8369;{total.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#7a5c44]">
                      <span>Delivery fee</span>
                      <span>{deliveryFee > 0 ? `\u20B1${deliveryFee.toFixed(2)}` : "Free"}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#f0e8df]">
                      <span className="font-bold text-[#21140b]">Total</span>
                      <span className="font-bold text-[#21140b]">&#8369;{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-500 text-center">{error}</p>}

                  {!user ? (
                    <p className="text-xs text-center" style={{ color: ACCENT }}>
                      Please <Link href="/login" className="underline font-medium">log in</Link> to place an order.
                    </p>
                  ) : (
                    <button
                      onClick={handlePlaceOrder}
                      disabled={placing}
                      className="w-full py-3 rounded-xl text-white text-sm font-bold tracking-wide hover:opacity-90 transition-opacity disabled:opacity-60"
                      style={{ background: ACCENT }}
                    >
                      {placing ? (paymentMethod === "gcash" ? "Opening PayMongo..." : "Placing order...") : paymentMethod === "gcash" ? "Continue to GCash" : "Place Order"}
                    </button>
                  )}
                </div>
              )}
          </>
        </div>
      </div>

      {modificationOrder && (
        <div style={{ position: "fixed", inset: 0, zIndex: 10000, background: "rgba(20,12,7,0.78)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <section role="dialog" aria-modal="true" aria-labelledby="modification-title" style={{ width: "100%", maxWidth: 440, maxHeight: "85vh", overflowY: "auto", background: "#21140b", border: "1px solid #3b2a1f", borderRadius: 18, padding: 24, boxShadow: "0 24px 70px rgba(0,0,0,.45)" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <div style={{ display: "flex", justifyContent: "center", marginBottom: 8 }}><SystemIcon name="coffee" size={38} /></div>
              <h2 id="modification-title" style={{ margin: "0 0 6px", color: "#fff", fontSize: 20, fontWeight: 900 }}>{modificationOrder.id ? "Your order is confirmed" : "Review your order"}</h2>
              <p style={{ margin: "0 0 12px", color: "#eadfd5", fontSize: 13, lineHeight: 1.5 }}>{modificationOrder.id ? "Your order is saved." : "You have 30 seconds to review. No order is saved until you confirm."} {modificationOrder.paymentMethod === "gcash" && !modificationOrder.id ? "Confirm to save the order and continue to GCash." : ""}</p>
              <p style={{ margin: 0, color: "#c5b3a2", fontSize: 13 }}>{modificationOrder.id ? "Continue to GCash to pay." : "If time runs out, your cart stays open and no order is saved. Refreshing also saves no order."}</p>
            </div>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 18 }}>
              <div style={{ width: 68, height: 68, borderRadius: "50%", background: `conic-gradient(${ACCENT} ${(modificationSeconds / 30) * 360}deg, #49382c 0deg)`, display: "grid", placeItems: "center" }}>
                <div style={{ width: 54, height: 54, borderRadius: "50%", background: "#21140b", display: "grid", placeItems: "center", color: modificationSeconds <= 10 ? "#fca5a5" : "#fff", fontSize: 20, fontWeight: 900 }}>{modificationSeconds}</div>
              </div>
            </div>
            <div style={{ background: "#170e08", border: "1px solid #3b2a1f", borderRadius: 12, padding: 14, marginBottom: 18 }}>
              <p style={{ margin: "0 0 10px", color: "#a89080", fontSize: 11, fontWeight: 800, letterSpacing: 1 }}>{modificationOrder.id ? `ORDER #${modificationOrder.id.slice(0, 8).toUpperCase()}` : "ORDER PREVIEW"}</p>
              {modificationOrder.items.map((item) => (
                <div key={item.id} style={{ display: "flex", justifyContent: "space-between", gap: 12, marginBottom: 7, color: "#ddd0c5", fontSize: 13 }}>
                  <span>{item.quantity} &times; {item.name}</span><span>&#8369;{(item.price * item.quantity).toFixed(2)}</span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #3b2a1f", paddingTop: 10, marginTop: 10, color: "#fff", fontSize: 14, fontWeight: 900 }}>
                <span>Total</span><span>&#8369;{modificationOrder.total.toFixed(2)}</span>
              </div>
            </div>
            {error && <p role="alert" style={{ color: "#fca5a5", fontSize: 12, textAlign: "center", margin: "0 0 12px" }}>{error}</p>}
            <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
              {!modificationOrder.id && <button type="button" disabled={placing || modifying || modificationSeconds <= 0} onClick={modifyPlacedOrder} style={{ flex: "0 1 150px", minWidth: 0, minHeight: 34, background: "transparent", border: "1px solid #554437", borderRadius: 8, padding: "6px 8px", color: "#ddd0c5", fontSize: 11, lineHeight: 1.2, fontWeight: 800, textAlign: "center", whiteSpace: "normal", cursor: placing || modifying || modificationSeconds <= 0 ? "wait" : "pointer", opacity: placing || modifying || modificationSeconds <= 0 ? 0.65 : 1 }}>
                Back to Cart
              </button>}
              <button type="button" disabled={placing || modifying || (!modificationOrder.id && modificationSeconds <= 0)} onClick={approvePlacedOrder} style={{ flex: "0 1 150px", minWidth: 0, minHeight: 34, background: ACCENT, border: 0, borderRadius: 8, padding: "6px 8px", color: "#fff", fontSize: 11, lineHeight: 1.2, fontWeight: 900, textAlign: "center", whiteSpace: "normal", cursor: placing || modifying ? "not-allowed" : "pointer", opacity: placing || modifying ? 0.65 : 1 }}>
                {placing ? "Saving order..." : modifying ? "Opening checkout..." : modificationOrder.id ? "Retry GCash Checkout" : modificationOrder.paymentMethod === "gcash" ? "Confirm & Pay" : "Confirm Order"}
              </button>
            </div>
          </section>
        </div>
      )}

      {showAddressPicker && (
        <AddressPickerModal
          currentAddress={address}
          onClose={() => setShowAddressPicker(false)}
          onSelect={(addr, _lat, _lng, floorVal, instructionsVal) => {
            setAddress(addr);
            setFloor(floorVal);
            setDeliveryInstructions(instructionsVal);
            localStorage.setItem(LAST_DELIVERY_ADDRESS_KEY, JSON.stringify({
              address: addr,
              floor: floorVal,
              instructions: instructionsVal,
            }));
          }}
        />
      )}
    </>
  );
}
