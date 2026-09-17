import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

const money = (n) => `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`
const pct = (n, digits = 0) => `${(Number(n || 0) * 100).toFixed(digits)}%`
const clamp = (n, a, b) => Math.min(b, Math.max(a, n))

const Icons = {
  grid: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z"/></svg>,
  shield: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 19 6v5c0 4.6-2.8 8.6-7 10-4.2-1.4-7-5.4-7-10V6l7-3Zm-1 5v6h2V8h-2Zm0 8v2h2v-2h-2Z"/></svg>,
  sliders: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h10v2H4V7Zm14 0h2v2h-2V7ZM10 15h10v2H10v-2ZM4 15h2v2H4v-2ZM7 4h2v5H7V4Zm8 6h2v7h-2v-7Z"/></svg>,
  pulse: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12h4l2-7 4 14 2-7h6v2h-7l-1 3-4-14-1 5H3v-2Z"/></svg>,
  arrow: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m13 5 7 7-7 7-1.4-1.4 4.6-4.6H4v-2h12.2l-4.6-4.6L13 5Z"/></svg>,
  chevron: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6 1.4-1.4L17.8 12l-7.4 7.4L9 18Z"/></svg>,
  search: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15.5 14.1 4.7 4.7-1.4 1.4-4.7-4.7a7 7 0 1 1 1.4-1.4ZM10 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"/></svg>,
  user: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0H5Z"/></svg>,
  bank: <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 9 9-5 9 5v2H3V9Zm2 4h2v6H5v-6Zm6 0h2v6h-2v-6Zm6 0h2v6h-2v-6ZM3 21h18v-2H3v2Z"/></svg>,
}

function StatCard({label, value, detail, tone = ''}) {
  return <div className="stat-card">
    <div className="stat-label">{label}</div>
    <div className={`stat-value ${tone}`}>{value}</div>
    <div className="stat-detail">{detail}</div>
  </div>
}

function Badge({decision}) {
  const cfg = decision === 'APPROVE_FLEXIBILITY'
    ? {label: 'Flex approved', cls: 'good'}
    : decision === 'DENY_FLEXIBILITY'
      ? {label: 'Flex denied', cls: 'bad'}
      : {label: 'No action', cls: 'neutral'}
  return <span className={`badge ${cfg.cls}`}><span className="badge-dot" />{cfg.label}</span>
}

function ScoreRing({value, label = 'Stress risk'}) {
  const v = clamp(Number(value || 0), 0, 1)
  const r = 44
  const c = 2 * Math.PI * r
  return <div className="score-ring-wrap">
    <svg className="score-ring" viewBox="0 0 110 110">
      <circle className="ring-bg" cx="55" cy="55" r={r} />
      <circle className="ring-fill" cx="55" cy="55" r={r} style={{strokeDasharray: `${c * v} ${c}`}} />
    </svg>
    <div className="score-copy"><strong>{pct(v)}</strong><span>{label}</span></div>
  </div>
}

function HistoryChart({history}) {
  if (!history?.length) return null
  const W = 860, H = 280, L = 58, R = 18, T = 18, B = 34
  const plotW = W - L - R, plotH = H - T - B
  const vals = history.flatMap(x => [x.income, x.expenses, x.loan_installment])
  const maxY = Math.max(...vals) * 1.08
  const x = i => L + (i / Math.max(history.length - 1, 1)) * plotW
  const y = v => T + plotH - (v / maxY) * plotH
  const path = key => history.map((d,i) => `${i ? 'L':'M'} ${x(i)} ${y(d[key])}`).join(' ')
  const misses = history.filter(d => d.repaid_on_time === 0)
  return <div className="chart-wrap">
    <div className="chart-head">
      <div className="legend"><span><i className="l-inc"/>Income</span><span><i className="l-exp"/>Expenses</span><span><i className="l-inst"/>Installment</span><span><i className="l-miss"/>Missed payment</span></div>
      <div className="chart-range">{history.length} months</div>
    </div>
    <svg viewBox={`0 0 ${W} ${H}`} className="history-svg" role="img" aria-label="Borrower cashflow history">
      {[0,.25,.5,.75,1].map(t => <g key={t}><line x1={L} x2={W-R} y1={y(maxY*t)} y2={y(maxY*t)} className="gridline"/><text x={L-10} y={y(maxY*t)+4} textAnchor="end" className="axis-label">{money(maxY*t).replace(',000','k')}</text></g>)}
      <path d={path('income')} className="line-income"/>
      <path d={path('expenses')} className="line-expense"/>
      <path d={path('loan_installment')} className="line-install"/>
      {misses.map(d => { const i=history.indexOf(d); return <circle key={d.month} cx={x(i)} cy={y(d.income)} r="4.2" className="miss-dot"/> })}
      <text x={L} y={H-8} className="axis-label">Month 1</text>
      <text x={W-R} y={H-8} textAnchor="end" className="axis-label">Month {history.at(-1).month}</text>
    </svg>
  </div>
}

