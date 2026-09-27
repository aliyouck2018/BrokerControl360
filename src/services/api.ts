export interface ApiPosition {
  quantity: number
  price: number
  accrued_interest: number
  asset_class: string
  duration: number
}

let healthState: { available: boolean; checkedAt: number } | undefined
let healthRequest: Promise<boolean> | undefined

const defaultApiUrl = import.meta.env.PROD
  ? window.location.origin
  : `${window.location.protocol}//${window.location.hostname}:8001`
const apiUrl = (import.meta.env.VITE_API_URL || defaultApiUrl).replace(/\/$/, '')

export async function statelessApiAvailable(force = false): Promise<boolean> {
  if (import.meta.env.MODE === 'test') return false
  if (!force && healthState && Date.now() - healthState.checkedAt < 5_000) return healthState.available
  if (!healthRequest) {
    healthRequest = fetch(`${apiUrl}/health`, { signal: AbortSignal.timeout(600) })
      .then((response) => response.ok)
      .catch(() => false)
      .then((available) => {
        healthState = { available, checkedAt: Date.now() }
        return available
      })
      .finally(() => { healthRequest = undefined })
  }
  return healthRequest
}

export async function postStateless<T>(path: string, body: unknown): Promise<T | undefined> {
  if (!await statelessApiAvailable()) return undefined
  try {
    const response = await fetch(`${apiUrl}${path}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), signal: AbortSignal.timeout(2_000),
    })
    if (!response.ok) return undefined
    return await response.json() as T
  } catch {
    healthState = { available: false, checkedAt: Date.now() }
    return undefined
  }
}
