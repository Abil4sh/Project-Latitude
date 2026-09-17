const API_BASE = (import.meta?.env?.VITE_API_BASE || '/api').replace(/\/$/, '')

async function get(path) {
  const res = await fetch(`${API_BASE}${path}`)
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  return res.json()
}

async function post(path, body) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${path}`)
  return res.json()
}

export const api = {
  overview: () => get('/overview'),
  borrowers: () => get('/borrowers'),
  history: (id) => get(`/borrowers/${id}/history`),
  decision: (id) => get(`/borrowers/${id}/decision`),
  metrics: () => get('/model-metrics'),
  schema: () => get('/feature-schema'),
  scenario: (payload) => post('/scenario', payload),
}
