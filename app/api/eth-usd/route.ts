import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

const REFRESH_MS = 60_000
const MAX_STALE_MS = 10 * 60_000
let cached: { usd: number; at: number } | null = null
let inflight: Promise<number | null> | null = null

function valid(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 && value < 1_000_000
}

async function fetchQuote(): Promise<number | null> {
  // Public ETH/USD reference price. Fallback uses another independent spot source.
  try {
    const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd', {
      cache: 'no-store', signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' },
    })
    if (res.ok) {
      const json = await res.json() as { ethereum?: { usd?: unknown } }
      if (valid(json.ethereum?.usd)) return json.ethereum.usd
    }
  } catch { /* Try another quote source. */ }
  try {
    const res = await fetch('https://api.coinbase.com/v2/prices/ETH-USD/spot', {
      cache: 'no-store', signal: AbortSignal.timeout(4000), headers: { accept: 'application/json' },
    })
    if (res.ok) {
      const json = await res.json() as { data?: { amount?: string } }
      const price = Number(json.data?.amount)
      if (valid(price)) return price
    }
  } catch { /* No trusted live price available. */ }
  return null
}

export async function GET() {
  const now = Date.now()
  if (cached && now - cached.at < REFRESH_MS)
    return NextResponse.json({ usd: cached.usd, updatedAt: new Date(cached.at).toISOString() })

  inflight ??= fetchQuote().finally(() => { inflight = null })
  const price = await inflight
  if (price !== null) cached = { usd: price, at: Date.now() }

  // Never present an old exchange rate as live.
  if (!cached || Date.now() - cached.at > MAX_STALE_MS)
    return NextResponse.json({ usd: null, updatedAt: null }, { status: 503 })

  return NextResponse.json({ usd: cached.usd, updatedAt: new Date(cached.at).toISOString() })
}
