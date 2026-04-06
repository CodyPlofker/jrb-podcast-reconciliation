// Fuzzy name matcher: maps Ramp bill vendor/line-item names → Podscale rows
// Uses Fuse.js with a multi-field fallback strategy

import Fuse from "fuse.js";
import type { PodscaleRow } from "./sheets";

export interface MatchResult {
  row: PodscaleRow;
  score: number;       // 0 = perfect, 1 = worst
  matchedOn: "showName" | "network";
  method: "exact" | "fuzzy";
}

// Threshold: 0 = perfect match required, 1 = match anything.
// 0.4 catches common abbreviations and partial name differences.
const FUZZY_THRESHOLD = 0.4;

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function findMatch(
  query: string,
  rows: PodscaleRow[]
): MatchResult | null {
  if (!query.trim()) return null;
  const q = normalize(query);

  // 1. Exact match on show name
  for (const row of rows) {
    if (normalize(row.showName) === q) {
      return { row, score: 0, matchedOn: "showName", method: "exact" };
    }
  }

  // 2. Exact match on network
  for (const row of rows) {
    if (row.network && normalize(row.network) === q) {
      return { row, score: 0, matchedOn: "network", method: "exact" };
    }
  }

  // 3. Fuzzy match on show name
  const showFuse = new Fuse(rows, {
    keys: ["showName"],
    threshold: FUZZY_THRESHOLD,
    includeScore: true,
    getFn: (obj, path) => normalize((obj as unknown as Record<string, string>)[path as string] ?? ""),
  });
  const showResults = showFuse.search(q);
  if (showResults.length > 0 && showResults[0].score !== undefined) {
    return {
      row: showResults[0].item,
      score: showResults[0].score,
      matchedOn: "showName",
      method: "fuzzy",
    };
  }

  // 4. Fuzzy match on network
  const netFuse = new Fuse(
    rows.filter((r) => r.network),
    {
      keys: ["network"],
      threshold: FUZZY_THRESHOLD,
      includeScore: true,
      getFn: (obj, path) => normalize((obj as unknown as Record<string, string>)[path as string] ?? ""),
    }
  );
  const netResults = netFuse.search(q);
  if (netResults.length > 0 && netResults[0].score !== undefined) {
    return {
      row: netResults[0].item,
      score: netResults[0].score,
      matchedOn: "network",
      method: "fuzzy",
    };
  }

  return null;
}

// For a bill with multiple line items, try matching each line item description
// and also the vendor name. Return all unique matches found.
export function findMatchesForBill(
  vendor: string,
  lineItemDescriptions: string[],
  rows: PodscaleRow[]
): MatchResult[] {
  const seen = new Set<number>(); // rowNumber
  const results: MatchResult[] = [];

  const candidates = [vendor, ...lineItemDescriptions].filter(Boolean);

  for (const candidate of candidates) {
    const match = findMatch(candidate, rows);
    if (match && !seen.has(match.row.rowNumber)) {
      seen.add(match.row.rowNumber);
      results.push(match);
    }
  }

  return results;
}
