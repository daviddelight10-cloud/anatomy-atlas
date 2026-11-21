// verify-payment — confirms a Paystack transaction with Paystack's API and
// grants/extends the caller's Premium subscription.
//
// POST { reference: string, plan: "monthly" | "semester" | "yearly" }
// Authorization: Bearer <user access_token>
//
// Env (auto-provided by Supabase): SUPABASE_URL, SUPABASE_ANON_KEY,
// SUPABASE_SERVICE_ROLE_KEY. Set manually: PAYSTACK_SECRET_KEY.

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PLANS: Record<string, { kobo: number; days: number }> = {
  monthly:  { kobo: 150_000,   days: 30  },  // ₦1,500
  semester: { kobo: 600_000,   days: 180 },  // ₦6,000
  yearly:   { kobo: 1_000_000, days: 365 },  // ₦10,000
};

const SITE_ORIGIN = "https://daviddelight10-cloud.github.io";

function corsHeaders(origin: string | null) {
  const dev = origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
  return {
    "Access-Control-Allow-Origin": dev ? origin! : SITE_ORIGIN,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers });
}

async function maxExpiry(admin: ReturnType<typeof createClient>, userId: string) {
  const { data } = await admin
    .from("subscriptions")
    .select("expires_at")
    .eq("user_id", userId);
  return (data || [])
    .map((r: { expires_at: string }) => new Date(r.expires_at))
    .reduce((a: Date, b: Date) => (b > a ? b : a), new Date(0));
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") return new Response("ok", { headers });
  if (req.method !== "POST")
    return json({ error: "Method not allowed" }, 405, headers);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer "))
      return json({ error: "Missing auth token" }, 401, headers);

    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supaUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await userClient.auth.getUser();
    if (authErr || !user)
      return json({ error: "Invalid session" }, 401, headers);

    const { reference, plan } = await req.json().catch(() => ({}));
    const cfg = PLANS[plan];
    if (typeof reference !== "string" || !reference || !cfg)
      return json({ error: "Missing or invalid reference/plan" }, 400, headers);

    const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
    if (!secret)
      return json({ error: "Payments not configured" }, 500, headers);

    const admin = createClient(supaUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Idempotency first — if this reference was already processed, just echo state.
    {
      const { data: dup } = await admin
        .from("subscriptions")
        .select("id")
        .eq("paystack_ref", reference)
        .maybeSingle();
      if (dup) {
        const max = await maxExpiry(admin, user.id);
        return json({ activated: true, expires_at: max.toISOString(), duplicate: true }, 200, headers);
      }
    }

    // Verify with Paystack — the popup's onSuccess can race Paystack's API,
    // so retry a couple of times before giving up.
    let tx: any = null;
    let lastErr = "unknown";
    for (let attempt = 0; attempt < 3 && !tx; attempt++) {
      try {
        const r = await fetch(
          `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
          { headers: { Authorization: `Bearer ${secret}` } }
        );
        const j = await r.json();
        if (j.status && j.data?.status === "success") tx = j.data;
        else lastErr = j.data?.status || j.message || "pending";
      } catch (e) {
        lastErr = String(e);
      }
      if (!tx && attempt < 2) await new Promise((r) => setTimeout(r, 1500));
    }
    if (!tx)
      return json(
        { error: `Payment not verified (${lastErr}). If you were charged, contact support with reference ${reference}.` },
        400,
        headers
      );

    if (tx.currency !== "NGN" || tx.amount < cfg.kobo)
      return json(
        { error: `Insufficient payment: expected NGN ${cfg.kobo / 100}, got ${tx.currency} ${tx.amount / 100}.` },
        400,
        headers
      );

    // Stack onto any live subscription: base = later of (now, current expiry).
    const now = new Date();
    const latest = await maxExpiry(admin, user.id);
    const base = latest > now ? latest : now;
    const expiresAt = new Date(base.getTime() + cfg.days * 86_400_000);

    const { error: insErr } = await admin.from("subscriptions").insert({
      user_id: user.id,
      plan,
      paystack_ref: reference,
      amount_kobo: tx.amount,
      expires_at: expiresAt.toISOString(),
    });
    if (insErr) {
      // Lost a race on the unique ref (retry/webhook double-fire) — echo state.
      if (insErr.code === "23505") {
        const max = await maxExpiry(admin, user.id);
        return json({ activated: true, expires_at: max.toISOString(), duplicate: true }, 200, headers);
      }
      throw insErr;
    }

    return json({ activated: true, expires_at: expiresAt.toISOString() }, 200, headers);
  } catch (e) {
    console.error("verify-payment error:", e);
    return json({ error: "Verification failed — please contact support." }, 500, headers);
  }
});
