import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function signatureMatches(expected: string, supplied: string) {
  const expectedBuffer = Buffer.from(expected, "hex");
  const suppliedBuffer = Buffer.from(supplied, "hex");
  return expectedBuffer.length === suppliedBuffer.length && expectedBuffer.length > 0 && timingSafeEqual(expectedBuffer, suppliedBuffer);
}

export async function POST(request: Request) {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET;
  const paymongoKey = process.env.PAYMONGO_SECRET_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!webhookSecret || !paymongoKey || !supabaseUrl || !supabaseSecretKey) {
    return NextResponse.json({ error: "Webhook is not configured." }, { status: 503 });
  }

  const rawBody = await request.text();
  const signatureHeader = request.headers.get("paymongo-signature") ?? "";
  const parts = Object.fromEntries(signatureHeader.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0 ? [part.trim(), ""] : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
  const timestamp = parts.t;
  if (!timestamp) return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  const digest = createHmac("sha256", webhookSecret).update(`${timestamp}.${rawBody}`).digest("hex");
  if (!signatureMatches(digest, parts.te ?? "") && !signatureMatches(digest, parts.li ?? "")) {
    return NextResponse.json({ error: "Invalid webhook signature." }, { status: 401 });
  }

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const event = payload?.data?.attributes ?? payload?.data;
  if (event?.type !== "checkout_session.payment.paid") return NextResponse.json({ received: true });

  const isLiveKey = paymongoKey.startsWith("sk_live_");
  if (Boolean(event.livemode) !== isLiveKey) return NextResponse.json({ received: true });

  const session = event.data;
  const sessionAttributes = session?.attributes;
  const orderId = sessionAttributes?.reference_number ?? sessionAttributes?.metadata?.order_id;
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) return NextResponse.json({ received: true });
  const paidPayment = Array.isArray(sessionAttributes?.payments)
    ? sessionAttributes.payments.find((payment: any) => payment?.attributes?.status === "paid")
    : null;
  const paidAmount = paidPayment?.attributes?.amount;
  const paidCurrency = paidPayment?.attributes?.currency;
  const netAmount = paidPayment?.attributes?.net_amount;
  if (!paidPayment || paidCurrency !== "PHP" || !Number.isInteger(paidAmount)) return NextResponse.json({ received: true });

  const admin = createClient(supabaseUrl, supabaseSecretKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: order, error: lookupError } = await admin
    .from("orders")
    .select("id, total_amount, payment_method, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (lookupError) return NextResponse.json({ error: "Could not verify the order." }, { status: 500 });
  const expectedAmount = order ? Math.round(Number(order.total_amount) * 100) : -1;
  const amountMatchesOrder = paidAmount === expectedAmount || netAmount === expectedAmount;
  if (!order || order.payment_method !== "gcash" || !amountMatchesOrder) {
    return NextResponse.json({ received: true });
  }
  if (order.payment_status === "paid") return NextResponse.json({ received: true });

  const { error: updateError } = await admin
    .from("orders")
    .update({ payment_status: "paid", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("payment_method", "gcash")
    .eq("payment_status", "unpaid");
  if (updateError) return NextResponse.json({ error: "Could not update payment status." }, { status: 500 });
  return NextResponse.json({ received: true });
}
