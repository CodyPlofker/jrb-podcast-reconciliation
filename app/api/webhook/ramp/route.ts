import { NextResponse } from "next/server";
import { getBillById } from "@/lib/ramp";
import { getPodscaleRows } from "@/lib/sheets";
import { findMatchesForBill } from "@/lib/matcher";
import { postSingleBillResult } from "@/lib/slack";

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

  // Verify signature if secret is configured
  const webhookSecret = process.env.RAMP_WEBHOOK_SECRET;
  if (webhookSecret) {
    const sig = req.headers.get("x-ramp-signature");
    const valid = await verifySignature(rawBody, sig, webhookSecret);
    if (!valid) {
      console.error("[webhook] Invalid signature");
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Handle Ramp's challenge handshake during webhook registration
  if (payload.challenge) {
    return NextResponse.json({ challenge: payload.challenge });
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