function FeatureBar({name, value}) {
  return <div className="feature-row"><span>{name.replaceAll('_',' ')}</span><div><i style={{width: `${Math.max(3, value*100)}%`}}/></div><b>{pct(value, 1)}</b></div>
}

function CaseReview({borrower, decision, history, onOpenScenario, requests, approveRequest}) {
  if (!borrower || !decision) return <div className="empty-state">Select a borrower from the intervention queue.</div>
  const positive = decision.decision === 'APPROVE_FLEXIBILITY'
  return <div className="case-view">
    <div className="case-top">
      <div><div className="eyebrow">CASE REVIEW · {borrower.profile_type.replaceAll('_',' ')}</div><h2>{borrower.borrower_id}</h2><p>{borrower.months_on_record} months observed · DTI {pct(borrower.dti)} · Balance {money(borrower.loan_balance)}</p></div>
      <Badge decision={decision.decision}/>
    </div>
    {requests[borrower.borrower_id]&&<div className={`request-banner ${requests[borrower.borrower_id].status==='approved'?'approved':''}`}><div><span className="eyebrow">BORROWER REQUEST</span><b>{requests[borrower.borrower_id].type}</b><small>Submitted directly from the borrower support center · {requests[borrower.borrower_id].status==='approved'?'approved':'awaiting lender decision'}</small></div><div className="request-actions"><button className="ghost-button" onClick={()=>approveRequest(borrower.borrower_id,'declined')}>Decline</button><button className="primary-button small" onClick={()=>approveRequest(borrower.borrower_id,'approved')}>Approve support {Icons.arrow}</button></div></div>}
    <div className="case-grid">
      <div className="panel chart-panel"><div className="panel-title"><div><span>Cash-flow trajectory</span><small>History used by the decision engine</small></div><button className="ghost-button" onClick={onOpenScenario}>Run scenario</button></div><HistoryChart history={history}/></div>
      <div className="panel risk-panel"><div className="panel-title"><div><span>Risk state</span><small>Current schedule vs. flexibility</small></div></div><div className="rings"><ScoreRing value={decision.stress_probability_current}/><ScoreRing value={decision.completion_prob_flex} label="Completion · flex"/></div><div className="risk-compare"><div><small>Current expected recovery</small><strong>{money(decision.expected_recovery_current)}</strong></div><div><small>With flexibility</small><strong className={decision.recovery_uplift>0?'up':''}>{money(decision.expected_recovery_flex)}</strong></div><div><small>Net uplift</small><strong className={decision.recovery_uplift>0?'up':''}>{decision.recovery_uplift>0?'+':''}{money(decision.recovery_uplift)}</strong></div></div></div>
    </div>
    <div className="case-grid lower">
      <div className="panel"><div className="panel-title"><div><span>Decision rationale</span><small>Explainable rule layer</small></div></div><div className={`decision-banner ${positive?'positive':decision.decision==='DENY_FLEXIBILITY'?'negative':'neutral'}`}><div><div className="decision-title">{positive?'Allow temporary repayment flexibility':decision.decision==='DENY_FLEXIBILITY'?'Keep current schedule':'No intervention required'}</div><p>{decision.why}</p></div><div className="decision-arrow">{Icons.arrow}</div></div><div className="reason-grid"><div><small>Recovery vs. baseline</small><strong>{pct(decision.recovery_ratio)}</strong></div><div><small>Current recovery rate</small><strong>{pct(decision.recovery_rate_current)}</strong></div><div><small>Flex recovery rate</small><strong>{pct(decision.recovery_rate_flex)}</strong></div></div></div>
      <div className="panel"><div className="panel-title"><div><span>Portfolio signals</span><small>History-derived predictors</small></div></div><div className="signal-list"><Signal label="Recent vs. prior income" value={pct(borrower.recent_vs_prior)} state={borrower.recent_vs_prior>=.95?'good':'warn'}/><Signal label="Recent miss rate" value={pct(borrower.recent_miss_rate)} state={borrower.recent_miss_rate<=.15?'good':'bad'}/><Signal label="Coverage ratio" value={`${borrower.coverage_ratio.toFixed(2)}×`} state={borrower.coverage_ratio>=1?'good':'bad'}/><Signal label="Months below cover" value={borrower.months_below_cover} state={borrower.months_below_cover<=2?'good':'bad'}/></div></div>
    </div>
  </div>
}

