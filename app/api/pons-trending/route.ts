import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Crius indexes Pons trading both on the curve and after graduation.
// Its top_volume list measures the rolling 24h volume in USD; it is not
// the same thing as the newest Pons launches feed.
const MAIN_PONS = '0x39dBED3a2bd333467115dE45665cC57F813C4571'
const CRIUS_URL = 'https://api.crius.sh/v1/robinhood/tokens?list=top_volume&launchpad=pons&window=24h&limit=100'
const CACHE_MS = process.env.CRIUS_API_KEY?.trim() ? 120_000 : 15 * 60_000
const DEFAULT_COOLDOWN_MS = 15 * 60_000
let blockedUntil = 0
const MIN_AGE_MS = 24 * 60 * 60 * 1000
const MIN_VOLUME_USD = 1_000
const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/

export type TrendingToken = {
  address: string
  name: string
  ticker: string
  logoUrl: string | null
  ageMinutes: number | null
  featured?: boolean
  status: string
  priceUsd: number | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  traders24h: number | null
  change24hPct: number | null
  liquidityUsd: number | null
}

type SourceRow = {
  address?: unknown
  name?: unknown
  symbol?: unknown
  logo?: unknown
  created_ts?: unknown
  status?: unknown
  price_usd?: unknown
  market_cap_usd?: unknown
  volume_usd?: { '24h'?: unknown } | null
  traders?: { '24h'?: unknown } | null
  change_pct?: { '24h'?: unknown } | null
  liquidity_usd?: unknown
  launchpad?: unknown
}

let snapshot: { at: number; data: TrendingToken[] } | null = null
let inflight: Promise<TrendingToken[]> | null = null

function finite(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

// The main PONS token is explicitly identified in pons documentation.
// It is featured separately, never given an artificial volume rank.
function nestedNumber(root: unknown, ...keys: string[]): number | null {
  let value: unknown = root
  for (const key of keys) {
    if (!value || typeof value !== 'object') return null
    value = (value as Record<string, unknown>)[key]
  }
  return finite(value)
}

async function fetchMainPons(headers: Record<string, string>, signal: AbortSignal): Promise<TrendingToken> {
  const token: TrendingToken = {
    address: MAIN_PONS,
    name: 'Pons',
    ticker: 'PONS',
    logoUrl: null,
    ageMinutes: null,
    featured: true,
    status: 'graduated',
    priceUsd: null,
    marketCapUsd: null,
    volume24hUsd: null,
    traders24h: null,
    change24hPct: null,
    liquidityUsd: null,
  }
  try {
    const response = await fetch(`https://api.crius.sh/v1/robinhood/token/${MAIN_PONS}`, { headers, cache: 'no-store', signal })
    if (!response.ok) return token
    const payload: unknown = await response.json()
    const root = payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data: unknown }).data : null
    if (!root || typeof root !== 'object') return token
    const profile = root as Record<string, unknown>
    // Never accept a different contract address from a third-party response.
    if (typeof profile.address === 'string' && profile.address.toLowerCase() !== MAIN_PONS.toLowerCase()) return token
    const metadata = profile.metadata && typeof profile.metadata === 'object' ? profile.metadata as Record<string, unknown> : null
    token.logoUrl = typeof metadata?.logo === 'string' && /^https:\/\//i.test(metadata.logo) ? metadata.logo : null
    token.priceUsd = nestedNumber(profile, 'price', 'usd')
    token.marketCapUsd = nestedNumber(profile, 'market', 'market_cap_usd')
    token.volume24hUsd = nestedNumber(profile, 'stats', '24h', 'volume_usd')
      ?? nestedNumber(profile, 'stats', 'volume_usd', '24h')
    token.traders24h = nestedNumber(profile, 'stats', '24h', 'traders')
      ?? nestedNumber(profile, 'stats', 'traders', '24h')
    token.change24hPct = nestedNumber(profile, 'price', 'change_pct', '24h')
    token.liquidityUsd = nestedNumber(profile, 'market', 'liquidity_usd')
  } catch {
    // Keep verified contract identity visible; unavailable metrics remain null.
  }
  return token
}

