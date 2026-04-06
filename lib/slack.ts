// Slack notifier — posts reconciliation summary to #podcast-invoices
import { IncomingWebhook } from "@slack/webhook";
import type { ReconciliationResult } from "./reconcile";

function getWebhook(): IncomingWebhook {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) throw new Error("SLACK_WEBHOOK_URL is not set");
  return new IncomingWebhook(url);
}

function formatDollars(n: number): string {
  return `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function checkMark(ok: boolean): string {
  return ok ? "✓" : "✗";
}

export async function postReconciliationSummary(
  results: ReconciliationResult[],
  runDate: string
): Promise<void> {
  const webhook = getWebhook();

  const approved = results.filter((r) => r.status === "APPROVE");
  const flagged = results.filter((r) => r.status === "FLAG");
  const unmatched = results.filter((r) => r.status === "UNMATCHED");

  const lines: string[] = [
    `*📊 Podcast Invoice Reconciliation — ${runDate}*`,
    `${results.length} bill${results.length !== 1 ? "s" : ""} checked`,
    "",
  ];

  if (approved.length > 0) {
    lines.push(`*✅ Ready to approve (${approved.length})*`);
    for (const r of approved) {
      const matchInfo = r.matchedRow
        ? `${r.matchedRow.showName}${r.matchedRow.network ? ` / ${r.matchedRow.network}` : ""}`
        : r.billVendor;
      lines.push(
        `  • ${matchInfo} — ${formatDollars(r.billAmount)}  ` +
        `${checkMark(r.checks.aired)} aired  ` +
        `${checkMark(r.checks.podscaleApproved)} Podscale  ` +
        `${checkMark(r.checks.spendMatches)} spend`
      );
    }
    lines.push("");
  }

  if (flagged.length > 0) {
    lines.push(`*⚠️ Needs review (${flagged.length})*`);
    for (const r of flagged) {
      const label = r.matchedRow?.showName ?? r.billVendor;
      lines.push(`  • *${label}* — ${formatDollars(r.billAmount)}`);
      if (!r.checks.aired) lines.push(`    ↳ ❌ Not marked as aired yet (Col R is blank)`);
      if (!r.checks.podscaleApproved)
        lines.push(`    ↳ ❌ Not marked as Podscale-approved (Col S is not TRUE)`);
      if (!r.checks.spendMatches && r.matchedRow?.expectedSpend != null) {
        lines.push(
          `    ↳ ❌ Spend mismatch: invoice ${formatDollars(r.billAmount)} vs expected ${formatDollars(r.matchedRow.expectedSpend)}`
        );
      }
      if (r.billInvoiceUrl) lines.push(`    ↳ 🔗 <${r.billInvoiceUrl}|View invoice>`);
    }
    lines.push("");
  }

  if (unmatched.length > 0) {
    lines.push(`*❓ No spreadsheet match found (${unmatched.length})*`);
    for (const r of unmatched) {
      lines.push(`  • "${r.billVendor}" — ${formatDollars(r.billAmount)} — no matching row found`);
      if (r.billInvoiceUrl) lines.push(`    ↳ 🔗 <${r.billInvoiceUrl}|View invoice>`);
    }
    lines.push("");
  }

  if (results.length === 0) {
    lines.push("_No pending bills found in Ramp._");
  }

  await webhook.send({ text: lines.join("\n") });
}
