import { useState } from 'react'

const BADGE_STYLE = {
  APPROVE_FLEXIBILITY: { cls: 'approve', label: 'Approve flexibility' },
  DENY_FLEXIBILITY: { cls: 'deny', label: 'Deny flexibility' },
  NO_ACTION_NEEDED: { cls: 'neutral', label: 'No action needed' },
}

const formatINR = (v) => '₹' + Math.round(v).toLocaleString('en-IN')

export default function DecisionPanel({ decision, borrowerId }) {
  const [showRaw, setShowRaw] = useState(false)

  if (!decision) return null

  const badge = BADGE_STYLE[decision.decision] || { cls: 'neutral', label: decision.decision }

  return (
    <div className="panel">
      <h2>Decision engine</h2>

      <span className={`decision-badge ${badge.cls}`}>{badge.label}</span>
      <p className="why-text">{decision.why}</p>

      <div className="metric-row">
        <div className="metric">
          <div className="label">Diagnosis</div>
          <div className="value">{decision.diagnosis.replace('_', ' ')}</div>
        </div>
        <div className="metric">
          <div className="label">Expected recovery — current</div>
          <div className="value">{formatINR(decision.expected_recovery_current)}</div>
        </div>
        <div className="metric">
          <div className="label">Expected recovery — with flex</div>
          <div className={`value${decision.recovery_uplift > 0 ? ' up' : ''}`}>
            {formatINR(decision.expected_recovery_flex)}
            {decision.recovery_uplift > 0 && ` (+${formatINR(decision.recovery_uplift)})`}
          </div>
        </div>
      </div>

      <button className="raw-toggle" style={{ marginTop: 16 }} onClick={() => setShowRaw((s) => !s)}>
        {showRaw ? 'Hide' : 'Show'} raw API response
      </button>
      {showRaw && (
        <>
          <pre className="raw-json">{JSON.stringify(decision, null, 2)}</pre>
          <div className="api-note">
            GET /api/borrowers/{borrowerId}/decision — this is what a lender's system would
            consume directly; the dashboard is one way to view it.
          </div>
        </>
      )}
    </div>
  )
}