function Signal({label,value,state}) { return <div className="signal"><span>{label}</span><b className={state}>{value}</b></div> }


function BorrowerPortal({borrower, decision, history, borrowers, onSelectBorrower, requests, onRequest}) {
  const request = borrower ? requests[borrower.borrower_id] : null
  if (!borrower || !decision) return <div className="empty-state">Select a borrower identity to preview the borrower portal.</div>
  const supportEligible = decision.decision === 'APPROVE_FLEXIBILITY' || decision.stress_probability_current >= 0.5
  const submitted = Boolean(request)
  return <div className="borrower-portal">
    <div className="portal-top panel">
      <div><div className="eyebrow">BORROWER SUPPORT CENTER</div><h2>Hi, {borrower.borrower_id}</h2><p>Your lender uses Latitude to review repayment pressure and offer temporary support when it can improve your ability to stay on track.</p></div>
      <div className="portal-top-actions"><label className="account-select"><span>Demo borrower</span><select value={borrower.borrower_id} onChange={e=>onSelectBorrower(e.target.value)}>{borrowers.slice(0,20).map(b=><option key={b.borrower_id} value={b.borrower_id}>{b.borrower_id}</option>)}</select></label><div className="portal-status"><span className="live-dot"/>Loan account connected</div></div>
    </div>
    <div className="portal-grid">
      <div className="panel portal-main">
        <div className="portal-kpi-row"><div><small>Current payment</small><strong>{money(history?.at(-1)?.loan_installment || borrower.loan_installment)}</strong></div><div><small>Outstanding balance</small><strong>{money(borrower.loan_balance)}</strong></div><div><small>Next review</small><strong>28 Sep</strong></div></div>
        <div className={`support-card ${supportEligible ? 'eligible' : 'stable'}`}>
          <div className="support-icon">{supportEligible ? '!' : '✓'}</div>
          <div><div className="eyebrow">{supportEligible ? 'SUPPORT MAY BE AVAILABLE' : 'REPAYMENT LOOKS STABLE'}</div><h3>{supportEligible ? 'We noticed some financial pressure.' : 'You are currently on track.'}</h3><p>{supportEligible ? 'Your recent cash flow suggests a temporary strain. You can ask your lender to review a temporary payment adjustment.' : 'Latitude is not recommending an intervention right now. Keep your existing repayment schedule.'}</p></div>
        </div>
        <div className="portal-section-title"><div><span>Request repayment support</span><small>Your request is sent to your actual lender for review.</small></div></div>
        <div className="support-options">
          {['Temporary payment reduction','Partial payment deferment','Extend repayment period'].map((label,i)=><div key={label} className={`support-option ${i===0?'selected':''}`}><span className="radio"/><div><b>{label}</b><small>{i===0?'Best fit for short-term cash-flow pressure':i===1?'Move part of one payment forward':'Spread the remaining balance over a longer period'}</small></div></div>)}
        </div>
        {submitted ? <div className="request-submitted"><div><b>Request submitted</b><span>Your lender has received the request and Latitude case review is ready.</span></div><span className="badge good"><span className="badge-dot"/>Under lender review</span></div> : <button className="primary-button" disabled={!supportEligible} onClick={()=>onRequest(borrower.borrower_id,'Temporary payment reduction')}>{supportEligible ? 'Send support request to lender' : 'No support request recommended'} {Icons.arrow}</button>}
      </div>
      <div className="panel portal-side"><div className="panel-title"><div><span>Your repayment picture</span><small>Plain-language view</small></div></div><ScoreRing value={decision.stress_probability_current} label="Pressure risk"/><div className="plain-list"><div><span>Recent income</span><b>{pct(borrower.recent_vs_prior)}</b><small>vs. prior period</small></div><div><span>Payment coverage</span><b>{borrower.coverage_ratio.toFixed(2)}×</b><small>cash left after expenses</small></div><div><span>Missed payment rate</span><b>{pct(borrower.recent_miss_rate)}</b><small>recent window</small></div></div></div>
    </div>
    <div className="panel portal-steps"><div className="panel-title"><div><span>What happens next</span><small>Latitude keeps the workflow between you and your lender</small></div></div><div className="step-row"><span>01</span><div><b>You request support</b><small>Tell your lender you need temporary flexibility.</small></div></div><div className="step-row"><span>02</span><div><b>Latitude analyzes the case</b><small>Cash-flow history, stress signals and recovery scenarios are reviewed.</small></div></div><div className="step-row"><span>03</span><div><b>Your lender decides</b><small>The lender stays responsible for the final repayment plan.</small></div></div></div>
  </div>
}

