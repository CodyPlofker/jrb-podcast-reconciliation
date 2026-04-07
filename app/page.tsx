"use client";

import { useState, useRef } from "react";

interface CheckResult {
  showName: string;
  network: string;
  expectedSpend: number | null;
  airedDate: string | null;
  podscaleApproved: boolean;
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
        .container { max-width: 600px; margin: 60px auto; padding: 0 24px; }
        h1 { font-size: 22px; font-weight: 600; margin-bottom: 6px; }
        .subtitle { color: #666; font-size: 14px; margin-bottom: 36px; }
        .card { background: #fff; border: 1px solid #e5e5e5; border-radius: 10px; padding: 24px; margin-bottom: 16px; }
        .card h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #888; margin-bottom: 12px; }
        .status { display: flex; align-items: center; gap: 8px; font-size: 15px; font-weight: 500; }
        .dot { width: 8px; height: 8px; border-radius: 50%; background: #22c55e; flex-shrink: 0; }
        .btn { display: inline-block; margin-top: 16px; padding: 10px 20px; background: #111; color: #fff; border-radius: 7px; text-decoration: none; font-size: 14px; font-weight: 500; }
        .btn:hover { background: #333; }
        .note { font-size: 13px; color: #777; margin-top: 10px; line-height: 1.5; }
        .checks { list-style: none; margin-top: 12px; }
        .checks li { font-size: 14px; padding: 6px 0; border-bottom: 1px solid #f0f0f0; display: flex; gap: 8px; }
        .checks li:last-child { border-bottom: none; }

        /* Search */
        .search-form { display: flex; gap: 8px; margin-top: 16px; }
        .search-input { flex: 1; padding: 10px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; outline: none; background: #f9f9f9; }
        .search-input:focus { border-color: #111; background: #fff; }
        .search-btn { padding: 10px 18px; background: #111; color: #fff; border: none; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; white-space: nowrap; }
        .search-btn:hover { background: #333; }
        .search-btn:disabled { background: #999; cursor: not-allowed; }

        /* Result card */
        .result-card { margin-top: 14px; background: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 8px; padding: 16px 20px; }
        .result-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
        .show-name { font-size: 15px; font-weight: 600; }
        .network-label { font-size: 13px; color: #888; margin-top: 2px; }
        .verdict { font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 20px; white-space: nowrap; flex-shrink: 0; margin-top: 2px; }
        .verdict.approve { background: #dcfce7; color: #16a34a; }
        .verdict.flag { background: #fef9c3; color: #854d0e; }
        .check-row { display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid #efefef; font-size: 13px; }
        .check-row:last-child { border-bottom: none; }
        .check-label { color: #555; }
        .check-val.ok { color: #16a34a; font-weight: 500; }
        .check-val.fail { color: #dc2626; font-weight: 500; }
        .check-val.na { color: #aaa; }
        .bills-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #aaa; margin: 12px 0 6px; }
        .bill-row { display: flex; justify-content: space-between; font-size: 13px; color: #555; padding: 3px 0; }
        .no-match-msg { margin-top: 12px; font-size: 13px; color: #888; text-align: center; padding: 16px 0; }
        .clear-btn { background: none; border: none; color: #aaa; font-size: 12px; cursor: pointer; text-decoration: underline; margin-top: 10px; display: inline-block; padding: 0; }
        .clear-btn:hover { color: #555; }
      `}</style>

      <div className="container">
        <h1>🎙️ Podcast Invoice Reconciliation</h1>
        <p className="subtitle">Jones Road Beauty — Podscale × Ramp</p>

        <div className="card">
          <h2>Status</h2>
          <div className="status">
            <span className="dot" />
            Webhook active — monitoring Ramp for new invoices
          </div>
          <p className="note">
            When a new podcast invoice is submitted in Ramp, you&apos;ll automatically
            get a Slack message in <strong>#podcast-invoices</strong> with the reconciliation result.
            No action needed on your end.
          </p>
        </div>

        <div className="card">
          <h2>How it works</h2>
          <ul className="checks">
            <li>✅ <span>Invoice submitted in Ramp → Slack message fires automatically</span></li>
            <li>📋 <span>Each invoice is matched against the Podscale master sheet</span></li>
            <li>🔍 <span>3 checks: aired (Col R), Podscale-approved (Col S), spend matches</span></li>
            <li>✅ <span>All 3 pass → ready to approve in Ramp</span></li>
            <li>⚠️ <span>Any fail → flagged with the specific reason</span></li>
          </ul>
        </div>

        <div className="card">
          <h2>Look up a show</h2>
          <p className="note">Search by show name, network, or vendor to check its status in the Podscale sheet.</p>
          <form className="search-form" onSubmit={handleSearch}>
            <input
              ref={inputRef}
              className="search-input"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="e.g. Headgum, Dear Media, Why Won't You Date Me…"
            />
            <button className="search-btn" type="submit" disabled={loading || !query.trim()}>
              {loading ? "Checking…" : "Check"}
            </button>
          </form>

          {searched && noMatch && (
            <div className="no-match-msg">
              No match found for &ldquo;{query}&rdquo; — not in the Podscale master sheet.
              <br />
              <button className="clear-btn" onClick={handleClear}>Clear</button>
            </div>
          )}

          {result && (
            <div className="result-card">
              <div className="result-head">
                <div>
                  <div className="show-name">{result.showName}</div>
                  {result.network && <div className="network-label">{result.network}</div>}
                </div>
                <span className={`verdict ${allPass ? "approve" : "flag"}`}>
                  {allPass ? "✅ Ready to approve" : "⚠️ Needs review"}
                </span>
              </div>

              <div className="check-row">
                <span className="check-label">Aired (Col R)</span>
                <span className={`check-val ${result.checks.aired ? "ok" : "fail"}`}>
                  {result.checks.aired ? `✓ ${result.airedDate}` : "✗ Not marked as aired"}
                </span>
              </div>
              <div className="check-row">
                <span className="check-label">Podscale approved (Col S)</span>
                <span className={`check-val ${result.checks.podscaleApproved ? "ok" : "fail"}`}>
                  {result.checks.podscaleApproved ? "✓ Approved" : "✗ Not approved"}
                </span>
              </div>
              <div className="check-row">
                <span className="check-label">Expected spend</span>
                <span className="check-val na">
                  {result.expectedSpend != null ? fmt(result.expectedSpend) : "—"}
                </span>
              </div>
              <div className="check-row">
                <span className="check-label">Spend match</span>
                <span className={`check-val ${result.checks.spendMatches === null ? "na" : result.checks.spendMatches ? "ok" : "fail"}`}>
                  {result.checks.spendMatches === null
                    ? "— no pending bill"
                    : result.checks.spendMatches
                    ? "✓ Matches"
                    : "✗ Mismatch"}
                </span>
              </div>

              {result.pendingBills.length > 0 && (
                <>
                  <div className="bills-label">Pending Ramp bills</div>
                  {result.pendingBills.map((b, i) => (
                    <div className="bill-row" key={i}>
                      <span>{b.vendor}</span>
                      <span style={{ fontWeight: 500 }}>{fmt(b.amount)}</span>
                    </div>
                  ))}
                </>
              )}

              <button className="clear-btn" onClick={handleClear}>← Search again</button>
            </div>
          )}
        </div>

        <div className="card">
          <h2>Manual run</h2>
          <p className="note">Run a full check of all pending Ramp bills right now and post results to Slack.</p>
          <a className="btn" href="/api/reconcile">Run reconciliation now →</a>
        </div>
      </div>
    </>
  );
}
