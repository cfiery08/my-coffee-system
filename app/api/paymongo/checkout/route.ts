import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type OrderRow = {
  id: string;
  user_id: string;
  order_type: string;
  status: string;
  payment_method: string | null;
  payment_status: string | null;
  subtotal: number;
  delivery_fee: number;
  total_amount: number;
  order_items: { menu_item_id: string | null; quantity: number }[];
};

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !secretKey) return null;
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  const paymongoKey = process.env.PAYMONGO_SECRET_KEY;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const admin = getAdminClient();
  if (!paymongoKey || !appUrl || !admin) {
    return NextResponse.json({ error: "Online payment is not configured yet." }, { status: 503 });
  }

  const authorization = request.headers.get("authorization") ?? "";
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
  if (!token) return NextResponse.json({ error: "Please sign in again before paying." }, { status: 401 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!anonKey) return NextResponse.json({ error: "Online payment is not configured yet." }, { status: 503 });
  const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) return NextResponse.json({ error: "Please sign in again before paying." }, { status: 401 });

  let body: { orderId?: unknown; checkoutAttemptId?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid checkout request." }, { status: 400 });
  }
  if (typeof body.orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.orderId)) {
    return NextResponse.json({ error: "Invalid order." }, { status: 400 });
  }
  if (typeof body.checkoutAttemptId !== "string" || !/^[0-9a-f-]{36}$/i.test(body.checkoutAttemptId)) {
    return NextResponse.json({ error: "Invalid checkout attempt. Please try again." }, { status: 400 });
  }

  const { data: order, error: orderError } = await admin
    .from("orders")
    .select("id, user_id, order_type, status, payment_method, payment_status, subtotal, delivery_fee, total_amount, order_items(menu_item_id, quantity)")
    .eq("id", body.orderId)
    .eq("user_id", authData.user.id)
    .maybeSingle();
  if (orderError || !order) return NextResponse.json({ error: "Order could not be found." }, { status: 404 });

  const typedOrder = order as OrderRow;
  if (typedOrder.status !== "pending" || typedOrder.payment_status !== "unpaid" || typedOrder.payment_method !== "gcash") {
    return NextResponse.json({ error: "This order is no longer available for GCash checkout." }, { status: 409 });
  }

  const orderItems = typedOrder.order_items ?? [];
  if (orderItems.length === 0 || orderItems.some((item) => !item.menu_item_id || !Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > 50)) {
    return NextResponse.json({ error: "Order items could not be verified. Please update your cart and try again." }, { status: 400 });
  }
  const menuIds = [...new Set(orderItems.map((item) => item.menu_item_id!))];
  const { data: menuItems, error: menuError } = await admin
    .from("menu_items")
    .select("id, name, price, is_available")
    .in("id", menuIds);
  if (menuError || !menuItems || menuItems.length !== menuIds.length || menuItems.some((item) => !item.is_available)) {
    return NextResponse.json({ error: "One or more items are no longer available. Please refresh your cart." }, { status: 409 });
  }

  const menuById = new Map(menuItems.map((item) => [item.id, item]));
  const lineItems = orderItems.map((item) => {
    const menuItem = menuById.get(item.menu_item_id!);
    return { name: String(menuItem!.name).slice(0, 100), amount: Math.round(Number(menuItem!.price) * 100), currency: "PHP", quantity: item.quantity };
  });
  const subtotalCents = lineItems.reduce((sum, item) => sum + item.amount * item.quantity, 0);
  const deliveryFeeCents = typedOrder.order_type === "delivery" ? 5000 : 0;
  const totalCents = subtotalCents + deliveryFeeCents;
  if (Math.round(Number(typedOrder.subtotal) * 100) !== subtotalCents || Math.round(Number(typedOrder.delivery_fee) * 100) !== deliveryFeeCents || Math.round(Number(typedOrder.total_amount) * 100) !== totalCents) {
    return NextResponse.json({ error: "Menu prices changed. Please refresh your cart and place the order again." }, { status: 409 });
  }
  if (deliveryFeeCents > 0) lineItems.push({ name: "Delivery fee", amount: deliveryFeeCents, currency: "PHP", quantity: 1 });

  const checkoutResponse = await fetch("https://api.paymongo.com/v2/checkout_sessions", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${paymongoKey}:`).toString("base64")}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `brewora-order-${typedOrder.id}-${body.checkoutAttemptId}`,
    },
    body: JSON.stringify({ data: { attributes: {
      line_items: lineItems,
      payment_method_types: ["gcash"],
      success_url: `${appUrl}/orders?payment=gcash-success&order_id=${typedOrder.id}`,
      cancel_url: `${appUrl}/orders?payment=gcash-cancelled&order_id=${typedOrder.id}`,
      reference_number: typedOrder.id,
      send_email_receipt: true,
      metadata: { order_id: typedOrder.id },
    } } }),
    signal: AbortSignal.timeout(20000),
  });
  const responseBody = await checkoutResponse.json().catch(() => null);
  const checkoutUrl = responseBody?.data?.attributes?.checkout_url;
  if (!checkoutResponse.ok || typeof checkoutUrl !== "string") {
    return NextResponse.json({ error: "Could not start PayMongo checkout. Your order is still unpaid; please try again." }, { status: 502 });
  }

  return NextResponse.json({ checkoutUrl });
}
