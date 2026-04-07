import { NextResponse } from "next/server";
import { getBillById, getAccessTokenPublic } from "@/lib/ramp";
import { getPodscaleRows } from "@/lib/sheets";
import { findMatchesForBill } from "@/lib/matcher";
import { postSingleBillResult } from "@/lib/slack";

const RAMP_API_BASE = "https://api.ramp.com/developer/v1";

async function verifyWebhook(webhookId: string, challenge: string): Promise<void> {
  const token = await getAccessTokenPublic();
  const res = await fetch(`${RAMP_API_BASE}/webhooks/${webhookId}/verify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ challenge }),
  });
  const data = await res.json();
  console.log("[webhook] verify result:", res.status, JSON.stringify(data));
}

export const maxDuration = 60;

// Verify Ramp HMAC-SHA256 signature
async function verifySignature(rawBody: string, signature: string | null, secret: string): Promise<boolean> {
  if (!signature) return false;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, encoder.encode(rawBody));
  const expected = Array.from(new Uint8Array(sigBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return expected === signature;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle Ramp's challenge handshake BEFORE signature check.
  // The challenge arrives immediately after registration, before we can store
  // the new secret in our deployment — so we allow it through unsigned.
  // Challenges are not security-sensitive (no business data involved).
  // Ramp sends { challenge: "..." } and expects us to:
  //   1. Return 2xx (so they know the endpoint is reachable)
  //   2. Call POST /webhooks/{id}/verify with the challenge to activate
  if (payload.challenge) {
    const challenge = payload.challenge as string;
    const webhookId = process.env.RAMP_WEBHOOK_ID;
    if (webhookId) {
      // Must await — Vercel terminates function on response, killing async tasks
      await verifyWebhook(webhookId, challenge);
    } else {
      console.warn("[webhook] RAMP_WEBHOOK_ID not set — cannot auto-verify");
    }
    return NextResponse.json({ challenge });
  }

  // Verify signature for all real events (not challenge handshakes)
  const webhookSecret = process.env.RAMP_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = req.headers.get("x-ramp-signature");
    const valid = await verifySignature(rawBody, sig, webhookSecret);
    if (!valid) {
      console.error("[webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  const eventType = payload.type as string;
  if (eventType !== "bills.created") {
    // Acknowledge but ignore other event types
    return NextResponse.json({ ok: true, ignored: true });
  }

  const billId = (payload.object as Record<string, string>)?.resource_id;
  if (!billId) {
    return NextResponse.json({ error: "Missing resource_id" }, { status: 400 });
  }

  console.log(`[webhook] bills.created — billId: ${billId}`);

  // Reconcile the single bill and post to Slack
  try {
    const [bill, podscaleRows] = await Promise.all([
      getBillById(billId),
      getPodscaleRows(),
    ]);

    if (!bill) {
      console.warn(`[webhook] Bill ${billId} not found in Ramp`);
      return NextResponse.json({ ok: true, skipped: "bill not found" });
    }

    const lineItemDescs = bill.lineItems.map((li) => li.description);
    const matches = findMatchesForBill(bill.vendor, lineItemDescs, podscaleRows);

    const runDate = new Date().toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
      timeZone: "America/New_York",
    });

    await postSingleBillResult(bill, matches, podscaleRows, runDate);

    return NextResponse.json({ ok: true, billId, matchCount: matches.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webhook] Error:", message);
    // Return 200 so Ramp doesn't retry — we'll see the error in logs
    return NextResponse.json({ ok: false, error: message });
  }
}
