export default function HistoryChart({ history }) {
  if (!history || history.length === 0) return null

  const width = 640
  const height = 220
  const padding = { top: 12, right: 12, bottom: 24, left: 52 }
  const plotW = width - padding.left - padding.right
  const plotH = height - padding.top - padding.bottom

  const months = history.map((h) => h.month)
  const allValues = history.flatMap((h) => [h.income, h.expenses, h.loan_installment])
  const minY = 0
  const maxY = Math.max(...allValues) * 1.08

  const xScale = (m) => padding.left + (m / Math.max(...months, 1)) * plotW
  const yScale = (v) => padding.top + plotH - ((v - minY) / (maxY - minY)) * plotH

  const linePath = (key) =>
    history
      .map((h, i) => `${i === 0 ? 'M' : 'L'} ${xScale(h.month)} ${yScale(h[key])}`)
      .join(' ')

  const missedPoints = history.filter((h) => h.repaid_on_time === 0)

  const formatINR = (v) =>
    '₹' + Math.round(v).toLocaleString('en-IN')

  return (
    <div>
      <div className="chart-legend">
        <span><span className="swatch" style={{ background: '#152238' }} />Income</span>
        <span><span className="swatch" style={{ background: '#b8863c' }} />Expenses</span>
        <span><span className="swatch" style={{ background: '#a8432e' }} />Loan installment</span>
        <span><span className="swatch" style={{ background: '#a8432e', borderRadius: '50%' }} />Missed month</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img" aria-label="Income, expenses and installment history">
        {[0, 0.5, 1].map((t) => {
          const v = minY + t * (maxY - minY)
          return (
            <g key={t}>
              <line
                x1={padding.left} x2={width - padding.right}
                y1={yScale(v)} y2={yScale(v)}
                stroke="#dde1e8" strokeWidth="1"
              />
              <text x={padding.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize="10.5" fill="#5b6472" fontFamily="IBM Plex Mono, monospace">
                {formatINR(v)}
              </text>
            </g>
          )
        })}

        <path d={linePath('income')} fill="none" stroke="#152238" strokeWidth="2" />
        <path d={linePath('expenses')} fill="none" stroke="#b8863c" strokeWidth="1.5" strokeDasharray="4 3" />
        <path d={linePath('loan_installment')} fill="none" stroke="#a8432e" strokeWidth="1.5" strokeDasharray="2 2" />

        {missedPoints.map((h) => (
          <circle key={h.month} cx={xScale(h.month)} cy={yScale(h.income)} r="3.5" fill="#a8432e" />
        ))}

        <text x={padding.left} y={height - 4} fontSize="10.5" fill="#5b6472">month 0</text>
        <text x={width - padding.right} y={height - 4} fontSize="10.5" fill="#5b6472" textAnchor="end">
          month {Math.max(...months)}
        </text>
      </svg>
    </div>
  )
}
