"use client";

import { useState, useRef } from "react";

interface CheckResult {
  showName: string;
  network: string;
  expectedSpend: number | null;
  airedDate: string | null;
  podscaleApproved: boolean;
  matchedOn: string;
  pendingBills: { vendor: string; amount: number; invoiceDate: string | null }[];
  checks: {
    aired: boolean;
    podscaleApproved: boolean;
    spendMatches: boolean | null;
  };
}

function fmt(n: number) {
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function StatusBadge({ ok, label }: { ok: boolean | null; label: string }) {
  if (ok === null) return <span style={{ color: "#aaa", fontSize: 13 }}>— {label} (no pending bill)</span>;
  return (
    <span style={{ color: ok ? "#16a34a" : "#dc2626", fontSize: 13, fontWeight: 500 }}>
      {ok ? "✓" : "✗"} {label}
    </span>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [noMatch, setNoMatch] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setSearched(false);
    setNoMatch(false);
    setResult(null);

    const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
    const data = await res.json();
    setLoading(false);
    setSearched(true);

    if (data.results?.length > 0) {
      setResult(data.results[0]);
    } else {
      setNoMatch(true);
    }
  }

  function handleClear() {
    setQuery("");
    setResult(null);
    setSearched(false);
    setNoMatch(false);
    inputRef.current?.focus();
  }

  const allPass = result && result.checks.aired && result.checks.podscaleApproved && result.checks.spendMatches !== false;

  return (
    <>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f5f5f5; color: #111; }
        .wrap { max-width: 600px; margin: 0 auto; padding: 48px 24px 80px; }
        h1 { font-size: 20px; font-weight: 600; margin-bottom: 4px; }
        .sub { color: #888; font-size: 13px; margin-bottom: 32px; }
        .search-form { display: flex; gap: 8px; margin-bottom: 24px; }
        .search-input { flex: 1; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 15px; outline: none; background: #fff; }
        .search-input:focus { border-color: #111; }
        .search-btn { padding: 10px 18px; background: #111; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .search-btn:hover { background: #333; }
        .search-btn:disabled { background: #999; cursor: not-allowed; }
        .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 20px 24px; margin-bottom: 14px; }
        .card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 14px; }
        .show-name { font-size: 16px; font-weight: 600; line-height: 1.3; }
        .network { font-size: 13px; color: #888; margin-top: 2px; }
        .verdict { font-size: 13px; font-weight: 600; padding: 4px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; }
        .verdict.approve { background: #dcfce7; color: #16a34a; }
        .verdict.flag { background: #fef9c3; color: #854d0e; }
        .checks-grid { display: flex; flex-direction: column; gap: 6px; padding-top: 2px; }
        .check-row { display: flex; align-items: center; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
        .check-row:last-child { border-bottom: none; }
        .check-label { font-size: 13px; color: #555; }
        .check-value { font-size: 13px; font-weight: 500; }
        .check-value.ok { color: #16a34a; }
        .check-value.fail { color: #dc2626; }
        .check-value.na { color: #aaa; }
        .bills-section { margin-top: 12px; padding-top: 12px; border-top: 1px solid #f0f0f0; }
        .bills-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #aaa; margin-bottom: 8px; }
        .bill-row { font-size: 13px; color: #555; padding: 4px 0; display: flex; justify-content: space-between; }
        .no-bills { font-size: 13px; color: #aaa; }
        .no-match { text-align: center; padding: 40px 0; color: #888; font-size: 14px; }
        .status-card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 20px 24px; margin-bottom: 14px; }
        .status-row { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 500; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; }
        .divider { border: none; border-top: 1px solid #e5e5e5; margin: 8px 0 20px; }
        .section-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #aaa; margin-bottom: 12px; }
        .clear-btn { background: none; border: none; color: #aaa; font-size: 13px; cursor: pointer; padding: 0; text-decoration: underline; }
        .clear-btn:hover { color: #555; }
        .manual-run { margin-top: 24px; }
        .manual-link { font-size: 13px; color: #888; }
        .manual-link a { color: #111; font-weight: 500; }
      `}</style>

      <div className="wrap">
        <h1>🎙️ Podcast Invoice Reconciliation</h1>
        <p className="sub">Jones Road Beauty — Podscale × Ramp</p>

        <div className="status-card">
          <div className="status-row">
            <span className="dot" />
            Webhook active — monitoring Ramp for new invoices
          </div>
        </div>

        <hr className="divider" />
        <p className="section-label">Look up a show or network</p>

        <form className="search-form" onSubmit={handleSearch}>
          <input
            ref={inputRef}
            className="search-input"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Why Won't You Date Me, Headgum, Dear Media…"
            autoFocus
          />
          <button className="search-btn" type="submit" disabled={loading || !query.trim()}>
            {loading ? "Checking…" : "Check"}
          </button>
        </form>

        {searched && noMatch && (
          <div className="no-match">
            <div style={{ fontSize: 32, marginBottom: 8 }}>🤷</div>
            <div>No match found for &ldquo;{query}&rdquo;</div>
            <div style={{ marginTop: 6, fontSize: 12 }}>Not in the Podscale master sheet.</div>
            <button className="clear-btn" style={{ marginTop: 12 }} onClick={handleClear}>Clear</button>
          </div>
        )}

        {result && (
          <div>
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="show-name">{result.showName}</div>
                  {result.network && <div className="network">{result.network}</div>}
                </div>
                <span className={`verdict ${allPass ? "approve" : "flag"}`}>
                  {allPass ? "✅ Ready" : "⚠️ Review"}
                </span>
              </div>

              <div className="checks-grid">
                <div className="check-row">
                  <span className="check-label">Aired (Col R)</span>
                  <span className={`check-value ${result.checks.aired ? "ok" : "fail"}`}>
                    {result.checks.aired ? `✓ ${result.airedDate}` : "✗ Not marked as aired"}
                  </span>
                </div>
                <div className="check-row">
                  <span className="check-label">Podscale approved (Col S)</span>
                  <span className={`check-value ${result.checks.podscaleApproved ? "ok" : "fail"}`}>
                    {result.checks.podscaleApproved ? "✓ Approved" : "✗ Not approved"}
                  </span>
                </div>
                <div className="check-row">
                  <span className="check-label">Expected spend</span>
                  <span className="check-value na">
                    {result.expectedSpend != null ? fmt(result.expectedSpend) : "—"}
                  </span>
                </div>
                <div className="check-row">
                  <span className="check-label">Spend match</span>
                  <span className={`check-value ${result.checks.spendMatches === null ? "na" : result.checks.spendMatches ? "ok" : "fail"}`}>
                    {result.checks.spendMatches === null
                      ? "— no pending bill"
                      : result.checks.spendMatches
                      ? "✓ Matches"
                      : "✗ Mismatch"}
                  </span>
                </div>
              </div>

              {result.pendingBills.length > 0 && (
                <div className="bills-section">
                  <div className="bills-label">Pending Ramp bills</div>
                  {result.pendingBills.map((b, i) => (
                    <div className="bill-row" key={i}>
                      <span>{b.vendor}</span>
                      <span style={{ fontWeight: 500 }}>{fmt(b.amount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {result.pendingBills.length === 0 && (
                <div className="bills-section">
                  <span className="no-bills">No pending Ramp bills for this show</span>
                </div>
              )}
            </div>

            <button className="clear-btn" onClick={handleClear}>← Search again</button>
          </div>
        )}

        <div className="manual-run">
          <p className="manual-link">
            <a href="/api/reconcile">Run full reconciliation →</a> posts all pending bills to Slack
          </p>
        </div>
      </div>
    </>
  );
}
