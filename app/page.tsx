export default function Home() {
  return (
    <html>
      <head>
        <title>Podcast Invoice Reconciliation</title>
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
        `}</style>
      </head>
      <body>
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
            <h2>Manual run</h2>
            <p className="note">Run a full check of all pending Ramp bills right now and post results to Slack.</p>
            <a className="btn" href="/api/reconcile">Run reconciliation now →</a>
          </div>
        </div>
      </body>
    </html>
  );
}
