import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

const ADDRESS = /^0x[a-f0-9]{40}$/i
const BASE = 'https://api.geckoterminal.com/api/v2'
const TTL_MS = 3 * 60_000
const cache = new Map<string, { at: number; body: MarketResult }>()

type MarketResult = {
  address: string
  source: 'GeckoTerminal' | 'unavailable'
  scope: 'top pool' | 'not indexed'
  poolAddress: string | null
  poolName: string | null
  priceUsd: number | null
  marketCapUsd: number | null
  volume24hUsd: number | null
  change24hPct: number | null
  liquidityUsd: number | null
  updatedAt: string | null
  note: string
}

function obj(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null
}
function numeric(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) && n >= 0 ? n : null
}
function signed(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null
  if (typeof value === 'string' && !value.trim()) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}
function addressFromId(id: unknown): string | null {
  if (typeof id !== 'string') return null
  const match = id.match(/0x[a-f0-9]{40}$/i)
  return match ? match[0].toLowerCase() : null
}
function empty(address: string, note: string): MarketResult {
  return { address, source: 'unavailable', scope: 'not indexed', poolAddress: null,
    poolName: null, priceUsd: null, marketCapUsd: null, volume24hUsd: null,
    change24hPct: null, liquidityUsd: null, updatedAt: null, note }
}
async function gecko(path: string): Promise<Record<string, unknown> | null> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { Accept: 'application/json;version=20230203' },
    next: { revalidate: 180 },
    signal: AbortSignal.timeout(8500),
  })
  if (!res.ok) return null
  return obj(await res.json())
}

async function market(address: string): Promise<MarketResult> {
  // Token endpoint is used for token-specific capitalization; pool FDV is NOT
  // substituted for market cap (different definitions).
  const [poolsBody, tokenBody] = await Promise.allSettled([
    gecko(`/networks/robinhood/tokens/${address}/pools?include=base_token%2Cquote_token`),
    gecko(`/networks/robinhood/tokens/${address}`),
  ])
  const poolsPayload = poolsBody.status === 'fulfilled' ? poolsBody.value : null
  const tokenPayload = tokenBody.status === 'fulfilled' ? tokenBody.value : null
  const tokenAttrs = obj(obj(tokenPayload?.data)?.attributes)
  const tokenCap = numeric(tokenAttrs?.market_cap_usd)
  const tokenPrice = numeric(tokenAttrs?.price_usd)

  const rows = Array.isArray(poolsPayload?.data) ? poolsPayload.data : []
  const relevant = rows.map(raw => {
    const pool = obj(raw)
    const attrs = obj(pool?.attributes)
    const rel = obj(pool?.relationships)
    const base = addressFromId(obj(obj(rel?.base_token)?.data)?.id)
    const quote = addressFromId(obj(obj(rel?.quote_token)?.data)?.id)
    const side = base === address ? 'base' : quote === address ? 'quote' : null
    return { attrs, side, pool }
  }).filter(row => row.attrs && row.side)

  // Pick the most liquid *matching* token pool, rather than summing unrelated
  // pool volumes or mistakenly treating quote token prices as base token prices.
  relevant.sort((a, b) => (numeric(b.attrs?.reserve_in_usd) ?? 0) - (numeric(a.attrs?.reserve_in_usd) ?? 0))
  const best = relevant[0]
  if (!best) {
    return { ...empty(address, 'No matching GeckoTerminal pool was found. This can occur for tokens still on the launch curve.'),
      marketCapUsd: tokenCap, priceUsd: tokenPrice, source: tokenCap !== null || tokenPrice !== null ? 'GeckoTerminal' : 'unavailable' }
  }
  const attrs = best.attrs!
  const price = numeric(attrs[best.side === 'base' ? 'base_token_price_usd' : 'quote_token_price_usd'])
  const rawChange = signed(obj(attrs.price_change_percentage)?.h24)
  // GeckoTerminal pool change is for the base token. Inversion converts this
  // to quote-token price change when the compared token is the quote asset.
  const change = best.side === 'base' ? rawChange : rawChange !== null && rawChange > -100
    ? ((1 / (1 + rawChange / 100)) - 1) * 100 : null
  const poolAddr = typeof attrs.address === 'string' && ADDRESS.test(attrs.address) ? attrs.address : null
  return {
    address,
    source: 'GeckoTerminal',
    scope: 'top pool',
    poolAddress: poolAddr,
    poolName: typeof attrs.name === 'string' ? attrs.name : null,
    priceUsd: price ?? tokenPrice,
    marketCapUsd: tokenCap,
    volume24hUsd: numeric(obj(attrs.volume_usd)?.h24),
    change24hPct: change,
    liquidityUsd: numeric(attrs.reserve_in_usd),
    updatedAt: new Date().toISOString(),
    note: '24h volume, price change, and liquidity describe the most liquid indexed pool, not all token markets.',
  }
}

export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('address')?.trim() ?? ''
  if (!ADDRESS.test(raw)) return NextResponse.json({ error: 'Enter a valid token contract address.' }, { status: 400 })
  const address = raw.toLowerCase()
  const existing = cache.get(address)
  if (existing && Date.now() - existing.at < TTL_MS) return NextResponse.json(existing.body)
  try {
    const body = await market(address)
    cache.set(address, { at: Date.now(), body })
    if (cache.size > 150) {
      const oldest = [...cache.entries()].sort((a,b) => a[1].at - b[1].at).slice(0,50)
      for (const [key] of oldest) cache.delete(key)
    }
    return NextResponse.json(body)
  } catch (err) {
    console.error('[compare-market] source unavailable', err instanceof Error ? err.message : 'unknown')
    return NextResponse.json(existing?.body ?? empty(address, 'Pool market data is temporarily unavailable.'),
      { headers: { 'Cache-Control': 'no-store' } })
  }
}
