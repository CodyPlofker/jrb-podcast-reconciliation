// Ramp REST API client
// Docs: https://docs.ramp.com/developer-api/v1

const RAMP_API_BASE = "https://api.ramp.com/developer/v1";

export interface RampLineItem {
  description: string;
  amount: number; // in cents
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

function getHeaders() {
  const apiKey = process.env.RAMP_API_KEY;
  if (!apiKey) throw new Error("RAMP_API_KEY is not set");
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

export async function getBillsForApproval(): Promise<RampBill[]> {
  const bills: RampBill[] = [];
  let cursor: string | null = null;

  do {
    const params = new URLSearchParams({ approval_status: "PENDING", limit: "50" });
    if (cursor) params.set("page_cursor", cursor);

    const res = await fetch(`${RAMP_API_BASE}/bills?${params}`, {
      headers: getHeaders(),
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
    headers: getHeaders(),
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.data?.[0]?.file_url ?? null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeBill(raw: any): RampBill {
  const totalCents: number = raw.amount ?? raw.total_amount ?? 0;
  return {
    id: raw.id,
    vendor: raw.vendor?.name ?? raw.memo ?? "Unknown Vendor",
    invoiceNumber: raw.invoice_number ?? null,
    invoiceDate: raw.invoice_date ?? raw.created_at ?? null,
    totalAmount: totalCents / 100,
    lineItems: (raw.line_items ?? []).map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (li: any): RampLineItem => ({
        description: li.memo ?? li.description ?? "",
        amount: (li.amount ?? 0) / 100,
      })
    ),
    approvalStatus: raw.approval_status ?? "UNKNOWN",
    invoiceUrl: null,
  };
}
