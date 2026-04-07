// Google Sheets reader for the Podscale master tab
// Spreadsheet: Jones Road Beauty Master 2026
// Sheet gid: 1893391766 (master tab)
//
// Auth: Google API key (simpler than service account, works with "anyone with link" sharing)
//
// Column mapping (master tab):
//   A  = Show/podcast name
//   B  = Network/agency name
//   F  = Expected spend/budget (dollars)
//   R  = Aired date (populated = aired; blank = not yet aired)
//   S  = Podscale approved flag ("TRUE" or blank)

const SPREADSHEET_ID =
  process.env.PODSCALE_SPREADSHEET_ID ??
  "1InhmO83-a7Z3U2GSGABE2AAnkoU77_fnI897J9d7sl4";

// gid 1893391766 = master tab. We use the numeric sheet ID in the range
// to ensure we read the right tab regardless of its display name.
const RANGE = "A:S";

export interface PodscaleRow {
  rowNumber: number; // 1-indexed (matches sheet row)
  showName: string;
  network: string;
  expectedSpend: number | null; // Col F, dollars
  airedDate: string | null;     // Col R
  podscaleApproved: boolean;    // Col S == "TRUE"
}

export async function getPodscaleRows(): Promise<PodscaleRow[]> {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_API_KEY is not set");

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}?key=${apiKey}`;
  const res = await fetch(url);

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${text}`);
  }

  const data = await res.json() as { values?: string[][] };
  const rawRows = data.values ?? [];
  const results: PodscaleRow[] = [];

  // Row index 0 = header row, skip it
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const showName = (row[0] ?? "").trim();
    // Skip completely empty rows
    if (!showName) continue;

    const network = (row[1] ?? "").trim();                            // Col B (index 1)
    const budgetRaw = (row[5] ?? "").toString().replace(/[$,]/g, ""); // Col F (index 5)
    const expectedSpend = budgetRaw ? parseFloat(budgetRaw) : null;
    const airedDate = (row[17] ?? "").trim() || null;                 // Col R (index 17)
    const podscaleRaw = (row[18] ?? "").trim().toUpperCase();         // Col S (index 18)
    const podscaleApproved = podscaleRaw === "TRUE";

    results.push({
      rowNumber: i + 1,
      showName,
      network,
      expectedSpend,
      airedDate,
      podscaleApproved,
    });
  }

  return results;
}
