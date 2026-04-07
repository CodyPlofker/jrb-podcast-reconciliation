import { NextResponse } from "next/server";
import { getPodscaleRows } from "@/lib/sheets";
import { getBillsForApproval } from "@/lib/ramp";
import { findMatch } from "@/lib/matcher";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q) return NextResponse.json({ results: [] });

  const [rows, bills] = await Promise.all([
    getPodscaleRows(),
    getBillsForApproval(),
  ]);

  const match = findMatch(q, rows);
  if (!match) return NextResponse.json({ results: [] });

  const row = match.row;

  // Find any pending Ramp bills that match this row
  const matchingBills = bills.filter((b) => {
    const vm = findMatch(b.vendor, rows);
    return vm?.row.rowNumber === row.rowNumber;
  });

  const result = {
    showName: row.showName,
    network: row.network,
    expectedSpend: row.expectedSpend,
    airedDate: row.airedDate,
    podscaleApproved: row.podscaleApproved,
    matchedOn: match.matchedOn,
    matchScore: match.score,
    pendingBills: matchingBills.map((b) => ({
      vendor: b.vendor,
      amount: b.totalAmount,
      invoiceDate: b.invoiceDate,
    })),
    checks: {
      aired: !!row.airedDate,
      podscaleApproved: row.podscaleApproved,
      // spend check only possible if there's a pending bill
      spendMatches: matchingBills.length > 0 && row.expectedSpend != null
        ? matchingBills.some((b) => Math.abs(b.totalAmount - (row.expectedSpend ?? 0)) <= 0.5)
        : null,
    },
  };

  return NextResponse.json({ results: [result] });
}