function ScenarioLab({onResult}) {
  const [form,setForm]=useState({income:25000,expenses:14500,installment:3500,loan_balance:85000,dti:.17,recent_miss_rate:.25,recent_vs_prior:.90,recovery_ratio:.92,normalized_slope:-.005,volatility:.10})
  const [running,setRunning]=useState(false)
  const [result,setResult]=useState(null)
  const update=(k,v)=>setForm(f=>({...f,[k]:Number(v)}))
  const run=async()=>{setRunning(true); try{const r=await onResult(form);setResult(r)}finally{setRunning(false)}}
  return <div className="scenario-layout">
    <div className="panel scenario-form"><div className="panel-title"><div><span>Vendor scenario simulator</span><small>Test a borrower before approving payment flexibility</small></div><span className="mini-chip">LIVE API</span></div>
      <div className="form-grid">{[['income','Monthly income'],['expenses','Monthly expenses'],['installment','Loan installment'],['loan_balance','Outstanding balance']].map(([k,l])=><label key={k}><span>{l}</span><input type="number" value={form[k]} onChange={e=>update(k,e.target.value)}/></label>)}
      {[["dti","DTI"],["recent_miss_rate","Recent miss rate"],["recent_vs_prior","Income vs. prior"],["recovery_ratio","Recovery vs. baseline"],["normalized_slope","Income trend"],["volatility","Income volatility"]].map(([k,l])=><label key={k}><span>{l}</span><input type="number" step="0.01" value={form[k]} onChange={e=>update(k,e.target.value)}/></label>)}</div>
      <button className="primary-button" onClick={run}>{running?'Running model…':'Run decision simulation'} {Icons.arrow}</button>
    </div>
    <div className="panel scenario-result">{result ? <><div className="result-kicker">MODEL DECISION</div><h3>{result.decision==='APPROVE_FLEXIBILITY'?'ALLOW FLEXIBILITY':result.decision==='DENY_FLEXIBILITY'?'KEEP CURRENT SCHEDULE':'NO ACTION'}</h3><Badge decision={result.decision}/><p>{result.why}</p><div className="scenario-metrics"><div><small>Stress risk</small><strong>{pct(result.stress_probability_current)}</strong></div><div><small>Recovery uplift</small><strong className={result.recovery_uplift>0?'up':''}>{result.recovery_uplift>0?'+':''}{money(result.recovery_uplift)}</strong></div><div><small>Flex recovery</small><strong>{pct(result.recovery_rate_flex)}</strong></div></div></>:<div className="scenario-placeholder"><div className="orbit">↗</div><h3>Test the decision boundary</h3><p>Change the vendor’s borrower inputs and see how the model + recovery rule responds.</p></div>}</div>
  </div>
}

