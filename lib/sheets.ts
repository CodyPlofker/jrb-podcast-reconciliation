// Google Sheets reader for the Podscale master tab
// Spreadsheet: Jones Road Beauty Master 2026
// Sheet gid: 1893391766 (master tab)
//
// Column mapping (master tab):
//   A  = Show/podcast name
//   B  = Network/agency name
//   F  = Expected spend/budget (dollars)
//   R  = Aired date (populated = aired; blank = not yet aired)
//   S  = Podscale approved flag ("TRUE" or blank)

import { google } from "googleapis";

const SPREADSHEET_ID =
  process.env.PODSCALE_SPREADSHEET_ID ??
  "1InhmO83-a7Z3U2GSGABE2AAnkoU77_fnI897J9d7sl4";

// The master tab is the first sheet; we read by name to be safe
const SHEET_NAME = "Master";
// Read columns A through S (adjust end column if sheet grows)
const RANGE = `${SHEET_NAME}!A:S`;

export interface PodscaleRow {
  rowNumber: number; // 1-indexed (matches sheet row)
  showName: string;
  network: string;
  expectedSpend: number | null; // Col F, dollars
  airedDate: string | null;     // Col R
  podscaleApproved: boolean;    // Col S == "TRUE"
}

function getAuth() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON is not set");
  // Stored as base64 to avoid Vercel mangling \n sequences in the private key
  const decoded = Buffer.from(raw.trim(), "base64").toString("utf-8");
  const creds = JSON.parse(decoded);
  return new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
}

export async function getPodscaleRows(): Promise<PodscaleRow[]> {
  const auth = getAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: SPREADSHEET_ID,
    range: RANGE,
  });

  const rawRows = response.data.values ?? [];
  const results: PodscaleRow[] = [];

  // Row index 0 = header row, skip it
  for (let i = 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    const showName = (row[0] ?? "").trim();
    // Skip completely empty rows
    if (!showName) continue;

    const network = (row[1] ?? "").trim();                     // Col B (index 1)
    const budgetRaw = (row[5] ?? "").toString().replace(/[$,]/g, ""); // Col F (index 5)
    const expectedSpend = budgetRaw ? parseFloat(budgetRaw) : null;
    const airedDate = (row[17] ?? "").trim() || null;          // Col R (index 17)
    const podscaleRaw = (row[18] ?? "").trim().toUpperCase();  // Col S (index 18)
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
