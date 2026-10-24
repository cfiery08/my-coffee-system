import { createClient } from "npm:@supabase/supabase-js@2";

function hexToBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length || left.length === 0) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

async function validSignature(rawBody: string, header: string, secret: string) {
  const parts = Object.fromEntries(header.split(",").map((part) => {
    const separator = part.indexOf("=");
    return separator < 0
      ? [part.trim(), ""]
      : [part.slice(0, separator).trim(), part.slice(separator + 1).trim()];
  }));
  if (!parts.t) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${parts.t}.${rawBody}`));
  const expected = new Uint8Array(signature);
  return [parts.te, parts.li].some((candidate) => {
    const supplied = candidate ? hexToBytes(candidate) : null;
    return supplied ? constantTimeEqual(expected, supplied) : false;
  });
}

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const webhookSecret = Deno.env.get("PAYMONGO_WEBHOOK_SECRET");
  const paymongoKey = Deno.env.get("PAYMONGO_SECRET_KEY");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // Supabase injects this server-only key into hosted Edge Functions.
  const supabaseSecretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!webhookSecret || !paymongoKey || !supabaseUrl || !supabaseSecretKey) {
    return json({ error: "Webhook is not configured." }, 503);
  }

  const rawBody = await request.text();
  if (!await validSignature(rawBody, request.headers.get("paymongo-signature") ?? "", webhookSecret)) {
    return json({ error: "Invalid webhook signature." }, 401);
  }

  let payload: Record<string, any>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid webhook payload." }, 400);
  }

  const event = payload?.data?.attributes ?? payload?.data;
  if (event?.type !== "checkout_session.payment.paid") return json({ received: true });

  const isLiveKey = paymongoKey.startsWith("sk_live_");
  if (Boolean(event.livemode) !== isLiveKey) return json({ received: true });

  const session = event.data;
  const attributes = session?.attributes;
  const orderId = attributes?.reference_number ?? attributes?.metadata?.order_id;
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId)) return json({ received: true });

  const paidPayment = Array.isArray(attributes?.payments)
    ? attributes.payments.find((payment: any) => payment?.attributes?.status === "paid")
    : null;
  const paidAmount = paidPayment?.attributes?.amount;
  const netAmount = paidPayment?.attributes?.net_amount;
  if (!paidPayment || paidPayment?.attributes?.currency !== "PHP" || !Number.isInteger(paidAmount)) {
    return json({ received: true });
  }

  const admin = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: order, error: lookupError } = await admin
    .from("orders")
    .select("id, total_amount, payment_method, payment_status")
    .eq("id", orderId)
    .maybeSingle();
  if (lookupError) return json({ error: "Could not verify the order." }, 500);
  const expectedAmount = order ? Math.round(Number(order.total_amount) * 100) : -1;
  const amountMatchesOrder = paidAmount === expectedAmount || netAmount === expectedAmount;
  if (!order || order.payment_method !== "gcash" || !amountMatchesOrder) {
    return json({ received: true });
  }
  if (order.payment_status === "paid") return json({ received: true });

  const { error: updateError } = await admin
    .from("orders")
    .update({ payment_status: "paid", updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .eq("payment_method", "gcash")
    .eq("payment_status", "unpaid");
  if (updateError) return json({ error: "Could not update payment status." }, 500);
  return json({ received: true });
});