function ModelHealth({metrics,schema}) {
  const rows = Object.entries(metrics?.model_comparison || {}).sort((a,b)=>b[1].f1-a[1].f1)
  const features = Object.entries(metrics?.feature_importances || {}).slice(0,12)
  return <div className="model-page">
    <div className="model-hero panel"><div><div className="eyebrow">MODEL HEALTH</div><h2>{metrics.live_api_model}</h2><p>{metrics.validation_method} · {metrics.n_borrowers} borrower histories · {schema?.feature_count || metrics.selected_features?.length} engineered features</p></div><div className="model-score"><span>Accuracy</span><strong>{pct(metrics.accuracy,1)}</strong></div></div>
    <div className="metric-strip"><StatCard label="Accuracy" value={pct(metrics.accuracy,1)} detail="Out-of-fold"/><StatCard label="F1" value={pct(metrics.f1,1)} detail="Stress class balance"/><StatCard label="ROC-AUC" value={pct(metrics.roc_auc,1)} detail="Ranking quality"/><StatCard label="Precision" value={pct(metrics.precision,1)} detail="Low false-positive rate"/><StatCard label="Recall" value={pct(metrics.recall,1)} detail="Captures stressed borrowers"/></div>
    <div className="model-grid"><div className="panel"><div className="panel-title"><div><span>Algorithm benchmark</span><small>Same five-fold validation protocol</small></div></div><div className="model-table"><div className="mt-row mt-head"><span>Model</span><span>Accuracy</span><span>F1</span><span>AUC</span></div>{rows.map(([name,m])=><div className={`mt-row ${name===metrics.live_api_model?'champion':''}`} key={name}><span>{name}{name===metrics.live_api_model&&<em>LIVE</em>}</span><span>{pct(m.accuracy,1)}</span><span>{pct(m.f1,1)}</span><span>{pct(m.roc_auc,1)}</span></div>)}</div></div><div className="panel"><div className="panel-title"><div><span>What the model sees</span><small>Relative importance · top features</small></div></div>{features.map(([k,v])=><FeatureBar key={k} name={k} value={v}/>)}</div></div>
  </div>
}

