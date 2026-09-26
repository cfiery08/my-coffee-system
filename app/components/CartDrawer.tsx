"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { useCart } from "@/lib/CartContext";
import { useAuth } from "@/lib/AuthContext";
import { supabase } from "@/lib/supabaseClient";

const AddressPickerModal = dynamic(() => import("./AddressPickerModal"), { ssr: false });

type Props = { open: boolean; onClose: () => void };
type OrderType = "delivery" | "pickup";

const DELIVERY_FEE = 50;
const ACCENT = "#b16b16";

export default function CartDrawer({ open, onClose }: Props) {
  const router = useRouter();
  const { items, remove, update, clear, total, count } = useCart();
  const { user } = useAuth();

  const [orderType, setOrderType] = useState<OrderType>("delivery");
  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [addressLat, setAddressLat] = useState<number | null>(null);
  const [addressLng, setAddressLng] = useState<number | null>(null);
  const [floor, setFloor] = useState("");
  const [deliveryInstructions, setDeliveryInstructions] = useState("");
  const [notes, setNotes] = useState("");
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [error, setError] = useState("");
  const [placing, setPlacing] = useState(false);
  const [success, setSuccess] = useState(false);

  const deliveryFee = orderType === "delivery" ? DELIVERY_FEE : 0;
  const grandTotal = total + deliveryFee;

  // Load contact number and seed saved address from profile
  useEffect(() => {
    if (!open || !user) return;
    supabase.from("user_accounts").select("contact_number").eq("id", user.id).single().then(({ data }) => {
      if (data?.contact_number) setContactNumber(data.contact_number);
    });
  }, [open, user]);

  useEffect(() => {
    if (!open) { setError(""); setSuccess(false); }
  }, [open]);

  async function placeOrder() {
    if (!user) { setError("Please log in to place an order."); return; }
    if (items.length === 0) return;
    if (!contactNumber.trim()) { setError("Contact number is required."); return; }
    if (orderType === "delivery" && !address.trim()) { setError("Please set a delivery address."); return; }

    setPlacing(true); setError("");

    // Save address to addresses table if delivery
    let deliveryAddressId: string | null = null;
    let deliverySnapshot = address;

    if (orderType === "delivery" && address.trim()) {
      const { data: savedAddr } = await supabase
        .from("addresses")
        .insert({
          user_id: user.id,
          label: "Delivery",
          address_line: address,
          city: "",
          latitude: addressLat,
          longitude: addressLng,
          is_default: false,
        })
        .select("id")
        .single();
      deliveryAddressId = savedAddr?.id ?? null;
    }

    const checkoutNotes = [
      `Contact: ${contactNumber.trim()}`,
      floor ? `Floor/Unit: ${floor}` : "",
      deliveryInstructions ? `Instructions: ${deliveryInstructions}` : "",
      notes.trim() ? `Note: ${notes.trim()}` : "",
    ].filter(Boolean).join("\n");

    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({
        user_id: user.id,
        order_type: orderType,
        status: "pending",
        payment_method: "cash",
        payment_status: "unpaid",
        subtotal: total,
        delivery_fee: deliveryFee,
        total_amount: grandTotal,
        notes: checkoutNotes,
        delivery_address_id: deliveryAddressId,
        delivery_address_snapshot: orderType === "delivery" ? deliverySnapshot : null,
      })
      .select("id")
      .single();

    if (orderError || !order) {
      setPlacing(false);
      setError(orderError?.message || "Failed to place order.");
      return;
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      items.map((item) => ({
        order_id: order.id,
        menu_item_id: item.id,
        menu_item_name: item.name,
        unit_price: item.price,
        quantity: item.quantity,
        subtotal: item.price * item.quantity,
      }))
    );

    if (itemsError) {
      setPlacing(false);
      setError(itemsError.message || "Failed to save order items.");
      return;
    }

    clear();
    setSuccess(true);
    setPlacing(false);
    setTimeout(() => {
      setSuccess(false);
      onClose();
      router.push("/orders");
    }, 1000);
  }

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-50 flex justify-end">
        <div className="absolute inset-0 bg-black/40" onClick={onClose} />
        <div className="relative bg-white w-full max-w-md flex flex-col shadow-2xl" style={{ zIndex: 51 }}>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0e8df]">
            <div>
              <h2 className="font-bold text-[#21140b] text-lg">Your Cart {count > 0 && `(${count})`}</h2>
              <p className="text-xs text-[#7a5c44]">Review your items and checkout.</p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Success state */}
          {success ? (
            <div className="flex-1 flex items-center justify-center flex-col gap-3 px-6">
              <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: "#fdf3e3" }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke={ACCENT}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="font-bold text-[#21140b] text-lg">Order Placed!</p>
              <p className="text-sm text-[#7a5c44] text-center">Taking you to My Orders...</p>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
                {items.length === 0 ? (
                  <div className="text-center py-16">
                    <p className="text-gray-400 text-sm mb-4">Your cart is empty.</p>
                    <Link href="/menu" onClick={onClose} className="text-sm font-semibold hover:underline" style={{ color: ACCENT }}>
                      Browse menu →
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
                            <p className="text-xs text-[#7a5c44]">₱{item.price.toFixed(2)}</p>
                            <div className="flex items-center gap-2 mt-1.5">
                              <button onClick={() => update(item.id, item.quantity - 1)} className="w-6 h-6 rounded border border-[#e0d6cc] text-[#5a3e2b] flex items-center justify-center text-sm hover:border-[#b16b16] transition-colors">−</button>
                              <span className="text-sm w-5 text-center font-medium">{item.quantity}</span>
                              <button onClick={() => update(item.id, item.quantity + 1)} className="w-6 h-6 rounded border border-[#e0d6cc] text-[#5a3e2b] flex items-center justify-center text-sm hover:border-[#b16b16] transition-colors">+</button>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-[#21140b]">₱{(item.price * item.quantity).toFixed(2)}</p>
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
                        onChange={(e) => setContactNumber(e.target.value)}
                        placeholder="e.g. 09XX XXX XXXX"
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
                      <div className="rounded-lg border border-[#e0d6cc] px-3 py-2.5 text-sm font-semibold text-[#21140b]" style={{ background: "#fdf8f4" }}>
                        Cash on Delivery
                      </div>
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
                      <span>Subtotal</span><span>₱{total.toFixed(2)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[#7a5c44]">
                      <span>Delivery fee</span>
                      <span>{deliveryFee > 0 ? `₱${deliveryFee.toFixed(2)}` : "Free"}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t border-[#f0e8df]">
                      <span className="font-bold text-[#21140b]">Total</span>
                      <span className="font-bold text-[#21140b]">₱{grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {error && <p className="text-xs text-red-500 text-center">{error}</p>}

                  {!user ? (
                    <p className="text-xs text-center" style={{ color: ACCENT }}>
                      Please <Link href="/login" className="underline font-medium">log in</Link> to place an order.
                    </p>
                  ) : (
                    <button
                      onClick={placeOrder}
                      disabled={placing}
                      className="w-full py-3 rounded-xl text-white text-sm font-bold tracking-wide hover:opacity-90 transition-opacity disabled:opacity-60"
                      style={{ background: ACCENT }}
                    >
                      {placing ? "Placing order..." : "Place Order"}
                    </button>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {showAddressPicker && (
        <AddressPickerModal
          currentAddress={address}
          onClose={() => setShowAddressPicker(false)}
          onSelect={(addr, lat, lng, floorVal, instructionsVal) => {
            setAddress(addr);
            setAddressLat(lat);
            setAddressLng(lng);
            setFloor(floorVal);
            setDeliveryInstructions(instructionsVal);
          }}
        />
      )}
    </>
  );
}
