import { NextResponse } from "next/server";
import { runReconciliation } from "@/lib/reconcile";
import { postReconciliationSummary } from "@/lib/slack";

// Allow Vercel cron to call this (max 60s on hobby, 300s on pro)
export const maxDuration = 60;

export async function GET(req: Request) {
  // Protect against unauthorized calls in production
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const results = await runReconciliation();
    const runDate = new Date().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "America/New_York",
    });

    await postReconciliationSummary(results, runDate);

    const summary = {
      total: results.length,
      approve: results.filter((r) => r.status === "APPROVE").length,
      flag: results.filter((r) => r.status === "FLAG").length,
      unmatched: results.filter((r) => r.status === "UNMATCHED").length,
      runDate,
    };

    return NextResponse.json({ ok: true, summary, results });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[reconcile] Error:", message);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