export default function App() {
  const [overview,setOverview]=useState(null), [borrowers,setBorrowers]=useState([]), [metrics,setMetrics]=useState(null), [schema,setSchema]=useState(null)
  const [selectedId,setSelectedId]=useState(null), [history,setHistory]=useState(null), [decision,setDecision]=useState(null)
  const [tab,setTab]=useState('command'), [role,setRole]=useState('lender'), [filter,setFilter]=useState('ALL'), [query,setQuery]=useState(''), [loading,setLoading]=useState(true), [error,setError]=useState(''), [scenarioOpen,setScenarioOpen]=useState(false)
  const [requests,setRequests]=useState(()=>{try{return JSON.parse(localStorage.getItem('latitude_requests')||'{}')}catch{return {}}})
  useEffect(()=>{Promise.all([api.overview(),api.borrowers(),api.metrics(),api.schema()]).then(([o,b,m,s])=>{setOverview(o);setBorrowers(b);setMetrics(m);setSchema(s);setSelectedId(b[0]?.borrower_id)}).catch(e=>setError(e.message)).finally(()=>setLoading(false))},[])
  useEffect(()=>{if(!selectedId)return;Promise.all([api.history(selectedId),api.decision(selectedId)]).then(([h,d])=>{setHistory(h);setDecision(d)}).catch(e=>setError(e.message))},[selectedId])
  const selected=borrowers.find(b=>b.borrower_id===selectedId)
  const filtered=useMemo(()=>borrowers.filter(b=>{const q=query.toLowerCase(); const pass=q ? `${b.borrower_id} ${b.profile_type} ${b.decision}`.toLowerCase().includes(q) : true; const f=filter==='ALL'||(filter==='FLEX'&&b.decision==='APPROVE_FLEXIBILITY')||(filter==='RISK'&&b.stress_probability_current>=.5)||(filter==='STABLE'&&b.decision==='NO_ACTION_NEEDED'); return pass&&f}),[borrowers,filter,query])
  const runScenario=async form=>api.scenario(form)
  const submitRequest=(id,type)=>{const next={...requests,[id]:{type,status:'submitted',createdAt:new Date().toISOString()}};setRequests(next);localStorage.setItem('latitude_requests',JSON.stringify(next))}
  const approveRequest=(id,status='approved')=>{const next={...requests,[id]:{...requests[id],status}};setRequests(next);localStorage.setItem('latitude_requests',JSON.stringify(next))}
  const nav=(id)=>{setTab(id); if(id==='case')setScenarioOpen(false)}

  if(loading) return <div className="loading-screen"><div className="loading-mark">L</div><div>Loading Latitude command center…</div></div>
  if(error && !overview) return <div className="loading-screen"><div className="error-card"><h2>Latitude backend not connected</h2><p>{error}</p><code>cd backend && uvicorn main:app --reload --port 8000</code></div></div>
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><div className="brand-mark">L</div><div><strong>LATITUDE</strong><span>Repayment intelligence</span></div></div><div className="role-switch"><button className={role==='lender'?'active':''} onClick={()=>{setRole('lender');setTab('command')}}>{Icons.bank}<span>Lender</span></button><button className={role==='borrower'?'active':''} onClick={()=>{setRole('borrower');setTab('portal')}}>{Icons.user}<span>Borrower</span></button></div>{role==='lender'&&<><div className="vendor-chip"><span className="live-dot"/>Partner workspace <b>DEMO</b></div><nav className="nav">{[['command',Icons.grid,'Command center'],['case',Icons.shield,'Case review'],['scenario',Icons.sliders,'Scenario lab'],['model',Icons.pulse,'Model health']].map(([id,icon,label])=><button key={id} className={tab===id?'active':''} onClick={()=>nav(id)}>{icon}<span>{label}</span>{id==='case'&&selected?<em>{selected.borrower_id}</em>:null}</button>)}</nav></>}<div className="sidebar-foot"><div className="system"><i/>Decision API online<span>v2.0 · shared workflow demo</span></div><div className="side-note">Latitude connects borrower support requests with the lender's decisioning workflow.</div></div></aside>
    <main className="main">
      <header className="topbar"><div><div className="eyebrow">{role==='lender'?'LENDER COMMAND CENTER':'BORROWER SUPPORT CENTER'}</div><h1>{role==='borrower'?'Your repayment support':tab==='command'?'Portfolio overview':tab==='case'?'Borrower case review':tab==='scenario'?'Scenario lab':'Model health'}</h1></div><div className="top-actions"><span className="data-pill">{role==='lender'?'Synthetic longitudinal data':'Connected loan account'}</span>{role==='lender'&&<span className="data-pill strong">{overview.borrowers} borrowers</span>}<div className="avatar">{role==='lender'?'V':'B'}</div></div></header>
      {role==='borrower' && tab==='portal' && <div className="page"><BorrowerPortal borrower={selected} decision={decision} history={history} borrowers={borrowers} onSelectBorrower={setSelectedId} requests={requests} onRequest={submitRequest}/></div>}
      {tab==='command' && <div className="page command-page"><section className="hero-callout"><div><div className="eyebrow">A SHARED LAYER BETWEEN BORROWER AND LENDER</div><h2>Turn repayment stress into an actionable support workflow.</h2><p>Latitude detects pressure, gives the lender a recovery-aware recommendation, and gives the borrower a transparent way to request support.</p></div><button className="primary-button" onClick={()=>nav('case')}>Review top intervention {Icons.arrow}</button></section>
        <div className="metric-strip"><StatCard label="Portfolio balance" value={money(overview.portfolio_balance)} detail={`${overview.borrowers} active borrower histories`}/><StatCard label="At-risk borrowers" value={overview.at_risk} detail={`${pct(overview.stress_rate)} average model stress`} tone="warn"/><StatCard label="Flex candidates" value={overview.flex_candidates} detail="Recommended to intervene" tone="good"/><StatCard label="Support requests" value={Object.keys(requests).length} detail="Borrowers asking for help" tone="warn"/><StatCard label="Potential recovery uplift" value={money(overview.potential_uplift)} detail="Across eligible cases" tone="good"/><StatCard label="Model accuracy" value={pct(overview.model_accuracy,1)} detail={`${metrics.live_api_model} · 5-fold CV`} /> </div>
        <div className="overview-grid"><div className="panel queue-panel"><div className="panel-title"><div><span>Intervention queue</span><small>Prioritized by stress probability and exposure</small></div><div className="queue-tools"><label className="search"><span>{Icons.search}</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search borrower"/></label><div className="filters">{[['ALL','All'],['RISK','At risk'],['FLEX','Flex'],['STABLE','Stable']].map(([k,l])=><button key={k} className={filter===k?'selected':''} onClick={()=>setFilter(k)}>{l}</button>)}</div></div></div><div className="queue-table"><div className="q-row q-head"><span>Borrower</span><span>Status</span><span>Stress</span><span>Recovery uplift</span><span>Exposure</span><span>Request</span><span></span></div>{filtered.slice(0,12).map(b=><button className={`q-row ${b.borrower_id===selectedId?'current':''}`} key={b.borrower_id} onClick={()=>{setSelectedId(b.borrower_id);nav('case')}}><span><b>{b.borrower_id}</b><small>{b.profile_type.replaceAll('_',' ')}</small></span><span><Badge decision={b.decision}/></span><span className="mono">{pct(b.stress_probability_current)}</span><span className={b.recovery_uplift>0?'up mono':'mono'}>{b.recovery_uplift>0?'+':''}{money(b.recovery_uplift)}</span><span className="mono">{money(b.loan_balance)}</span><span>{requests[b.borrower_id] ? <span className="request-chip">{requests[b.borrower_id].status==='approved'?'Approved':'Requested'}</span> : <span className="request-chip muted">—</span>}</span><span className="row-arrow">{Icons.chevron}</span></button>)}</div></div>
          <div className="side-stack"><div className="panel recovery-panel"><div className="panel-title"><div><span>Recovery view</span><small>Portfolio-level scenario</small></div></div><div className="recovery-bars"><div><span>Current schedule</span><div><i style={{width:`${overview.expected_recovery_now/overview.portfolio_balance*100}%`}}/></div><b>{money(overview.expected_recovery_now)}</b></div><div><span>With flexibility</span><div><i className="positive-bar" style={{width:`${overview.expected_recovery_flex/overview.portfolio_balance*100}%`}}/></div><b>{money(overview.expected_recovery_flex)}</b></div></div><div className="uplift-callout"><strong>+{money(overview.potential_uplift)}</strong><span>maximum modeled uplift from eligible flexibility cases</span></div></div><div className="panel insight-panel"><div className="panel-title"><div><span>Decision lens</span><small>What the vendor should care about</small></div></div><div className="insight"><span className="insight-no">01</span><div><b>Stress is not the action.</b><p>Latitude separates “needs attention” from “should receive flexibility.”</p></div></div><div className="insight"><span className="insight-no">02</span><div><b>Recovery must improve.</b><p>The action is gated by expected recovery, not risk score alone.</p></div></div><div className="insight"><span className="insight-no">03</span><div><b>The vendor stays in control.</b><p>Thresholds and the final schedule change remain policy inputs.</p></div></div></div></div></div>
      </div>}
      {tab==='case' && <div className="page"><CaseReview borrower={selected} decision={decision} history={history} requests={requests} approveRequest={approveRequest} onOpenScenario={()=>setScenarioOpen(true)}/>{scenarioOpen&&<div className="drawer-backdrop" onClick={()=>setScenarioOpen(false)}><div className="drawer" onClick={e=>e.stopPropagation()}><div className="drawer-head"><div><div className="eyebrow">SCENARIO LAB</div><h3>Stress the decision</h3></div><button className="icon-button" onClick={()=>setScenarioOpen(false)}>×</button></div><ScenarioLab onResult={runScenario}/></div></div>}</div>}
      {tab==='scenario' && <div className="page"><ScenarioLab onResult={runScenario}/></div>}
      {tab==='model' && <div className="page"><ModelHealth metrics={metrics} schema={schema}/></div>}
      <footer><span>Latitude · Vendor command center · Prototype</span><span>FastAPI + XGBoost + React · Synthetic data</span></footer>
    </main>
  </div>
}