async function load(): Promise<TrendingToken[]> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 12_000)
  try {
    const headers: Record<string, string> = { accept: 'application/json' }
    // Optional, do not expose on the client.
    if (process.env.CRIUS_API_KEY) headers['x-api-key'] = process.env.CRIUS_API_KEY
    const response = await fetch(CRIUS_URL, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    })
    if (!response.ok) {
      if ([401, 403, 429].includes(response.status)) {
        const retrySeconds = Number(response.headers.get('retry-after'))
        blockedUntil = Date.now() + (Number.isFinite(retrySeconds) && retrySeconds > 0
          ? Math.min(retrySeconds * 1000, 24 * 60 * 60 * 1000)
          : DEFAULT_COOLDOWN_MS)
      }
      throw new Error(`Data provider returned ${response.status}`)
    }
    const payload: unknown = await response.json()
    if (!payload || typeof payload !== 'object' || !('data' in payload) || !Array.isArray(payload.data)) {
      throw new Error('Invalid trending provider response')
    }

    const now = Date.now()
    const rows = payload.data as SourceRow[]
    const seen = new Set<string>()
    const trending = rows
      .map((row): TrendingToken | null => {
        if (row.launchpad !== 'pons') return null
        if (typeof row.address !== 'string' || !ADDRESS_RE.test(row.address)) return null
        const address = row.address.toLowerCase()
        if (seen.has(address)) return null
        const created = finite(row.created_ts)
        if (created === null || created <= 0 || now - created < MIN_AGE_MS) return null
        const volume = finite(row.volume_usd?.['24h'])
        if (volume === null || volume < MIN_VOLUME_USD) return null
        seen.add(address)
        return {
          address: row.address,
          name: typeof row.name === 'string' && row.name.trim() ? row.name.trim() : 'Unknown token',
          ticker: typeof row.symbol === 'string' && row.symbol.trim() ? row.symbol.trim() : '???',
          logoUrl: typeof row.logo === 'string' && /^https:\/\//i.test(row.logo) ? row.logo : null,
          ageMinutes: Math.max(0, Math.floor((now - created) / 60_000)),
          status: typeof row.status === 'string' ? row.status : 'unknown',
          priceUsd: finite(row.price_usd),
          marketCapUsd: finite(row.market_cap_usd),
          volume24hUsd: volume,
          traders24h: finite(row.traders?.['24h']),
          change24hPct: finite(row.change_pct?.['24h']),
          liquidityUsd: finite(row.liquidity_usd),
        }
      })
      .filter((row): row is TrendingToken => row !== null)
      .sort((a, b) => (b.volume24hUsd ?? 0) - (a.volume24hUsd ?? 0))
      .slice(0, 30)

    const matching = trending.find((row) => row.address.toLowerCase() === MAIN_PONS.toLowerCase())
    const mainPons = await fetchMainPons(headers, controller.signal)
    if (matching) {
      return [{ ...matching, featured: true, logoUrl: mainPons.logoUrl ?? matching.logoUrl },
        ...trending.filter((row) => row.address.toLowerCase() !== MAIN_PONS.toLowerCase())]
    }
    return [mainPons, ...trending]
  } finally {
    clearTimeout(timeout)
  }
}

export async function GET() {
  const now = Date.now()
  if (snapshot && now - snapshot.at < CACHE_MS) {
    return NextResponse.json({ tokens: snapshot.data, updatedAt: snapshot.at, source: 'Crius · Pons · 24h USD volume', stale: false }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  }

  if (now < blockedUntil) {
    if (snapshot) return NextResponse.json({ tokens: snapshot.data, updatedAt: snapshot.at, source: 'Crius · cached snapshot', stale: true }, { headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ tokens: [], stale: true, updatedAt: null, source: 'Crius temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    if (!inflight) inflight = load()
    const tokens = await inflight
    snapshot = { at: Date.now(), data: tokens }
    return NextResponse.json({ tokens, updatedAt: snapshot.at, source: 'Crius · Pons · 24h USD volume', stale: false }, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    console.warn('[pons-trending] Provider unavailable', error instanceof Error ? error.message : 'unknown error')
    if (blockedUntil < Date.now()) blockedUntil = Date.now() + 2 * 60_000
    if (snapshot) return NextResponse.json({ tokens: snapshot.data, updatedAt: snapshot.at, source: 'Crius · cached snapshot', stale: true }, { headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ tokens: [], stale: true, updatedAt: null, source: 'Crius temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  } finally {
    inflight = null
  }
}
