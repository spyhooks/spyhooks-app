import { NextRequest, NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Read-only discovery feed. No wallet-scoring or profitability claims.
const CRIUS = 'https://api.crius.sh/v1/robinhood'
const MAIN_PONS = '0x39dBED3a2bd333467115dE45665cC57F813C4571'
const ADDRESS = /^0x[a-f0-9]{40}$/i
// Protect the anonymous provider quota: a single feed every five minutes is already
// ~288 upstream requests/day on ONE server instance (before manual refreshes).
const HAS_KEY = Boolean(process.env.CRIUS_API_KEY?.trim())
const CACHE_MS = HAS_KEY ? 60_000 : 5 * 60_000
const STALE_MS = 30 * 60_000
const MAX_DISCOVERED_TOKENS = HAS_KEY ? 3 : 1
const MIN_UPSTREAM_GAP_MS = HAS_KEY ? 220 : 650
let nextUpstreamAt = 0
let queue: Promise<void> = Promise.resolve()
let blockedUntil = 0

class ProviderError extends Error {
  constructor(public status: number, message: string, public retryAfter = 0) { super(message) }
}

async function withRateLimit<T>(fn: () => Promise<T>): Promise<T> {
  const task = queue.then(async () => {
    const delay = Math.max(0, nextUpstreamAt - Date.now())
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
    nextUpstreamAt = Date.now() + MIN_UPSTREAM_GAP_MS
  })
  queue = task.catch(() => {})
  await task
  if (Date.now() < blockedUntil) throw new ProviderError(429, 'Trade data provider is rate limited.', Math.ceil((blockedUntil - Date.now()) / 1000))
  return fn()
}

type Token = { address: string; name: string; symbol: string; image: string | null }
type Trade = {
  id: string
  address: string
  name: string
  symbol: string
  side: 'buy' | 'sell'
  trader: string
  tx: string | null
  timestamp: number
  valueUsd: number | null
  priceUsd: number | null
  amountBase: number | null
  dex: string | null
  finality: string | null
}
type ResponseBody = {
  tokens: Token[]
  trades: Trade[]
  updatedAt: string | null
  stale: boolean
  source: string
  coverage: string
  warning: string | null
}
type CacheEntry = { time: number; body: ResponseBody }
const cache = new Map<string, CacheEntry>()
const inflight = new Map<string, Promise<ResponseBody>>()

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}
function str(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null }
function num(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
function asTs(value: unknown): number | null {
  const n = num(value)
  if (n === null || n <= 0) return null
  return n < 1e11 ? Math.round(n * 1000) : Math.round(n)
}
function cleanToken(value: unknown): Token | null {
  const row = obj(value)
  const address = str(row?.address)
  if (!address || !ADDRESS.test(address)) return null
  return {
    address: address.toLowerCase(),
    name: str(row?.name) ?? 'Unknown token',
    symbol: str(row?.symbol) ?? '???',
    image: /^https:\/\//i.test(str(row?.logo) ?? '') ? (str(row?.logo)) : null,
  }
}
async function criusGet(path: string): Promise<unknown> {
  if (Date.now() < blockedUntil)
    throw new ProviderError(429, 'Provider quota reached. Retry when the limit resets.', Math.ceil((blockedUntil - Date.now()) / 1000))
  return withRateLimit(async () => {
    const headers: Record<string, string> = { accept: 'application/json' }
    if (HAS_KEY) headers['x-api-key'] = process.env.CRIUS_API_KEY!.trim()
    let res: Response
    try {
      res = await fetch(`${CRIUS}${path}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(11000) })
    } catch {
      throw new ProviderError(503, 'Trade provider connection timed out or failed.')
    }
    if (!res.ok) {
      const upstreamError = await res.json().catch(() => null) as { error?: { code?: string; message?: string } } | null
      const hint = upstreamError?.error?.message || upstreamError?.error?.code || ''
      if (res.status === 429) {
        const retry = Number(res.headers.get('retry-after'))
        const seconds = Number.isFinite(retry) && retry > 0 ? Math.min(86400, retry) : 300
        blockedUntil = Date.now() + seconds * 1000
        throw new ProviderError(429, `Crius rate limit or quota exceeded. ${hint}`.trim(), seconds)
      }
      if (res.status === 401 || res.status === 403)
        throw new ProviderError(res.status, `Crius access denied (${res.status}). Check CRIUS_API_KEY and provider plan. ${hint}`.trim())
      throw new ProviderError(res.status, `Crius API returned ${res.status}. ${hint}`.trim())
    }
    return res.json()
  })
}
async function discover(): Promise<Token[]> {
  const payload = obj(await criusGet('/tokens?list=top_volume&launchpad=pons&window=24h&limit=10'))
  if (!Array.isArray(payload?.data)) throw new Error('Token discovery returned an unexpected response')
  const tokens = payload.data.map(cleanToken).filter((v): v is Token => !!v).slice(0, MAX_DISCOVERED_TOKENS)
  if (!tokens.some(t => t.address === MAIN_PONS.toLowerCase())) {
    tokens.unshift({ address: MAIN_PONS.toLowerCase(), name: 'Pons', symbol: 'PONS', image: null })
  }
  return tokens.slice(0, MAX_DISCOVERED_TOKENS)
}
function parseTrades(payload: unknown, token: Token): Trade[] {
  const data = obj(payload)?.data
  if (!Array.isArray(data)) throw new Error('Trade provider returned an unexpected response')
  const out: Trade[] = []
  for (const item of data) {
    const t = obj(item)
    if (!t) continue
    const side = str(t.type)?.toLowerCase()
    const trader = str(t.trader)
    const timestamp = asTs(t.ts)
    const id = str(t.id)
    if ((side !== 'buy' && side !== 'sell') || !trader || !ADDRESS.test(trader) || timestamp === null || !id) continue
    out.push({
      id: `${token.address}:${id}`,
      address: token.address,
      name: token.name,
      symbol: token.symbol,
      side,
      trader: trader.toLowerCase(),
      tx: /^0x[a-f0-9]{64}$/i.test(str(t.tx) ?? '') ? str(t.tx) : null,
      timestamp,
      valueUsd: num(t.value_usd),
      priceUsd: num(t.price_usd),
      amountBase: num(t.amount_base),
      dex: str(t.dex),
      finality: str(t.finality),
    })
  }
  return out
}
async function build(address: string | null): Promise<ResponseBody> {
  let tokens: Token[]
  let discoveryWarning: string | null = null
  if (address) {
    // Token discovery lookup is optional. The address is always authoritative.
    tokens = [{ address, name: 'Selected token', symbol: 'TOKEN', image: null }]
    try {
      const profile = obj((await criusGet(`/token/${address}`)))?.data
      const p = obj(profile)
      const metadata = obj(p?.metadata)
      tokens = [{
        address,
        name: str(p?.name) ?? str(metadata?.name) ?? 'Selected token',
        symbol: str(p?.symbol) ?? str(metadata?.symbol) ?? 'TOKEN',
        image: /^https:\/\//i.test(str(metadata?.logo) ?? '') ? str(metadata?.logo) : null,
      }]
    } catch { /* Trade tape can still load without a token profile. */ }
  } else if (!HAS_KEY) {
    tokens = [{ address: MAIN_PONS.toLowerCase(), name: 'Pons', symbol: 'PONS', image: null }]
    discoveryWarning = 'Anonymous mode samples the main PONS token only.'
  } else {
    try {
      tokens = await discover()
    } catch {
      // A documented main PONS contract is enough to keep a truthful, limited feed.
      tokens = [{ address: MAIN_PONS.toLowerCase(), name: 'Pons', symbol: 'PONS', image: null }]
      discoveryWarning = 'Token discovery unavailable. Showing main PONS token only.'
    }
  }
  // Avoid a concurrent burst of 5+ upstream requests (anonymous plan: 2 rps).
  // A known token and a single sequential trade tape are enough for anonymous V1.
  const succeeded: Array<{ token: Token; trades: Trade[] }> = []
  const failures: string[] = []
  for (const token of tokens) {
    try {
      succeeded.push({ token, trades: parseTrades(await criusGet(`/token/${token.address}/trades?limit=20`), token) })
    } catch (e) {
      if (e instanceof ProviderError && (e.status === 429 || e.status === 401 || e.status === 403)) throw e
      failures.push(e instanceof Error ? e.message : 'Unknown token feed error')
    }
  }
  if (!succeeded.length) throw new ProviderError(503, `Trade source unavailable. ${failures[0] ?? 'No successful token feeds.'}`)
  const unique = new Map<string, Trade>()
  for (const response of succeeded) for (const trade of response.trades) unique.set(trade.id, trade)
  const trades = [...unique.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, 75)
  return {
    tokens, trades, updatedAt: new Date().toISOString(), stale: false,
    source: 'Crius trade tape · Robinhood Chain',
    coverage: address ? 'Single token trade feed' : `Sampled ${succeeded.length} Pons token feed${succeeded.length === 1 ? '' : 's'}`,
    warning: [!HAS_KEY ? 'Anonymous provider mode: limited sampling and updates every 5 minutes. Add CRIUS_API_KEY for higher quota.' : null, discoveryWarning, succeeded.length < tokens.length
      ? `${tokens.length - succeeded.length} token feeds failed to load. Showing available results only.` : null].filter(Boolean).join(' ') || null,
  }
}
export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('token')?.trim() ?? ''
  if (raw && !ADDRESS.test(raw)) return NextResponse.json({ error: 'Enter a valid 0x token contract address.' }, { status: 400 })
  const token = raw ? raw.toLowerCase() : null
  const key = token ?? 'discover'
  const now = Date.now()
  const existing = cache.get(key)
  if (existing && now - existing.time < CACHE_MS)
    return NextResponse.json(existing.body, { headers: { 'Cache-Control': 'no-store' } })
  try {
    let request = inflight.get(key)
    if (!request) {
      request = build(token)
      inflight.set(key, request)
    }
    const body = await request
    cache.set(key, { time: Date.now(), body })
    // Avoid growing the cache unbounded for arbitrary token searches.
    if (cache.size > 60) {
      const oldest = [...cache.entries()].sort((a,b)=>a[1].time-b[1].time).slice(0,cache.size-50)
      oldest.forEach(([k]) => cache.delete(k))
    }
    return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    const provider = e instanceof ProviderError ? e : null
    if (existing && now - existing.time < STALE_MS)
      return NextResponse.json({ ...existing.body, stale: true, warning: 'Showing the last available snapshot; live updates are temporarily unavailable.' }, { headers: { 'Cache-Control': 'no-store' } })
    const status = provider?.status === 429 ? 429 : provider?.status === 401 || provider?.status === 403 ? 502 : 503
    const retryAfter = provider?.retryAfter || (status === 429 ? 300 : 0)
    // Return a stable, non-sensitive error shape. Details stay on the server.
    console.warn('[SPY Intelligence] Upstream feed unavailable', {
      status: provider?.status ?? 'unknown',
      reason: provider?.status === 429 ? 'rate_limited' : 'upstream_failure',
    })
    return NextResponse.json({
      error: 'Live trade feed temporarily unavailable',
      errorCode: status === 429 ? 'RATE_LIMITED' : status === 502 ? 'PROVIDER_ACCESS' : 'UNAVAILABLE',
      retryAfterSeconds: retryAfter,
    }, { status, headers: retryAfter ? { 'Retry-After': String(retryAfter), 'Cache-Control': 'no-store' } : { 'Cache-Control': 'no-store' } })
  } finally {
    inflight.delete(key)
  }
}
