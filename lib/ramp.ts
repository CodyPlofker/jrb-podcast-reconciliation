// Ramp REST API client — OAuth 2.0 client credentials flow
// Docs: https://docs.ramp.com/developer-api/v1

const RAMP_API_BASE = "https://api.ramp.com/developer/v1";
const RAMP_TOKEN_URL = "https://api.ramp.com/developer/v1/token";

export interface RampLineItem {
  description: string;
  amount: number; // in dollars
}

export interface RampBill {
  id: string;
  vendor: string;
  invoiceNumber: string | null;
  invoiceDate: string | null;
  totalAmount: number; // in dollars
  lineItems: RampLineItem[];
  approvalStatus: string;
  invoiceUrl: string | null;
}

// Simple in-memory token cache (valid for duration of one function invocation)
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 30_000) {
    return cachedToken.token;
  }

  const clientId = process.env.RAMP_CLIENT_ID;
  const clientSecret = process.env.RAMP_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("RAMP_CLIENT_ID or RAMP_CLIENT_SECRET is not set");
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch(RAMP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      scope: "bills:read vendors:read",
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Ramp token error ${res.status}: ${text}`);
  }

  const data = await res.json();
  cachedToken = {
    token: data.access_token,
    expiresAt: now + (data.expires_in ?? 3600) * 1000,
  };
  return cachedToken.token;
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

export async function getBillsForApproval(): Promise<RampBill[]> {
  const bills: RampBill[] = [];
  let cursor: string | null = null;

  do {
    // Fetch all open bills — we filter for pending approval after normalization
    const params = new URLSearchParams({ payment_status: "OPEN", limit: "50" });
    if (cursor) params.set("start", cursor);

    const res = await fetch(`${RAMP_API_BASE}/bills?${params}`, {
      headers: await authHeaders(),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Ramp API error ${res.status}: ${text}`);
    }

    const data = await res.json();
    const page: RampBill[] = (data.data ?? []).map(normalizeBill);
    bills.push(...page);
    cursor = data.page?.next ?? null;
  } while (cursor);

  return bills;
}

export async function getBillInvoiceUrl(billId: string): Promise<string | null> {
  const res = await fetch(`${RAMP_API_BASE}/bills/${billId}/documents`, {
    headers: await authHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.file_url ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBill(raw: any): RampBill {
  // Ramp REST API returns amounts in dollars (not cents)
  const totalAmount: number = raw.amount ?? raw.total_amount ?? 0;
  return {
    id: raw.id,
    vendor: raw.vendor_name ?? raw.vendor?.name ?? raw.memo ?? "Unknown Vendor",
    invoiceNumber: raw.invoice_number ?? null,
    invoiceDate: raw.invoice_date ?? raw.due_date ?? raw.created_at ?? null,
    totalAmount,
    lineItems: (raw.line_items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (li: any): RampLineItem => ({
        description: li.memo ?? li.description ?? li.category ?? "",
        amount: li.amount ?? 0,
      })
    ),
    approvalStatus: raw.approval_status ?? raw.payment_status ?? "UNKNOWN",
    invoiceUrl: null,
  };
}
